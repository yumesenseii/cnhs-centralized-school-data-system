import { notifyEClassImport } from "@/lib/notifications/eclassNotifications";
import {
  ensureClassStudents,
  getCurrentTeacherSession,
  getTeacherClasses,
  upsertGrades,
} from "@/lib/supabase/queries/myClasses";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
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

async function prepareSiblingClasses(classItem, session) {
  const subjectId = classItem.subjectId ?? classItem.subject_id ?? null;
  const schoolYear = classItem.schoolYear ?? classItem.school_year ?? null;
  if (!subjectId) throw new Error("This class is missing a subject.");
  if (!schoolYear) throw new Error("This class is missing a school year.");

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

/**
 * Import confirmed, validated E-Record rows into the database.
 *
 * Rules:
 * - Only confirmed rows with a valid matchedStudent ID are processed.
 * - Does NOT create duplicate students.
 * - Does NOT alter students' official section assignment.
 * - Connects confirmed learners to class_students and upserts grades.
 */
export async function importConfirmedEClassGrades({
  classItem,
  validatedLearners = [],
  onProgress,
}) {
  if (!classItem?.id) throw new Error("Please select a class.");

  const totalStart = now();
  const stamp = Date.now().toString(36);

  // Filter only teacher-confirmed rows that have a resolved student ID
  const confirmed = validatedLearners.filter(
    (l) => l.included && l.matchedStudent?.id && l.status !== "WRONG_SECTION" && l.status !== "UNMATCHED"
  );

  if (!confirmed.length) {
    throw new Error("No valid learners were selected for import.");
  }

  const quarterNumber =
    parseTermNumber(classItem.quarter) ||
    parseTermNumber(classItem.currentQuarter) ||
    parseTermNumber(classItem.quarterLabel) ||
    1;

  onProgress?.({ percent: 15, label: "Verifying teacher session..." });

  const session = await getCurrentTeacherSession();
  if (session.error || !session.data) {
    throw session.error ?? new Error("Teacher session required for import.");
  }

  onProgress?.({ percent: 30, label: "Preparing term classes..." });
  const setup = await prepareSiblingClasses(classItem, session);
  const { subjectId, schoolYear, termClassMap, siblingClassIds, teacherId } = setup;

  onProgress?.({ percent: 50, label: "Linking learners to subject class..." });

  // 1. Link learners to class_students
  const links = [];
  for (const item of confirmed) {
    const studentId = item.matchedStudent.id;
    for (const classId of siblingClassIds) {
      links.push({ class_id: classId, student_id: studentId });
    }
  }

  const linked = await ensureClassStudents(links);
  if (linked.error) throw linked.error;

  onProgress?.({ percent: 70, label: "Saving academic grades..." });

  // 2. Build grade rows
  const gradeRows = [];
  for (const item of confirmed) {
    const studentId = item.matchedStudent.id;
    const termGrades = item.term_grades ?? {};
    const quarters = Object.keys(termGrades)
      .map((q) => Number(q))
      .filter((q) => Number.isFinite(q) && q >= 1 && q <= 4);

    const targetQuarters =
      quarters.length > 0
        ? quarters
        : parseRecordedGrade(item.quarterly_grade) !== null
          ? [quarterNumber]
          : [];

    for (const q of targetQuarters) {
      const finalGrade = parseRecordedGrade(
        termGrades[q] ?? (q === quarterNumber ? item.quarterly_grade : null)
      );
      if (finalGrade === null) continue;

      gradeRows.push({
        student_id: studentId,
        class_id: termClassMap.get(q) ?? classItem.id,
        subject_id: subjectId,
        quarter: q,
        final_grade: finalGrade,
        school_year: schoolYear,
      });
    }
  }

  const gradeResult = await upsertGrades(gradeRows);
  if (gradeResult.error) throw gradeResult.error;
  const gradesUpserted = gradeResult.count ?? gradeRows.length;

  onProgress?.({ percent: 90, label: "Syncing workbook records..." });

  // 3. Sync ECR workbook
  const learnersWithIds = confirmed.map((l) => ({
    ...l,
    student_id: l.matchedStudent.id,
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

  const result = {
    imported: confirmed.length,
    gradesUpserted,
    skippedRows: validatedLearners.length - confirmed.length,
    siblingClasses: siblingClassIds.length,
    totalMs: Math.round(now() - totalStart),
  };

  await notifyEClassImport({
    classItem,
    outcome: "imported",
    summary: result,
    stamp,
  });

  return result;
}
