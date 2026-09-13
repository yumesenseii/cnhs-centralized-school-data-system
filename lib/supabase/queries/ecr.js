import { createClient } from "@/lib/supabase/client";
import { getEcrTemplateForSubject } from "@/lib/ecr/constants";
import {
  computeLearnerRow,
  computeFinalFromTerms,
  pickComputedForStorage,
  termGradeDescription,
} from "@/lib/ecr/computeGrades";
import { upsertGrades } from "@/lib/supabase/queries/myClasses";

const supabase = createClient();

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
    .eq("school_year", schoolYear)
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
        .eq("school_year", schoolYear)
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
    supabase
      .from("ecr_component_scores")
      .select("student_id, component, item_index, raw_score")
      .eq("term_sheet_id", termSheetId),
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

/**
 * Save draft scores + computed rows for one term sheet.
 */
export async function saveEcrTermSheet({
  termSheetId,
  config = [],
  studentScores = {},
  publish = false,
  classMeta = {},
} = {}) {
  if (!termSheetId) {
    return { data: null, error: new Error("Term sheet id is required.") };
  }

  const configRows = mapConfigRows(config);

  if (configRows.length) {
    for (const row of configRows) {
      if (!row.id) continue;
      const { error } = await supabase
        .from("ecr_component_config")
        .update({
          highest_possible_score: row.highest_possible_score,
          component_weight: row.component_weight,
          item_label: row.item_label,
        })
        .eq("id", row.id);
      if (error) return { data: null, error };
    }
  }

  const scoreUpserts = [];
  const computedUpserts = [];

  for (const [studentId, scoresByKey] of Object.entries(studentScores)) {
    for (const cfg of configRows) {
      const key = `${cfg.component}:${cfg.item_index}`;
      if (!(key in scoresByKey)) continue;
      const raw = scoresByKey[key];
      scoreUpserts.push({
        term_sheet_id: termSheetId,
        student_id: studentId,
        component: cfg.component,
        item_index: cfg.item_index,
        raw_score: raw === "" || raw === null || raw === undefined ? null : Number(raw),
      });
    }

    const computed = computeLearnerRow(scoresByKey, configRows);
    computedUpserts.push({
      term_sheet_id: termSheetId,
      student_id: studentId,
      ...pickComputedForStorage(computed),
    });
  }

  if (scoreUpserts.length) {
    const { error } = await supabase
      .from("ecr_component_scores")
      .upsert(scoreUpserts, {
        onConflict: "term_sheet_id,student_id,component,item_index",
      });
    if (error) return { data: null, error };
  }

  if (computedUpserts.length) {
    const { error } = await supabase
      .from("ecr_computed_grades")
      .upsert(computedUpserts, { onConflict: "term_sheet_id,student_id" });
    if (error) return { data: null, error };
  }

  const status = publish ? "published" : "draft";
  const { error: termStatusError } = await supabase
    .from("ecr_term_sheets")
    .update({ status })
    .eq("id", termSheetId);
  if (termStatusError) return { data: null, error: termStatusError };

  if (publish && classMeta?.classId && classMeta?.subjectId && classMeta?.schoolYear) {
    const sync = await syncEcrTermToGrades({
      termSheetId,
      classId: classMeta.classId,
      subjectId: classMeta.subjectId,
      schoolYear: classMeta.schoolYear,
      term: classMeta.term,
    });
    if (sync.error) return { data: null, error: sync.error };
  }

  if (publish) {
    await supabase
      .from("ecr_workbooks")
      .update({ status: "published" })
      .eq("id", classMeta.workbookId);
  }

  return { data: { saved: computedUpserts.length, status }, error: null };
}

export async function syncEcrTermToGrades({
  termSheetId,
  classId,
  subjectId,
  schoolYear,
  term,
  siblingClassMap = {},
} = {}) {
  const { data: computed, error } = await supabase
    .from("ecr_computed_grades")
    .select("student_id, term_grade")
    .eq("term_sheet_id", termSheetId);

  if (error) return { error };

  const quarter = Number(term);
  const targetClassId = siblingClassMap[quarter] ?? classId;

  const gradeRows = (computed ?? [])
    .filter((row) => row.term_grade !== null && row.term_grade !== undefined)
    .map((row) => ({
      student_id: row.student_id,
      class_id: targetClassId,
      subject_id: subjectId,
      quarter,
      final_grade: Number(row.term_grade),
      school_year: schoolYear,
    }));

  if (!gradeRows.length) return { error: null, count: 0 };

  const result = await upsertGrades(gradeRows);
  return { error: result.error, count: result.count ?? gradeRows.length };
}

/**
 * Sync AVE (quarter 4) from term computed grades.
 */
export async function syncEcrAveToGrades({
  workbookId,
  classId,
  subjectId,
  schoolYear,
  studentTermGrades = {},
  siblingClassMap = {},
} = {}) {
  const gradeRows = [];
  for (const [studentId, terms] of Object.entries(studentTermGrades)) {
    const final = computeFinalFromTerms([
      terms[1],
      terms[2],
      terms[3],
    ]);
    if (final === null) continue;
    gradeRows.push({
      student_id: studentId,
      class_id: siblingClassMap[4] ?? classId,
      subject_id: subjectId,
      quarter: 4,
      final_grade: final,
      school_year: schoolYear,
    });
  }

  if (!gradeRows.length) return { error: null, count: 0 };
  const result = await upsertGrades(gradeRows);
  if (result.error) return { error: result.error, count: 0 };

  await supabase
    .from("ecr_workbooks")
    .update({ status: "published" })
    .eq("id", workbookId);

  return { error: null, count: result.count ?? gradeRows.length };
}

/**
 * After ECR Excel import, bootstrap workbook with term grades (raw scores optional).
 */
export async function syncEcrFromImport({
  classItem,
  teacherId,
  learners = [],
  termClassMap = new Map(),
} = {}) {
  const classId = classItem?.id;
  const schoolYear = classItem?.schoolYear ?? classItem?.school_year;
  const subjectId = classItem?.subjectId ?? classItem?.subject_id;
  if (!classId || !schoolYear || !teacherId) {
    return { error: new Error("Missing class metadata for ECR sync.") };
  }

  const wb = await getOrCreateEcrWorkbook({
    classId,
    schoolYear,
    teacherId,
    subjectName: classItem?.subject ?? classItem?.subjectName ?? null,
    source: "import",
  });
  if (wb.error || !wb.data) return { error: wb.error };

  const workbook = wb.data;
  let termSheets = workbook.ecr_term_sheets ?? [];

  if (!termSheets.length) {
    const termPayload = [1, 2, 3].map((term) => ({
      workbook_id: workbook.id,
      term,
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

  for (const sheet of termSheets) {
    const term = Number(sheet.term);
    let { data: configRows, error: configError } = await supabase
      .from("ecr_component_config")
      .select("*")
      .eq("term_sheet_id", sheet.id)
      .order("sort_order");
    if (configError) return { error: configError };

    if (!configRows?.length) {
      const created = await insertDefaultConfig(
        sheet.id,
        classItem?.subject ?? classItem?.subjectName ?? null
      );
      if (created.error) return { error: created.error };
      const reloaded = await supabase
        .from("ecr_component_config")
        .select("*")
        .eq("term_sheet_id", sheet.id)
        .order("sort_order");
      if (reloaded.error) return { error: reloaded.error };
      configRows = reloaded.data ?? [];
    }

    const mappedConfig = mapConfigRows(configRows);
    const layout = (learners ?? []).find(
      (learner) =>
        learner.component_layout?.[term] ||
        learner.component_layout?.[String(term)]
    )?.component_layout?.[term] ??
      (learners ?? []).find((learner) => learner.component_layout?.[String(term)])
        ?.component_layout?.[String(term)];

    if (layout?.hps && mappedConfig.length) {
      for (const cfg of mappedConfig) {
        const importedHps = Number(layout.hps?.[cfg.component]?.[cfg.item_index - 1]);
        const importedWeight = Number(layout.weights?.[cfg.component]);
        const patch = {};
        if (Number.isFinite(importedHps) && importedHps > 0) {
          patch.highest_possible_score = importedHps;
        }
        if (Number.isFinite(importedWeight) && importedWeight > 0) {
          patch.component_weight = importedWeight;
        }
        if (!Object.keys(patch).length || !cfg.id) continue;
        const { error } = await supabase
          .from("ecr_component_config")
          .update(patch)
          .eq("id", cfg.id);
        if (error) return { error };
        Object.assign(cfg, patch);
      }
    }

    const scoreUpserts = [];
    const computedUpserts = [];

    for (const learner of learners) {
      const studentId = learner.student_id ?? learner.studentId;
      if (!studentId) continue;

      const rawScores =
        learner.component_scores?.[term] ??
        learner.component_scores?.[String(term)] ??
        null;
      const hasRawScores =
        rawScores &&
        Object.values(rawScores).some(
          (value) => value !== "" && value !== null && value !== undefined
        );

      const importedTermGrade = Number(
        learner.term_grades?.[term] ??
          learner.term_grades?.[String(term)] ??
          (term === 1 ? learner.quarterly_grade : null)
      );
      const hasImportedTerm = Number.isFinite(importedTermGrade);

      if (hasRawScores) {
        for (const cfg of mappedConfig) {
          const key = `${cfg.component}:${cfg.item_index}`;
          if (!(key in rawScores)) continue;
          const raw = rawScores[key];
          scoreUpserts.push({
            term_sheet_id: sheet.id,
            student_id: studentId,
            component: cfg.component,
            item_index: cfg.item_index,
            raw_score:
              raw === "" || raw === null || raw === undefined
                ? null
                : Number(raw),
          });
        }

        const computed = computeLearnerRow(rawScores, mappedConfig);
        computedUpserts.push({
          term_sheet_id: sheet.id,
          student_id: studentId,
          ...pickComputedForStorage({
            ...computed,
            term_grade:
              computed.term_grade != null
                ? computed.term_grade
                : hasImportedTerm
                  ? importedTermGrade
                  : null,
            description: termGradeDescription(
              computed.term_grade != null
                ? computed.term_grade
                : hasImportedTerm
                  ? importedTermGrade
                  : null
            ),
          }),
        });
        continue;
      }

      if (!hasImportedTerm) continue;
      computedUpserts.push({
        term_sheet_id: sheet.id,
        student_id: studentId,
        term_grade: importedTermGrade,
        description: termGradeDescription(importedTermGrade),
      });
    }

    if (scoreUpserts.length) {
      const { error } = await supabase.from("ecr_component_scores").upsert(
        scoreUpserts,
        { onConflict: "term_sheet_id,student_id,component,item_index" }
      );
      if (error) return { error };
    }

    if (computedUpserts.length) {
      const { error } = await supabase
        .from("ecr_computed_grades")
        .upsert(computedUpserts, { onConflict: "term_sheet_id,student_id" });
      if (error) return { error };
    }

    await syncEcrTermToGrades({
      termSheetId: sheet.id,
      classId: termClassMap.get(term) ?? classId,
      subjectId,
      schoolYear,
      term,
      siblingClassMap: Object.fromEntries(termClassMap),
    });
  }

  await supabase
    .from("ecr_workbooks")
    .update({ status: "published", source: "import" })
    .eq("id", workbook.id);

  return { error: null, workbookId: workbook.id };
}
