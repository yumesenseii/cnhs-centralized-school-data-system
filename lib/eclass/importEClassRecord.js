import { notifyEClassImport } from "@/lib/notifications/eclassNotifications";
import {
  createStudent,
  ensureClassStudent,
  findStudentByNumber,
  getCurrentTeacherSession,
  getTeacherClasses,
  upsertGrade,
} from "@/lib/supabase/queries/myClasses";
import { splitLearnerName } from "@/lib/teacher/myClassesMappers";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import { parseTermNumber } from "@/lib/academic/termLabels";

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

async function runEClassImport({ classItem, file, onProgress }) {
  if (!classItem?.id) {
    throw new Error("An assigned class is required for import.");
  }

  const totalStart = now();

  onProgress?.({
    current: 0,
    total: 1,
    percent: 5,
    label: "Opening workbook...",
  });

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

  const teacherName = [
    session.data.teacher.first_name,
    session.data.teacher.middle_name,
    session.data.teacher.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const subjectId = classItem.subjectId ?? classItem.subject_id ?? null;
  const schoolYear = classItem.schoolYear ?? classItem.school_year ?? null;
  const quarterNumber =
    parseTermNumber(classItem.quarter) ||
    parseTermNumber(classItem.currentQuarter) ||
    parseTermNumber(classItem.quarterLabel) ||
    1;

  if (!subjectId) {
    throw new Error("Assigned class is missing a subject reference.");
  }
  if (!schoolYear) {
    throw new Error("Assigned class is missing a school year.");
  }

  const teacherId = session.data.teacherId;
  const siblingsResult = await getTeacherClasses(teacherId);
  if (siblingsResult.error) throw siblingsResult.error;

  const termClassMap = buildSiblingTermClassMap(
    {
      ...classItem,
      teacherId,
    },
    siblingsResult.data ?? []
  );
  const siblingClassIds = [...new Set(termClassMap.values())];

  const parsed = await parseEClassRecord(file, {
    assignedClass: classItem,
    teacherName,
    quarter: quarterNumber,
    includeGrades: true,
    onProgress: ({ label, percent }) => {
      onProgress?.({
        current: 0,
        total: 1,
        percent: percent ?? 20,
        label,
      });
    },
  });

  if (!parsed.ok) {
    throw new Error(parsed.error || "E-Class Record validation failed.");
  }

  const learners = parsed.learners ?? [];
  if (!learners.length) {
    throw new Error("No learners found to import.");
  }

  onProgress?.({
    current: 0,
    total: learners.length,
    percent: 65,
    label:
      siblingClassIds.length > 1
        ? `Importing learners into ${siblingClassIds.length} term classes...`
        : "Importing learners...",
  });

  let imported = 0;
  let skippedExistingStudents = 0;
  let gradesUpserted = 0;
  const sectionId = classItem.sectionId ?? classItem.section_id ?? null;
  const total = learners.length;
  const studentIds = [];
  const supabaseStart = now();

  for (let index = 0; index < learners.length; index += 1) {
    const learner = learners[index];
    const mid = index + 1;
    onProgress?.({
      current: mid,
      total,
      percent: Math.round(65 + (mid / total) * 15),
      label: "Importing learners...",
    });

    let studentId = null;
    const existing = await findStudentByNumber(learner.student_number);

    if (existing.error) throw existing.error;

    if (existing.data) {
      studentId = existing.data.id;
      skippedExistingStudents += 1;
    } else {
      const names = splitLearnerName(learner.full_name);
      const created = await createStudent({
        student_number: learner.student_number,
        first_name: names.first_name,
        middle_name: names.middle_name,
        last_name: names.last_name,
        sex: learner.gender ?? null,
        section_id: sectionId,
      });
      if (created.error) throw created.error;
      studentId = created.data.id;
    }

    for (const classId of siblingClassIds) {
      const link = await ensureClassStudent(classId, studentId);
      if (link.error) throw link.error;
    }

    studentIds.push(studentId);
    imported += 1;
  }

  onProgress?.({
    current: total,
    total,
    percent: 82,
    label: "Saving term grades...",
  });

  for (let index = 0; index < learners.length; index += 1) {
    const learner = learners[index];
    const studentId = studentIds[index];
    if (!studentId) continue;

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

      const targetClassId =
        termClassMap.get(quarter) ?? classItem.id;

      const gradeResult = await upsertGrade({
        student_id: studentId,
        class_id: targetClassId,
        subject_id: subjectId,
        quarter,
        final_grade: Number(finalGrade),
        school_year: schoolYear,
      });
      if (gradeResult.error) throw gradeResult.error;
      gradesUpserted += 1;
    }

    onProgress?.({
      current: index + 1,
      total,
      percent: Math.round(82 + ((index + 1) / total) * 15),
      label: "Saving term grades...",
    });
  }

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
