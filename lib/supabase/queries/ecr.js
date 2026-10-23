import { createClient } from "@/lib/supabase/client";
import { getEcrTemplateForSubject } from "@/lib/ecr/constants";
import {
  computeLearnerRow,
  computeFinalFromTerms,
  pickComputedForStorage,
  termGradeDescription,
} from "@/lib/ecr/computeGrades";
import {
  classifyGradeChange,
  isValidGrade,
  parseValidGrade,
} from "@/lib/ecr/gradeIntegrity";
import {
  areSameSchoolYear,
  resolveTermSheetAccess,
  schoolYearVariants,
} from "@/lib/academic/academicTermPolicy";
import { selectEcrTermSource } from "@/lib/ecr/recordData";
import {
  getCurrentTeacherSession,
  restoreGradeSnapshot,
  upsertGrades,
} from "@/lib/supabase/queries/myClasses";
import {
  hasUsableScores,
  isCompleteScoreRow,
  pickValidScores,
  readImportTermGrade,
  readImportTermScores,
  resolveImportTargetTerm,
  verifyClassAssignment,
} from "@/lib/eclass/importIntegrity";

const supabase = createClient();

function unwrapOne(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const TERM_SHEET_CONTEXT_SELECT = `
  id,
  term,
  status,
  workbook_id,
  ecr_workbooks (
    id,
    class_id,
    school_year,
    teacher_id,
    status,
    source
  )
`;

const CLASS_CONTEXT_SELECT =
  "id, subject_id, section_id, school_year, teacher_id, quarter";

const WRITE_CHUNK = 100;

async function readAllRows(factory) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await factory().order("id").range(offset, offset + 999);
    if (error) return { data: null, error };
    rows.push(...(data || []));
    if (!data || data.length < 1000) return { data: rows, error: null };
  }
}

/** Read existing sibling-term records only. Never repairs data by copying grades or scores. */
export async function loadEcrClassFamily({ classId, teacherId }) {
  const base = await loadClassRow(classId);
  if (base.error || !base.data) return { data: null, error: base.error || new Error("Class not found.") };
  const teacher = await requireCurrentTeacher(teacherId);
  if (teacher.error) return { data: null, error: teacher.error };
  if (base.data.teacher_id !== teacher.data.teacherId) return { data: null, error: new Error("This class is not assigned to your account.") };
  const { subject_id: subjectId, section_id: sectionId, school_year: year } = base.data;
  const classes = await supabase.from("classes").select(CLASS_CONTEXT_SELECT)
    .eq("teacher_id", teacher.data.teacherId).eq("subject_id", subjectId).eq("section_id", sectionId)
    .in("school_year", schoolYearVariants(year));
  if (classes.error) return { data: null, error: classes.error };
  const family = classes.data || [];
  const ids = family.map((row) => row.id);
  const [books, grades] = await Promise.all([
    supabase.from("ecr_workbooks").select("id,class_id,school_year,teacher_id,source,status,ecr_term_sheets(id,term,status)")
      .in("class_id", ids).eq("teacher_id", teacher.data.teacherId).in("school_year", schoolYearVariants(year)),
    readAllRows(() => supabase.from("grades").select("id,student_id,class_id,subject_id,quarter,school_year,final_grade")
      .in("class_id", ids).eq("subject_id", subjectId).in("school_year", schoolYearVariants(year))),
  ]);
  if (books.error || grades.error) return { data: null, error: books.error || grades.error };
  const blocks = [];
  const results = await Promise.all((books.data || []).flatMap((book) => (book.ecr_term_sheets || []).map(async (sheet) => {
    const result = await loadEcrTermSheet(sheet.id);
    if (result.error) throw result.error;
    return { ...result.data, classId: book.class_id, workbookId: book.id };
  })));
  blocks.push(...results);
  const termData = {};
  const termSheets = [];
  const classMap = {};
  const warnings = [];
  for (const term of [1, 2, 3, 4]) {
    const matches = family.filter((row) => Number(row.quarter) === term);
    if (matches.length === 1) classMap[term] = matches[0].id;
    else if (matches.length > 1) warnings.push(`More than one assigned class matches Term ${term}. Existing records have been kept.`);
    if (term === 4) continue;
    const { selected, conflicts } = selectEcrTermSource({ term, blocks, termClassId: classMap[term], baseClassId: classId });
    if (conflicts.length) warnings.push(`Term ${term} has more than one saved ECR sheet. Review the source records before editing; no records were merged.`);
    if (selected) {
      termData[term] = selected;
      termSheets.push({ ...selected.termSheet, readConflict: conflicts.length > 0 || matches.length > 1 });
    }
  }
  return { data: { classes: family, classMap, workbooks: books.data || [], blocks, termData, termSheets,
    officialGrades: grades.data || [], warnings }, error: null };
}

function mapConfigRows(rows = []) {
  return rows
    .map((row) => ({
      id: row.id,
      component: row.component,
      item_index: row.item_index,
      item_label: row.item_label,
      highest_possible_score: Number(row.highest_possible_score),
      component_weight: Number(row.component_weight),
      sort_order: row.sort_order ?? 0,
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.item_index - b.item_index);
}

function scoresMapFromRows(rows = []) {
  const map = {};
  for (const row of rows) {
    if (row.raw_score === null || row.raw_score === undefined) continue;
    map[`${row.component}:${row.item_index}`] = row.raw_score;
  }
  return map;
}

async function insertDefaultConfig(termSheetId, subjectName = null) {
  const template = getEcrTemplateForSubject(subjectName);
  const payload = template.map((row, index) => ({
    term_sheet_id: termSheetId,
    component: row.component,
    item_index: row.item_index,
    item_label: row.item_label,
    highest_possible_score: row.highest_possible_score,
    component_weight: row.component_weight,
    sort_order: index,
  }));
  const { error } = await supabase.from("ecr_component_config").insert(payload);
  if (error) return { error };
  return { error: null };
}

/**
 * Load or bootstrap workbook + term sheets for a class.
 */
export async function getOrCreateEcrWorkbook({
  classId,
  schoolYear,
  teacherId,
  subjectName = null,
  source = "manual",
} = {}) {
  if (!classId || !schoolYear || !teacherId) {
    return { data: null, error: new Error("Class, school year, and teacher are required.") };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("ecr_workbooks")
    .select(
      `
      id,
      class_id,
      school_year,
      teacher_id,
      template_version,
      source,
      status,
      ecr_term_sheets (
        id,
        term,
        status
      )
    `
    )
    .eq("class_id", classId)
    .in("school_year", schoolYearVariants(schoolYear))
    .maybeSingle();

  if (fetchError) return { data: null, error: fetchError };

  if (existing) {
    return { data: existing, error: null };
  }

  const { data: workbook, error: insertError } = await supabase
    .from("ecr_workbooks")
    .insert({
      class_id: classId,
      school_year: schoolYear,
      teacher_id: teacherId,
      source,
      status: "draft",
    })
    .select("id, class_id, school_year, teacher_id, template_version, source, status")
    .single();

  // Concurrent create race: unique (class_id, school_year) — re-fetch winner.
  if (insertError) {
    const isUnique =
      insertError.code === "23505" ||
      /duplicate key|unique constraint/i.test(String(insertError.message ?? ""));
    if (isUnique) {
      const { data: raced, error: raceError } = await supabase
        .from("ecr_workbooks")
        .select(
          `
          id,
          class_id,
          school_year,
          teacher_id,
          template_version,
          source,
          status,
          ecr_term_sheets (
            id,
            term,
            status
          )
        `
        )
        .eq("class_id", classId)
        .in("school_year", schoolYearVariants(schoolYear))
        .maybeSingle();
      if (raceError) return { data: null, error: raceError };
      if (raced) return { data: raced, error: null };
    }
    return { data: null, error: insertError };
  }

  const termPayload = [1, 2, 3].map((term) => ({
    workbook_id: workbook.id,
    term,
    status: "draft",
  }));

  const { data: termSheets, error: termError } = await supabase
    .from("ecr_term_sheets")
    .insert(termPayload)
    .select("id, term, status");

  if (termError) {
    // Sheets may already exist from a parallel bootstrap — reload workbook.
    const { data: withSheets, error: reloadError } = await supabase
      .from("ecr_workbooks")
      .select(
        `
        id,
        class_id,
        school_year,
        teacher_id,
        template_version,
        source,
        status,
        ecr_term_sheets (
          id,
          term,
          status
        )
      `
      )
      .eq("id", workbook.id)
      .maybeSingle();
    if (reloadError) return { data: null, error: termError };
    if (withSheets?.ecr_term_sheets?.length) {
      return { data: withSheets, error: null };
    }
    return { data: null, error: termError };
  }

  for (const sheet of termSheets ?? []) {
    const cfg = await insertDefaultConfig(sheet.id, subjectName);
    if (cfg.error) return { data: null, error: cfg.error };
  }

  return {
    data: { ...workbook, ecr_term_sheets: termSheets },
    error: null,
  };
}

export async function loadEcrTermSheet(termSheetId) {
  const [
    { data: termSheet, error: termError },
    { data: config, error: configError },
    { data: scores, error: scoresError },
    { data: computed, error: computedError },
  ] = await Promise.all([
    supabase
      .from("ecr_term_sheets")
      .select(
        `
        id,
        term,
        status,
        workbook_id,
        ecr_workbooks (
          id,
          class_id,
          school_year,
          teacher_id,
          status,
          source
        )
      `
      )
      .eq("id", termSheetId)
      .single(),
    supabase
      .from("ecr_component_config")
      .select("*")
      .eq("term_sheet_id", termSheetId)
      .order("sort_order"),
    readAllRows(() => supabase.from("ecr_component_scores")
      .select("student_id, component, item_index, raw_score")
      .eq("term_sheet_id", termSheetId)),
    supabase
      .from("ecr_computed_grades")
      .select("*")
      .eq("term_sheet_id", termSheetId),
  ]);

  if (termError) return { data: null, error: termError };
  if (configError) return { data: null, error: configError };
  if (scoresError) return { data: null, error: scoresError };
  if (computedError) return { data: null, error: computedError };

  return {
    data: {
      termSheet,
      config: mapConfigRows(config ?? []),
      scores: scores ?? [],
      computed: computed ?? [],
    },
    error: null,
  };
}

export async function loadEcrWorkbookSummary(workbookId) {
  const { data: sheets, error } = await supabase
    .from("ecr_term_sheets")
    .select("id, term")
    .eq("workbook_id", workbookId)
    .order("term");

  if (error) return { data: null, error };

  const termData = [];
  for (const sheet of sheets ?? []) {
    const { data: computed, error: compError } = await supabase
      .from("ecr_computed_grades")
      .select("student_id, term_grade")
      .eq("term_sheet_id", sheet.id);
    if (compError) return { data: null, error: compError };
    termData.push({ term: sheet.term, computed: computed ?? [] });
  }

  return { data: { termData }, error: null };
}

async function loadTermSheetContext(termSheetId) {
  const { data, error } = await supabase
    .from("ecr_term_sheets")
    .select(TERM_SHEET_CONTEXT_SELECT)
    .eq("id", termSheetId)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) return { data: null, error: new Error("Term sheet not found.") };

  const workbook = unwrapOne(data.ecr_workbooks);
  if (!workbook?.id) {
    return { data: null, error: new Error("ECR workbook not found.") };
  }

  return { data: { ...data, workbook }, error: null };
}

async function loadClassRow(classId) {
  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_CONTEXT_SELECT)
    .eq("id", classId)
    .maybeSingle();
  return { data: data ?? null, error };
}

async function loadRosterStudentIds(classId) {
  const { data, error } = await supabase
    .from("class_students")
    .select("student_id")
    .eq("class_id", classId);
  if (error) return { data: [], error };
  return {
    data: [...new Set((data ?? []).map((row) => row.student_id).filter(Boolean))],
    error: null,
  };
}

async function loadComputedRows(termSheetId) {
  const { data, error } = await supabase
    .from("ecr_computed_grades")
    .select("student_id, term_grade")
    .eq("term_sheet_id", termSheetId);
  return { data: data ?? [], error };
}

async function requireCurrentTeacher(teacherId = null) {
  const session = await getCurrentTeacherSession();
  if (session.error || !session.data?.teacherId) {
    return {
      data: null,
      error:
        session.error ??
        new Error("You must be signed in as a teacher to modify ECR records."),
    };
  }
  if (teacherId && session.data.teacherId !== teacherId) {
    return {
      data: null,
      error: new Error("You can only modify classes assigned to your account."),
    };
  }
  return { data: session.data, error: null };
}

async function resolveTargetClassId({
  workbook,
  term,
  subjectId = null,
  siblingClassMap = {},
}) {
  const mapped =
    siblingClassMap?.[term] ?? siblingClassMap?.[String(term)] ?? null;
  const base = await loadClassRow(workbook.class_id);
  if (base.error) return { data: null, error: base.error };
  if (!base.data) {
    return { data: null, error: new Error("The ECR class could not be found.") };
  }
  if (mapped) {
    const target = await loadClassRow(mapped);
    if (target.error) return { data: null, error: target.error };
    if (!target.data || target.data.teacher_id !== workbook.teacher_id || target.data.subject_id !== base.data.subject_id ||
        target.data.section_id !== base.data.section_id || !areSameSchoolYear(target.data.school_year, base.data.school_year)) {
      return { data: null, error: new Error("The target term class must have the same assigned teacher, subject, section and school year.") };
    }
    return { data: mapped, error: null };
  }

  if (Number(base.data.quarter) === Number(term)) {
    return { data: base.data.id, error: null };
  }

  const targetSubjectId = subjectId ?? base.data.subject_id;
  const yearVariants = schoolYearVariants(base.data.school_year);

  const { data, error } = await supabase
    .from("classes")
    .select("id, quarter")
    .eq("teacher_id", workbook.teacher_id)
    .eq("subject_id", targetSubjectId)
    .eq("section_id", base.data.section_id)
    .in("school_year", yearVariants)
    .eq("quarter", Number(term))
    .limit(2);

  if (error) return { data: null, error };
  if (!data?.length) {
    return {
      data: null,
      error: new Error(
        `Term ${term} is not assigned to this class yet. Ask the head teacher to set this subject to All Terms, then try again.`
      ),
    };
  }
  if (data.length > 1) {
    return {
      data: null,
      error: new Error(
        `More than one Term ${term} class matches this subject and section. Ask the head teacher to resolve the duplicate class assignment.`
      ),
    };
  }

  return { data: data[0].id, error: null };
}

async function verifyTargetClass({
  targetClassId,
  term,
  subjectId = null,
  schoolYear = null,
  teacherId = null,
}) {
  const { data, error } = await loadClassRow(targetClassId);
  if (error) return { data: null, error };
  if (!data) {
    return {
      data: null,
      error: new Error("The target class for this term could not be found."),
    };
  }
  if (Number(data.quarter) !== Number(term)) {
    return {
      data: null,
      error: new Error(
        `The target class is not a Term ${term} class. Cross-term grade writes are not allowed.`
      ),
    };
  }
  if (subjectId && data.subject_id !== subjectId) {
    return {
      data: null,
      error: new Error("The target class does not match this subject."),
    };
  }
  if (schoolYear && !areSameSchoolYear(data.school_year, schoolYear)) {
    return {
      data: null,
      error: new Error("The target class does not match this school year."),
    };
  }
  if (teacherId && data.teacher_id !== teacherId) {
    return {
      data: null,
      error: new Error("The target class is not assigned to this teacher."),
    };
  }
  return { data, error: null };
}

async function resolveTermWriteAccess({ term, schoolYear, sheetStatus = "draft" }) {
  // P0-04E: publication control is per class-subject-term sheet.
  // The class row (term, subject, school year, teacher) is verified separately
  // by verifyTargetClass(); the sheet status protects published grades.
  const access = resolveTermSheetAccess({ term, sheetStatus });
  return { data: { active: null, access }, error: null };
}

async function evaluatePublicationReadiness({ targetClassId, termSheetId }) {
  const roster = await loadRosterStudentIds(targetClassId);
  if (roster.error) return { data: null, error: roster.error };

  const computed = await loadComputedRows(termSheetId);
  if (computed.error) return { data: null, error: computed.error };
  const details = await loadEcrTermSheet(termSheetId);
  if (details.error) return { data: null, error: details.error };
  const scoresByStudent = {};
  for (const row of details.data.scores) {
    if (row.raw_score != null) (scoresByStudent[row.student_id] ||= {})[`${row.component}:${row.item_index}`] = row.raw_score;
  }

  const rosterSet = new Set(roster.data);
  const valid = new Map();
  const invalid = [];
  const extra = [];

  for (const row of computed.data ?? []) {
    if (!row?.student_id) continue;
    if (!rosterSet.has(row.student_id)) {
      extra.push(row.student_id);
      continue;
    }
    const parsed = parseValidGrade(row.term_grade);
    if (parsed === null || (hasUsableScores(scoresByStudent[row.student_id]) && !isCompleteScoreRow(scoresByStudent[row.student_id], details.data.config))) invalid.push(row.student_id);
    else valid.set(row.student_id, parsed);
  }

  const missing = roster.data.filter((id) => !valid.has(id));
  return {
    data: {
      roster: roster.data,
      valid,
      invalid,
      missing,
      extra,
      ready:
        roster.data.length > 0 &&
        missing.length === 0 &&
        invalid.length === 0,
    },
    error: null,
  };
}

function readinessMessage(readiness, term) {
  if (!readiness.roster.length) {
    return "This class has no enrolled learners. Add the official roster before publishing.";
  }
  if (readiness.missing.length || readiness.invalid.length) {
    const count = new Set([...readiness.missing, ...readiness.invalid]).size;
    return `Term ${term} is incomplete: ${count} learner${
      count === 1 ? "" : "s"
    } still need a valid grade. Nothing was published.`;
  }
  return `Term ${term} is not ready to publish.`;
}

async function verifyGradesWritten(expectedRows = []) {
  if (!expectedRows.length) return { ok: true, error: null, mismatch: [] };

  const groups = new Map();
  for (const row of expectedRows) {
    const key = `${row.class_id}|${row.subject_id}|${Number(row.quarter)}|${row.school_year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        class_id: row.class_id,
        subject_id: row.subject_id,
        quarter: Number(row.quarter),
        school_year: row.school_year,
        students: new Map(),
      });
    }
    groups.get(key).students.set(row.student_id, row.final_grade);
  }

  const mismatch = [];
  for (const group of groups.values()) {
    for (let i = 0; i < [...group.students.keys()].length; i += WRITE_CHUNK) {
      const studentIds = [...group.students.keys()].slice(i, i + WRITE_CHUNK);
      const { data, error } = await supabase
        .from("grades")
        .select("student_id, final_grade, class_id, subject_id, quarter, school_year")
        .eq("class_id", group.class_id)
        .eq("subject_id", group.subject_id)
        .eq("quarter", group.quarter)
        .eq("school_year", group.school_year)
        .in("student_id", studentIds);
      if (error) return { ok: false, error, mismatch };

      const actual = new Map(
        (data ?? []).map((row) => [row.student_id, parseValidGrade(row.final_grade)])
      );
      for (const studentId of studentIds) {
        const expected = group.students.get(studentId);
        if (actual.get(studentId) !== expected) {
          mismatch.push({
            student_id: studentId,
            expected,
            actual: actual.get(studentId) ?? null,
          });
        }
      }
    }
  }

  if (mismatch.length) {
    return {
      ok: false,
      error: new Error(
        `Grade sync verification failed for ${mismatch.length} learner${
          mismatch.length === 1 ? "" : "s"
        }. Official grades were restored.`
      ),
      mismatch,
    };
  }

  return { ok: true, error: null, mismatch: [] };
}

/**
 * Save draft scores + computed rows for one term sheet.
 *
 * Publication order is deliberate:
 *   1. verify the current-term policy and the teacher/class assignment
 *   2. write draft/component data
 *   3. verify roster completeness and valid grades
 *   4. sync official grades (null-safe, compensating snapshot)
 *   5. publish the term status only after sync succeeds
 *
 * If step 4 or 5 fails, official grades are restored from the snapshot and the
 * term sheet remains a draft. The returned error carries `recoverable` state so
 * the teacher can retry after fixing the underlying problem.
 */
export async function saveEcrTermSheet({
  termSheetId,
  config = [],
  studentScores = {},
  publish = false,
  classMeta = {},
  siblingClassMap = {},
  confirmPublishedOverwrite = false,
} = {}) {
  if (!termSheetId) {
    return { data: null, error: new Error("Term sheet id is required.") };
  }

  const context = await loadTermSheetContext(termSheetId);
  if (context.error || !context.data) {
    return { data: null, error: context.error };
  }

  const { term, status: sheetStatus, workbook } = context.data;
  const termNumber = Number(term);
  const schoolYear = workbook.school_year;

  const accessResult = await resolveTermWriteAccess({
    term: termNumber,
    schoolYear,
    sheetStatus,
  });
  const access = accessResult.data.access;
  if (!access.allowed) {
    return { data: null, error: new Error(access.message) };
  }

  if (sheetStatus === "published") {
    if (!publish) {
      return {
        data: null,
        error: new Error(
          "This term is already published. Publish again with an explicit correction confirmation to apply changes."
        ),
      };
    }
    if (!confirmPublishedOverwrite) {
      return {
        data: null,
        error: new Error(access.message),
      };
    }
  }

  const teacher = await requireCurrentTeacher(workbook.teacher_id);
  if (teacher.error) return { data: null, error: teacher.error };

  const target = await resolveTargetClassId({
    workbook,
    term: termNumber,
    subjectId: classMeta?.subjectId ?? null,
    siblingClassMap,
  });
  if (target.error) return { data: null, error: target.error };

  const verifiedClass = await verifyTargetClass({
    targetClassId: target.data,
    term: termNumber,
    subjectId: classMeta?.subjectId ?? null,
    schoolYear,
    teacherId: workbook.teacher_id,
  });
  if (verifiedClass.error) {
    return { data: null, error: verifiedClass.error };
  }

  const configRows = mapConfigRows(config);
  const invalidConfig = configRows.find(
    (row) =>
      !Number.isFinite(row.highest_possible_score) ||
      row.highest_possible_score <= 0 ||
      !Number.isFinite(row.component_weight) ||
      row.component_weight < 0
  );
  if (invalidConfig) {
    return {
      data: null,
      error: new Error(
        "Highest possible scores and weights must be valid positive numbers."
      ),
    };
  }

  const [roster, savedSheet] = await Promise.all([loadRosterStudentIds(target.data), loadEcrTermSheet(termSheetId)]);
  if (roster.error || savedSheet.error) return { data: null, error: roster.error || savedSheet.error };
  const rosterSet = new Set(roster.data);
  const savedScores = {};
  for (const row of savedSheet.data.scores) {
    if (row.raw_score != null) (savedScores[row.student_id] ||= {})[`${row.component}:${row.item_index}`] = row.raw_score;
  }
  const savedGrades = new Map(savedSheet.data.computed.map((row) => [row.student_id, parseValidGrade(row.term_grade)]));
  const configChanged = configRows.some((row) => {
    const previous = savedSheet.data.config.find((entry) => entry.component === row.component && Number(entry.item_index) === Number(row.item_index));
    return !previous || Number(previous.highest_possible_score) !== row.highest_possible_score || Number(previous.component_weight) !== row.component_weight;
  });

  const scoreMap = new Map();
  const computedMap = new Map();
  const nowIso = new Date().toISOString();

  for (const [studentId, scoresByKey] of Object.entries(studentScores ?? {})) {
    const incoming = scoresByKey ?? {};
    const hasLiveScores = Object.values(incoming).some(
      (value) => value !== "" && value !== null && value !== undefined
    );

    // Imported grade-only rows have no live component scores. Do not
    // recompute them to null; preserve the reviewed imported grade.
    if (!hasLiveScores) continue;
    if (!rosterSet.has(studentId)) return { data: null, error: new Error("A scored learner is not enrolled in the selected term class. Nothing was saved.") };
    const safeScores = { ...(savedScores[studentId] || {}) };
    let scoresChanged = false;

    for (const cfg of configRows) {
      const key = `${cfg.component}:${cfg.item_index}`;
      if (!(key in incoming)) continue;
      const raw = incoming[key];
      // Blank inputs preserve existing records. No score is invented or reset.
      if (raw === "" || raw === null || raw === undefined) continue;
      let rawScore = null;
      if (!(raw === "" || raw === null || raw === undefined)) {
        rawScore = Number(raw);
        if (
          !Number.isFinite(rawScore) ||
          rawScore < 0 ||
          rawScore > cfg.highest_possible_score
        ) {
          return {
            data: null,
            error: new Error(
              `A ${cfg.component} score is outside the allowed range (0–${cfg.highest_possible_score}). Nothing was saved.`
            ),
          };
        }
      }
      scoreMap.set(`${studentId}:${key}`, {
        term_sheet_id: termSheetId,
        student_id: studentId,
        component: cfg.component,
        item_index: cfg.item_index,
        raw_score: rawScore,
      });
      safeScores[key] = rawScore;
      if (savedScores[studentId]?.[key] == null || Number(savedScores[studentId][key]) !== rawScore) scoresChanged = true;
    }

    // Partial drafts may save real item scores, but cannot overwrite a saved final grade.
    if (!isCompleteScoreRow(safeScores, configRows)) continue;
    if (savedGrades.get(studentId) != null && !scoresChanged && !configChanged) continue;
    const computed = computeLearnerRow(safeScores, configRows);
    computedMap.set(studentId, {
      term_sheet_id: termSheetId,
      student_id: studentId,
      ...pickComputedForStorage(computed),
      updated_at: nowIso,
    });
  }

  const scoreUpserts = [...scoreMap.values()];
  const computedUpserts = [...computedMap.values()];

  // Complete all validation before updating any configuration or assessment rows.
  for (const row of configRows) {
    if (!row.id) continue;
    const { error } = await supabase.from("ecr_component_config").update({
      highest_possible_score: row.highest_possible_score, component_weight: row.component_weight, item_label: row.item_label,
    }).eq("id", row.id).eq("term_sheet_id", termSheetId);
    if (error) return { data: null, error };
  }

  if (scoreUpserts.length) {
    for (let i = 0; i < scoreUpserts.length; i += WRITE_CHUNK) {
      const { error } = await supabase
        .from("ecr_component_scores")
        .upsert(scoreUpserts.slice(i, i + WRITE_CHUNK), {
          onConflict: "term_sheet_id,student_id,component,item_index",
        });
      if (error) return { data: null, error };
    }
  }

  if (computedUpserts.length) {
    for (let i = 0; i < computedUpserts.length; i += WRITE_CHUNK) {
      const { error } = await supabase
        .from("ecr_computed_grades")
        .upsert(computedUpserts.slice(i, i + WRITE_CHUNK), {
          onConflict: "term_sheet_id,student_id",
        });
      if (error) return { data: null, error };
    }
  }

  if (!publish) {
    return {
      data: {
        saved: computedUpserts.length,
        status: "draft",
        term: termNumber,
      },
      error: null,
    };
  }

  const readiness = await evaluatePublicationReadiness({
    targetClassId: target.data,
    termSheetId,
  });
  if (readiness.error) return { data: null, error: readiness.error };
  if (!readiness.data.ready) {
    return {
      data: {
        status: "draft",
        syncApplied: false,
        recoverable: true,
        missing: readiness.data.missing,
        invalid: readiness.data.invalid,
      },
      error: new Error(readinessMessage(readiness.data, termNumber)),
    };
  }

  const sync = await syncEcrTermToGrades({
    termSheetId,
    classId: target.data,
    subjectId: classMeta?.subjectId ?? null,
    schoolYear,
    term: termNumber,
    siblingClassMap,
    requireCompleteRoster: true,
    allowPublishedOverwrite: confirmPublishedOverwrite,
  });
  if (sync.error) {
    return {
      data: {
        status: "draft",
        syncApplied: false,
        recoverable: true,
        rolledBack: sync.rolledBack ?? null,
      },
      error: sync.error,
    };
  }

  // Publish status is committed only after the official grades are verified.
  const { data: statusRow, error: termStatusError } = await supabase
    .from("ecr_term_sheets")
    .update({ status: "published" })
    .eq("id", termSheetId)
    .select("id, status")
    .maybeSingle();

  if (termStatusError || !statusRow) {
    const rollback = await restoreGradeSnapshot(sync.snapshot);
    return {
      data: {
        status: "draft",
        syncApplied: true,
        rolledBack: !rollback.error,
        recoverable: true,
      },
      error:
        termStatusError ??
        new Error(
          "The publication status could not be confirmed. Official grades were restored and the term remains a draft."
        ),
    };
  }

  let workbookWarning = null;
  const { error: workbookError } = await supabase
    .from("ecr_workbooks")
    .update({ status: "published" })
    .eq("id", workbook.id);
  if (workbookError) workbookWarning = workbookError.message;

  return {
    data: {
      saved: computedUpserts.length,
      status: "published",
      term: termNumber,
      targetClassId: target.data,
      syncCount: sync.count,
      extraStudents: readiness.data.extra,
      workbookWarning,
    },
    error: null,
  };
}


export async function syncEcrTermToGrades({
  termSheetId,
  subjectId = null,
  schoolYear = null,
  term = null,
  siblingClassMap = {},
  requireCompleteRoster = false,
  allowPublishedOverwrite = false,
} = {}) {
  if (!termSheetId) {
    return { error: new Error("Term sheet id is required.") };
  }

  const context = await loadTermSheetContext(termSheetId);
  if (context.error || !context.data) {
    return { error: context.error };
  }

  const workbook = context.data.workbook;
  const sheetTerm = Number(context.data.term);
  const quarter = term === null || term === undefined ? sheetTerm : Number(term);

  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 3) {
    return {
      error: new Error(
        "Only Term 1, Term 2, and Term 3 can be synced to official term grades."
      ),
    };
  }
  if (quarter !== sheetTerm) {
    return {
      error: new Error(
        "The requested term does not match this ECR term sheet. Cross-term grade writes are not allowed."
      ),
    };
  }

  const year = schoolYear ?? workbook.school_year;
  if (!areSameSchoolYear(year, workbook.school_year)) {
    return {
      error: new Error(
        "The requested school year does not match this ECR workbook."
      ),
    };
  }

  if (context.data.status === "published" && !allowPublishedOverwrite) {
    return {
      error: new Error(
        "This term is already published. Official grades cannot be replaced without an authorized correction."
      ),
    };
  }

  const accessResult = await resolveTermWriteAccess({
    term: quarter,
    schoolYear: year,
    sheetStatus: context.data.status,
  });
  const access = accessResult.data.access;
  if (!access.allowed) {
    return { error: new Error(access.message) };
  }

  const teacher = await requireCurrentTeacher(workbook.teacher_id);
  if (teacher.error) return { error: teacher.error };

  const target = await resolveTargetClassId({
    workbook,
    term: quarter,
    subjectId,
    siblingClassMap,
  });
  if (target.error) return { error: target.error };

  const verifiedClass = await verifyTargetClass({
    targetClassId: target.data,
    term: quarter,
    subjectId,
    schoolYear: year,
    teacherId: workbook.teacher_id,
  });
  if (verifiedClass.error) return { error: verifiedClass.error };

  const computedResult = await loadComputedRows(termSheetId);
  if (computedResult.error) return { error: computedResult.error };

  let rosterIds = null;
  if (requireCompleteRoster) {
    const readiness = await evaluatePublicationReadiness({ targetClassId: target.data, termSheetId });
    if (readiness.error) return { error: readiness.error };
    if (!readiness.data.ready) return { error: new Error(readinessMessage(readiness.data, quarter)) };
    const roster = await loadRosterStudentIds(target.data);
    if (roster.error) return { error: roster.error };
    rosterIds = roster.data;
    if (!rosterIds.length) {
      return {
        error: new Error(
          "This class has no enrolled learners. Add the official roster before publishing."
        ),
      };
    }
  }

  const rosterSet = rosterIds ? new Set(rosterIds) : null;
  const valid = new Map();
  const invalid = [];
  const extra = [];

  for (const row of computedResult.data ?? []) {
    if (!row?.student_id) continue;
    if (rosterSet && !rosterSet.has(row.student_id)) {
      extra.push(row.student_id);
      continue;
    }
    const grade = parseValidGrade(row.term_grade);
    if (grade === null) invalid.push(row.student_id);
    else valid.set(row.student_id, grade);
  }

  if (rosterIds) {
    const missing = rosterIds.filter((id) => !valid.has(id));
    if (missing.length || invalid.length) {
      const count = new Set([...missing, ...invalid]).size;
      return {
        error: new Error(
          `Term ${quarter} is incomplete: ${count} learner${
            count === 1 ? "" : "s"
          } still need a valid grade. Nothing was published.`
        ),
        missing,
        invalid,
      };
    }
  }

  const finalSubjectId = subjectId ?? verifiedClass.data.subject_id;
  const gradeRows = [...valid.entries()].map(([studentId, grade]) => ({
    student_id: studentId,
    class_id: target.data,
    subject_id: finalSubjectId,
    quarter,
    final_grade: grade,
    school_year: year,
  }));

  if (!gradeRows.length) {
    return {
      error: requireCompleteRoster
        ? new Error("No valid term grades are available to publish.")
        : null,
      count: 0,
      targetClassId: target.data,
      invalid,
      extra,
    };
  }

  const result = await upsertGrades(gradeRows, { source: "ecr-term-sync" });
  if (result.error) {
    return {
      error: result.error,
      count: 0,
      rolledBack: result.rolledBack ?? null,
      targetClassId: target.data,
    };
  }

  const verification = await verifyGradesWritten(gradeRows);
  if (!verification.ok) {
    const rollback = await restoreGradeSnapshot(result.snapshot);
    return {
      error: verification.error,
      count: 0,
      rolledBack: !rollback.error,
      mismatch: verification.mismatch,
      targetClassId: target.data,
    };
  }

  return {
    error: null,
    count: result.count,
    snapshot: result.snapshot,
    targetClassId: target.data,
    invalid,
    extra,
  };
}

/**
 * Sync AVE (quarter 4) from authoritative Term 1–3 computed grades.
 *
 * This is a final-grade-only publication path:
 * - Term 3 must be the current academic term;
 * - all three term sheets must already be published;
 * - every roster learner must have valid Term 1, 2, and 3 grades;
 * - official quarter 4 rows are written only after those checks pass.
 *
 * `studentTermGrades` is accepted for backward compatibility but is never used
 * as the source of truth. Database computed grades are authoritative.
 */
export async function syncEcrAveToGrades({
  workbookId,
  subjectId = null,
  schoolYear = null,
  siblingClassMap = {},
  termSheetIdsByTerm = null,
} = {}) {
  if (!workbookId) {
    return { error: new Error("Workbook id is required for final grades.") };
  }

  const { data: workbook, error: workbookError } = await supabase
    .from("ecr_workbooks")
    .select("id, class_id, school_year, teacher_id, status")
    .eq("id", workbookId)
    .maybeSingle();
  if (workbookError) return { error: workbookError };
  if (!workbook) return { error: new Error("ECR workbook not found.") };

  const year = schoolYear ?? workbook.school_year;
  if (!areSameSchoolYear(year, workbook.school_year)) {
    return {
      error: new Error("The requested school year does not match this ECR workbook."),
    };
  }

  // P0-04E: the Final Grade / Average is gated by class-subject-term
  // publication state, not by a school-wide current-term setting. All three
  // academic term sheets of this class/subject must already be published,
  // which is verified below.
  const teacher = await requireCurrentTeacher(workbook.teacher_id);
  if (teacher.error) return { error: teacher.error };

  const { data: sheets, error: sheetError } = await supabase
    .from("ecr_term_sheets")
    .select("id, term, status")
    .eq("workbook_id", workbookId)
    .in("term", [1, 2, 3])
    .order("term");
  if (sheetError) return { error: sheetError };

  const sheetsByTerm = new Map(
    (sheets ?? []).map((sheet) => [Number(sheet.term), sheet])
  );

  if (termSheetIdsByTerm) {
    const baseClass = await loadClassRow(workbook.class_id);
    if (baseClass.error || !baseClass.data) return { error: baseClass.error || new Error("Class not found.") };
    for (const term of [1, 2, 3]) {
      const sheetId = termSheetIdsByTerm[term];
      if (!sheetId) { sheetsByTerm.delete(term); continue; }
      const context = await loadTermSheetContext(sheetId);
      if (context.error) return { error: context.error };
      const sourceClass = await loadClassRow(context.data.workbook.class_id);
      if (sourceClass.error) return { error: sourceClass.error };
      if (Number(context.data.term) !== term || context.data.workbook.teacher_id !== workbook.teacher_id ||
          sourceClass.data?.teacher_id !== workbook.teacher_id || sourceClass.data?.subject_id !== baseClass.data.subject_id ||
          sourceClass.data?.section_id !== baseClass.data.section_id || !areSameSchoolYear(sourceClass.data?.school_year, year)) {
        return { error: new Error("The term sheet does not belong to the same assigned class, subject and school year.") };
      }
      sheetsByTerm.set(term, context.data);
    }
  }

  for (const term of [1, 2, 3]) {
    const sheet = sheetsByTerm.get(term);
    if (!sheet) {
      return {
        error: new Error(`Term ${term} is missing from this ECR workbook.`),
      };
    }
    if (sheet.status !== "published") {
      return {
        error: new Error(
          `Publish Term ${term} before publishing the Final Grade / Average.`
        ),
      };
    }
  }

  const termGrades = new Map();
  for (const term of [1, 2, 3]) {
    const computed = await loadComputedRows(sheetsByTerm.get(term).id);
    if (computed.error) return { error: computed.error };
    for (const row of computed.data ?? []) {
      if (!row?.student_id) continue;
      const grade = parseValidGrade(row.term_grade);
      if (grade === null) continue;
      const entry = termGrades.get(row.student_id) ?? {};
      entry[term] = grade;
      termGrades.set(row.student_id, entry);
    }
  }

  const target = await resolveTargetClassId({
    workbook,
    term: 4,
    subjectId,
    siblingClassMap,
  });
  if (target.error) return { error: target.error };

  const verifiedClass = await verifyTargetClass({
    targetClassId: target.data,
    term: 4,
    subjectId,
    schoolYear: year,
    teacherId: workbook.teacher_id,
  });
  if (verifiedClass.error) return { error: verifiedClass.error };

  const roster = await loadRosterStudentIds(target.data);
  if (roster.error) return { error: roster.error };
  if (!roster.data.length) {
    return {
      error: new Error(
        "This class has no enrolled learners. Add the official roster before publishing final grades."
      ),
    };
  }

  const missing = [];
  const gradeRows = [];
  const finalSubjectId = subjectId ?? verifiedClass.data.subject_id;

  for (const studentId of roster.data) {
    const terms = termGrades.get(studentId) ?? {};
    if (
      !isValidGrade(terms[1]) ||
      !isValidGrade(terms[2]) ||
      !isValidGrade(terms[3])
    ) {
      missing.push(studentId);
      continue;
    }
    const final = computeFinalFromTerms([terms[1], terms[2], terms[3]]);
    if (!isValidGrade(final)) {
      missing.push(studentId);
      continue;
    }
    gradeRows.push({
      student_id: studentId,
      class_id: target.data,
      subject_id: finalSubjectId,
      quarter: 4,
      final_grade: final,
      school_year: year,
    });
  }

  if (missing.length) {
    return {
      error: new Error(
        `The Final Grade / Average cannot be published yet: ${missing.length} learner${
          missing.length === 1 ? "" : "s"
        } still need complete Term 1–3 grades. Nothing was published.`
      ),
      missing,
    };
  }

  if (!gradeRows.length) {
    return { error: new Error("No valid final grades are available to publish.") };
  }

  const result = await upsertGrades(gradeRows, { source: "ecr-ave-sync" });
  if (result.error) {
    return { error: result.error, count: 0, rolledBack: result.rolledBack ?? null };
  }

  const verification = await verifyGradesWritten(gradeRows);
  if (!verification.ok) {
    const rollback = await restoreGradeSnapshot(result.snapshot);
    return {
      error: verification.error,
      count: 0,
      rolledBack: !rollback.error,
      mismatch: verification.mismatch,
    };
  }

  // Workbook status is a summary flag. It is updated only after the official
  // quarter 4 rows have been verified. A failure here does not invalidate the
  // published grades, so it is reported as a warning.
  let workbookWarning = null;
  const { error: statusError } = await supabase
    .from("ecr_workbooks")
    .update({ status: "published" })
    .eq("id", workbookId);
  if (statusError) workbookWarning = statusError.message;

  return {
    error: null,
    count: result.count,
    targetClassId: target.data,
    finalTerm: 4,
    workbookWarning,
  };
}

/**
 * After ECR Excel import, bootstrap workbook with term grades (raw scores optional).
 */
/**
 * Save an imported E-Class Record into the ECR draft only.
 *
 * P0-04C guarantees:
 * - teacher/class/school-year/term are verified against the database;
 * - only the selected academic term is written (cross-term isolation);
 * - blank/partial rows preserve the existing draft record;
 * - only valid grades are written;
 * - no official public.grades rows are written and no term is auto-published.
 */
export async function syncEcrFromImport({
  classItem,
  teacherId,
  learners = [],
} = {}) {
  const classId = classItem?.id;
  if (!classId) {
    return { error: new Error("Missing class details for this E-Record.") };
  }

  const classRowResult = await loadClassRow(classId);
  if (classRowResult.error) return { error: classRowResult.error };
  if (!classRowResult.data) {
    return { error: new Error("This class could not be found.") };
  }
  const classRow = classRowResult.data;

  const sessionTeacher = await requireCurrentTeacher(
    teacherId ?? classRow.teacher_id
  );
  if (sessionTeacher.error) return { error: sessionTeacher.error };
  if (classRow.teacher_id !== sessionTeacher.data.teacherId) {
    return {
      error: new Error(
        "You can only import records into classes assigned to you."
      ),
    };
  }

  const assignmentError = verifyClassAssignment({
    classRow,
    classItem,
    teacherId: sessionTeacher.data.teacherId,
    sessionTeacherId: sessionTeacher.data.teacherId,
  });
  if (assignmentError) return { error: assignmentError };

  const schoolYear = classRow.school_year;
  const termResult = resolveImportTargetTerm(classRow);
  if (termResult.error) return { error: termResult.error };
  const term = termResult.term;

  const accessResult = await resolveTermWriteAccess({
    term,
    schoolYear,
    sheetStatus: "draft",
  });
  const access = accessResult.data.access;
  if (!access.allowed || !access.editable) {
    return { error: new Error(access.message) };
  }

  const wb = await getOrCreateEcrWorkbook({
    classId,
    schoolYear,
    teacherId: sessionTeacher.data.teacherId,
    subjectName: classItem?.subject ?? classItem?.subjectName ?? null,
    source: "import",
  });
  if (wb.error || !wb.data) {
    return { error: wb.error ?? new Error("Unable to open this E-Record.") };
  }

  const workbook = wb.data;
  if (workbook.teacher_id !== sessionTeacher.data.teacherId) {
    return {
      error: new Error("This E-Record belongs to a different teacher."),
    };
  }

  let termSheets = workbook.ecr_term_sheets ?? [];
  if (!termSheets.length) {
    const termPayload = [1, 2, 3].map((sheetTerm) => ({
      workbook_id: workbook.id,
      term: sheetTerm,
      status: "draft",
    }));
    const { data: createdSheets, error: sheetError } = await supabase
      .from("ecr_term_sheets")
      .insert(termPayload)
      .select("id, term, status");
    if (sheetError) {
      const { data: reloaded } = await supabase
        .from("ecr_term_sheets")
        .select("id, term, status")
        .eq("workbook_id", workbook.id)
        .order("term");
      termSheets = reloaded ?? [];
    } else {
      const subjectName = classItem?.subject ?? classItem?.subjectName ?? null;
      for (const sheet of createdSheets ?? []) {
        await insertDefaultConfig(sheet.id, subjectName);
      }
      termSheets = createdSheets ?? [];
    }
  }

  const targetSheet = termSheets.find(
    (sheet) => Number(sheet.term) === Number(term)
  );
  if (!targetSheet) {
    return {
      error: new Error(`Term ${term} is missing from this ECR workbook.`),
    };
  }
  if (targetSheet.status === "published") {
    return {
      error: new Error(
        `Term ${term} is already published. Re-importing cannot silently replace published grades; use the authorized correction workflow.`
      ),
    };
  }

  let { data: configRows, error: configError } = await supabase
    .from("ecr_component_config")
    .select("*")
    .eq("term_sheet_id", targetSheet.id)
    .order("sort_order");
  if (configError) return { error: configError };

  if (!configRows?.length) {
    const created = await insertDefaultConfig(
      targetSheet.id,
      classItem?.subject ?? classItem?.subjectName ?? null
    );
    if (created.error) return { error: created.error };
    const reloaded = await supabase
      .from("ecr_component_config")
      .select("*")
      .eq("term_sheet_id", targetSheet.id)
      .order("sort_order");
    if (reloaded.error) return { error: reloaded.error };
    configRows = reloaded.data ?? [];
  }

  const mappedConfig = mapConfigRows(configRows);

  const layout =
    learners.find(
      (learner) =>
        learner.component_layout?.[term] ||
        learner.component_layout?.[String(term)]
    )?.component_layout?.[term] ??
    learners.find((learner) => learner.component_layout?.[String(term)])
      ?.component_layout?.[String(term)];

  const configPatches = [];
  if (layout?.hps && mappedConfig.length) {
    for (const cfg of mappedConfig) {
      const importedHps = Number(
        layout.hps?.[cfg.component]?.[cfg.item_index - 1]
      );
      const importedWeight = Number(layout.weights?.[cfg.component]);
      const patch = {};
      if (Number.isFinite(importedHps) && importedHps > 0) {
        patch.highest_possible_score = importedHps;
      }
      if (Number.isFinite(importedWeight) && importedWeight > 0) {
        patch.component_weight = importedWeight;
      }
      if (!Object.keys(patch).length || !cfg.id) continue;
      configPatches.push({ id: cfg.id, patch });
      Object.assign(cfg, patch);
    }
  }

  const roster = await loadRosterStudentIds(classId);
  if (roster.error) return { error: roster.error };
  const rosterSet = new Set(roster.data);

  const existingComputed = await loadComputedRows(targetSheet.id);
  if (existingComputed.error) return { error: existingComputed.error };
  const existingByStudent = new Map(
    (existingComputed.data ?? []).map((row) => [
      row.student_id,
      parseValidGrade(row.term_grade),
    ])
  );

  const scoreMap = new Map();
  const computedMap = new Map();
  const duplicateStudentIds = new Set();
  const seenStudentIds = new Set();
  const counts = {
    new: 0,
    unchanged: 0,
    conflicting: 0,
    preserved: 0,
    missing: 0,
    invalid: 0,
    partial: 0,
    skipped: 0,
    written: 0,
  };

  for (const learner of learners) {
    const studentId = learner?.student_id ?? learner?.studentId ?? null;
    if (!studentId || !rosterSet.has(studentId)) {
      counts.skipped += 1;
      continue;
    }
    if (seenStudentIds.has(studentId)) {
      duplicateStudentIds.add(studentId);
      continue;
    }
    seenStudentIds.add(studentId);

    const rawScores = readImportTermScores(learner, term);
    const hasRawScores = hasUsableScores(rawScores);
    const importedRaw = readImportTermGrade(learner, term);
    const importedValid = isValidGrade(importedRaw) ? importedRaw : null;
    const complete = hasRawScores && isCompleteScoreRow(rawScores, mappedConfig);

    if (hasRawScores && !complete) counts.partial += 1;

    let termGrade = null;
    let computed = null;
    let rowScores = [];

    if (hasRawScores) {
      const picked = pickValidScores(rawScores, mappedConfig);
      rowScores = Object.entries(picked).map(([key, score]) => {
        const [component, itemIndex] = key.split(":");
        return {
          term_sheet_id: targetSheet.id,
          student_id: studentId,
          component,
          item_index: Number(itemIndex),
          raw_score: score,
        };
      });
      for (const row of rowScores) scoreMap.set(`${studentId}:${row.component}:${row.item_index}`, row);
      if (complete) computed = computeLearnerRow(rawScores, mappedConfig);
    }
    // Preserve the workbook's authentic saved term grade. Partial item evidence
    // is saved as evidence, never used to manufacture or back-calculate a grade.
    termGrade = importedValid ?? parseValidGrade(computed?.term_grade);

    if (termGrade === null) {
      if (importedRaw === null) counts.missing += 1;
      else counts.invalid += 1;
      continue;
    }

    const existing = existingByStudent.get(studentId) ?? null;
    const change = classifyGradeChange({ incoming: termGrade, existing });
    counts[change] += 1;

    computedMap.set(studentId, {
      term_sheet_id: targetSheet.id,
      student_id: studentId,
      ...(computed && parseValidGrade(computed.term_grade) !== null
        ? pickComputedForStorage(computed)
        : {
            term_grade: termGrade,
            description: termGradeDescription(termGrade),
          }),
      term_grade: termGrade,
      description: termGradeDescription(termGrade),
    });
  }

  if (duplicateStudentIds.size) {
    return {
      error: new Error(
        "The uploaded file contains the same learner more than once. Remove the duplicate rows and validate again."
      ),
      duplicateStudentIds: [...duplicateStudentIds],
      targetTerm: term,
      counts,
    };
  }

  if (!computedMap.size && !scoreMap.size) {
    return {
      error: new Error(
        `No valid Term ${term} grades were found for this class. Existing records were preserved.`
      ),
      targetTerm: term,
      counts,
    };
  }

  for (const { id, patch } of configPatches) {
    const { error } = await supabase.from("ecr_component_config").update(patch).eq("id", id).eq("term_sheet_id", targetSheet.id);
    if (error) return { error, targetTerm: term, counts };
  }
  const scoreUpserts = [...scoreMap.values()];
  for (let i = 0; i < scoreUpserts.length; i += WRITE_CHUNK) {
    const { error } = await supabase
      .from("ecr_component_scores")
      .upsert(scoreUpserts.slice(i, i + WRITE_CHUNK), {
        onConflict: "term_sheet_id,student_id,component,item_index",
      });
    if (error) return { error, targetTerm: term, counts };
  }

  const computedUpserts = [...computedMap.values()];
  for (let i = 0; i < computedUpserts.length; i += WRITE_CHUNK) {
    const { error } = await supabase
      .from("ecr_computed_grades")
      .upsert(computedUpserts.slice(i, i + WRITE_CHUNK), {
        onConflict: "term_sheet_id,student_id",
      });
    if (error) return { error, targetTerm: term, counts };
  }

  // Source is metadata only. Status is never changed here: the term remains a
  // draft until the teacher explicitly publishes it after review.
  const { error: sourceError } = await supabase
    .from("ecr_workbooks")
    .update({ source: "import" })
    .eq("id", workbook.id);
  if (sourceError) return { error: sourceError, targetTerm: term, counts };

  counts.written = new Set([...computedMap.keys(), ...scoreUpserts.map((row) => row.student_id)]).size;
  counts.scoresWritten = scoreUpserts.length;

  return {
    error: null,
    workbookId: workbook.id,
    termSheetId: targetSheet.id,
    targetTerm: term,
    counts,
    imported: counts.written,
  };
}
