import { notifyEClassImport } from "@/lib/notifications/eclassNotifications";
import {
  createStudents,
  ensureClassStudents,
  findStudentsByNumbers,
  getCurrentTeacherSession,
  getTeacherClasses,
  upsertGrades,
} from "@/lib/supabase/queries/myClasses";
import { splitLearnerName } from "@/lib/teacher/myClassesMappers";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import { parseTermNumber } from "@/lib/academic/termLabels";
import {
  ensureAllTermSiblingClasses,
  syncSiblingClassRosters,
} from "@/lib/academic/siblingTermClasses";
import { syncEcrFromImport } from "@/lib/supabase/queries/ecr";
import { createClient } from "@/lib/supabase/client";
import { cacheKey, invalidateTtlCache } from "@/lib/cache/ttlCache";

function now() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

/**
 * Sibling All-Terms classes: same teacher + subject + section + school year.
 * Returns Map<quarterNumber, classId> including the current class.
 */
function buildSiblingTermClassMap(classItem, teacherClasses = []) {
  const subjectId = classItem.subjectId ?? classItem.subject_id ?? null;
  const sectionId = classItem.sectionId ?? classItem.section_id ?? null;
  const schoolYear = classItem.schoolYear ?? classItem.school_year ?? null;
  const teacherId = classItem.teacherId ?? classItem.teacher_id ?? null;

  const map = new Map();
  const selfQuarter =
    parseTermNumber(classItem.quarter) ||
    parseTermNumber(classItem.currentQuarter) ||
    parseTermNumber(classItem.quarterLabel) ||
    1;
  map.set(selfQuarter, classItem.id);

  for (const row of teacherClasses) {
    if (teacherId && row.teacher_id && row.teacher_id !== teacherId) continue;
    if (subjectId && row.subject_id !== subjectId) continue;
    if (sectionId && row.section_id !== sectionId) continue;
    if (schoolYear && row.school_year !== schoolYear) continue;

    const q = parseTermNumber(row.quarter);
    if (!q) continue;
    map.set(q, row.id);
  }

  return map;
}

/**
 * Import DepEd JHS E-Class Record into an existing assigned class.
 * Parser runs in a Web Worker; Supabase writes stay on the main thread.
 *
 * When the teacher has All-Terms sibling classes, one upload links the roster
 * to every sibling and writes Term 1–3 + Final grades to the matching class_id.
 */
export async function importEClassRecord(options) {
  const stamp = Date.now().toString(36);

  try {
    const result = await runEClassImport(options);
    await notifyEClassImport({
      classItem: options.classItem,
      outcome: "imported",
      summary: {
        imported: result.imported,
        gradesUpserted: result.gradesUpserted,
        skippedExistingStudents: result.skippedExistingStudents,
        siblingClasses: result.siblingClasses,
      },
      stamp,
    });
    return result;
  } catch (error) {
    await notifyEClassImport({
      classItem: options.classItem,
      outcome: "failed",
      reason: error?.message ?? null,
      stamp,
    });
    throw error;
  }
}

async function prepareSiblingClasses(classItem, session) {
  const subjectId = classItem.subjectId ?? classItem.subject_id ?? null;
  const schoolYear = classItem.schoolYear ?? classItem.school_year ?? null;
  if (!subjectId) {
    throw new Error("Assigned class is missing a subject reference.");
  }
  if (!schoolYear) {
    throw new Error("Assigned class is missing a school year.");
  }

  const teacherId = session.data.teacherId;
  const sectionId = classItem.sectionId ?? classItem.section_id ?? null;
  const supabase = createClient();
  const family = { teacherId, subjectId, sectionId, schoolYear };

  const ensured = await ensureAllTermSiblingClasses(supabase, family);
  if (ensured.error) throw ensured.error;

  const synced = await syncSiblingClassRosters(supabase, family);
  if (synced.error) throw synced.error;

  invalidateTtlCache(cacheKey(["teacher:classes", teacherId]));

  const siblingsResult = await getTeacherClasses(teacherId);
  if (siblingsResult.error) throw siblingsResult.error;

  const termClassMap = buildSiblingTermClassMap(
    { ...classItem, teacherId },
    siblingsResult.data ?? []
  );
  for (const [quarter, classId] of ensured.map.entries()) {
    if (!termClassMap.has(quarter)) termClassMap.set(quarter, classId);
  }

  return {
    subjectId,
    schoolYear,
    teacherId,
    sectionId,
    termClassMap,
    siblingClassIds: [...new Set(termClassMap.values())],
  };
}

async function runEClassImport({ classItem, file, arrayBuffer, onProgress }) {
  if (!classItem?.id) {
    throw new Error("An assigned class is required for import.");
  }

  const totalStart = now();
  const quarterNumber =
    parseTermNumber(classItem.quarter) ||
    parseTermNumber(classItem.currentQuarter) ||
    parseTermNumber(classItem.quarterLabel) ||
    1;

  onProgress?.({
    current: 0,
    total: 1,
    percent: 10,
    label: "Preparing assigned classes...",
  });

  const setupPromise = (async () => {
    const session = await getCurrentTeacherSession();
    if (session.error || !session.data) {
      throw session.error ?? new Error("Teacher session required for import.");
    }
    if (
      classItem.teacherId &&
      session.data.teacherId &&
      classItem.teacherId !== session.data.teacherId
    ) {
      throw new Error("You can only import records into classes assigned to you.");
    }
    return prepareSiblingClasses(classItem, session);
  })();

  const parsePromise = parseEClassRecord(file, {
    assignedClass: classItem,
    teacherName: classItem.teacher,
    quarter: quarterNumber,
    includeGrades: true,
    arrayBuffer,
    onProgress: ({ label, percent }) => {
      const mapped = Math.round(12 + ((percent ?? 20) / 100) * 43);
      const isOpening =
        String(label ?? "").toLowerCase() === "opening workbook...";
      onProgress?.({
        current: 0,
        total: 1,
        percent: Math.min(55, mapped),
        label: isOpening
          ? "Reading grades from workbook..."
          : label || "Reading grades from workbook...",
      });
    },
  });

  const [parsed, setup] = await Promise.all([parsePromise, setupPromise]);

  if (!parsed.ok) {
    throw new Error(parsed.error || "E-Class Record validation failed.");
  }

  const learners = parsed.learners ?? [];
  if (!learners.length) {
    throw new Error("No learners found to import.");
  }

  const {
    subjectId,
    schoolYear,
    sectionId,
    termClassMap,
    siblingClassIds,
    teacherId,
  } = setup;
  const total = learners.length;

  onProgress?.({
    current: 0,
    total,
    percent: 60,
    label:
      siblingClassIds.length > 1
        ? `Saving learners into ${siblingClassIds.length} term classes...`
        : "Saving learners...",
  });

  const supabaseStart = now();
  const numbers = learners.map((learner) => learner.student_number);
  const existingResult = await findStudentsByNumbers(numbers);
  if (existingResult.error) throw existingResult.error;

  const byNumber = new Map(
    (existingResult.data ?? []).map((row) => [
      String(row.student_number),
      row.id,
    ])
  );
  let skippedExistingStudents = 0;
  const toCreate = [];

  for (const learner of learners) {
    if (byNumber.has(String(learner.student_number))) {
      skippedExistingStudents += 1;
      continue;
    }
    const names = splitLearnerName(learner.full_name);
    toCreate.push({
      student_number: learner.student_number,
      first_name: names.first_name,
      middle_name: names.middle_name,
      last_name: names.last_name,
      sex: learner.gender ?? null,
      section_id: sectionId,
    });
  }

  if (toCreate.length) {
    const created = await createStudents(toCreate);
    if (created.error) throw created.error;
    for (const row of created.data ?? []) {
      byNumber.set(String(row.student_number), row.id);
    }
  }

  const studentIds = learners.map((learner) =>
    byNumber.get(String(learner.student_number))
  );
  if (studentIds.some((id) => !id)) {
    throw new Error("Failed to resolve every learner after insert.");
  }

  onProgress?.({
    current: total,
    total,
    percent: 72,
    label: "Linking class rosters...",
  });

  const links = [];
  for (const studentId of studentIds) {
    for (const classId of siblingClassIds) {
      links.push({ class_id: classId, student_id: studentId });
    }
  }
  const linked = await ensureClassStudents(links);
  if (linked.error) throw linked.error;

  onProgress?.({
    current: total,
    total,
    percent: 82,
    label: "Saving term grades...",
  });

  const gradeRows = [];
  for (let index = 0; index < learners.length; index += 1) {
    const learner = learners[index];
    const studentId = studentIds[index];
    const termGrades = learner.term_grades ?? {};
    const quarters = Object.keys(termGrades)
      .map((q) => Number(q))
      .filter((q) => Number.isFinite(q) && q >= 1 && q <= 4);

    const targetQuarters =
      quarters.length > 0
        ? quarters
        : Number.isFinite(Number(learner.quarterly_grade))
          ? [quarterNumber]
          : [];

    for (const quarter of targetQuarters) {
      const finalGrade =
        termGrades[quarter] ??
        (quarter === quarterNumber ? learner.quarterly_grade : null) ??
        null;
      if (finalGrade === null || finalGrade === undefined) continue;
      if (!Number.isFinite(Number(finalGrade))) continue;

      gradeRows.push({
        student_id: studentId,
        class_id: termClassMap.get(quarter) ?? classItem.id,
        subject_id: subjectId,
        quarter,
        final_grade: Number(finalGrade),
        school_year: schoolYear,
      });
    }
  }

  const gradeResult = await upsertGrades(gradeRows);
  if (gradeResult.error) throw gradeResult.error;
  const gradesUpserted = gradeResult.count ?? gradeRows.length;

  const learnersWithIds = learners.map((learner, index) => ({
    ...learner,
    student_id: studentIds[index],
  }));

  try {
    await syncEcrFromImport({
      classItem,
      teacherId: classItem.teacherId ?? classItem.teacher_id ?? teacherId,
      learners: learnersWithIds,
      termClassMap,
    });
  } catch (ecrErr) {
    console.warn("[E-Class Import] ECR workbook sync:", ecrErr?.message ?? ecrErr);
  }

  const imported = learners.length;

  const supabaseInsertMs = Math.round(now() - supabaseStart);
  const totalMs = Math.round(now() - totalStart);
  const timings = {
    ...(parsed.timings ?? {}),
    supabaseInsertMs,
    totalMs,
  };

  console.group("[E-Class Import] Profile (import)");
  console.log(`Workbook opened: ${timings.workbookOpenedMs ?? 0}ms`);
  console.log(`INPUT DATA parsed: ${timings.inputDataParsedMs ?? 0}ms`);
  console.log(`TERM parsed: ${timings.termParsedMs ?? 0}ms`);
  console.log(`Supabase insert: ${supabaseInsertMs}ms`);
  console.log(`Sibling term classes: ${siblingClassIds.length}`);
  console.log(`Total import time: ${totalMs}ms`);
  console.groupEnd();

  onProgress?.({
    current: total,
    total,
    percent: 100,
    label: "Import complete.",
  });

  // Bust after enrollments/grades land so My Classes KPIs refresh without F5.
  const tid = classItem.teacherId ?? classItem.teacher_id ?? teacherId;
  if (tid) {
    invalidateTtlCache(cacheKey(["teacher:classes", tid]));
  }

  return {
    imported,
    skippedExistingStudents,
    gradesUpserted,
    gradesPersisted: gradesUpserted > 0,
    siblingClasses: siblingClassIds.length,
    gradeCounts: parsed.gradeCounts ?? {},
    metadata: parsed.metadata,
    validation: parsed.validation,
    grades: parsed.grades ?? [],
    timings,
    upload: null,
  };
}
