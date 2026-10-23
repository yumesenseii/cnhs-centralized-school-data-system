import { notifyEClassImport } from "@/lib/notifications/eclassNotifications";
import {
  ensureClassStudents,
  getCurrentTeacherSession,
  getTeacherClasses,
  invalidateTeacherClassesCache,
} from "@/lib/supabase/queries/myClasses";
import { parseTermNumber, isAcademicTermNumber } from "@/lib/academic/termLabels";
import {
  ensureAllTermSiblingClasses,
  syncSiblingClassRosters,
} from "@/lib/academic/siblingTermClasses";
import {
  syncEcrFromImport,
  validateEcrImportAccess,
} from "@/lib/supabase/queries/ecr";
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

  const siblingsResult = await getTeacherClasses(teacherId, { bypassCache: true });
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
 * P0-04C:
 * - Only confirmed, teacher-validated rows are processed.
 * - Students are linked to class_students only.
 * - Official grades are written by the ECR publish path (Review Draft → Publish),
 *   not silently during upload.
 * - Term access and class assignment are enforced server-side.
 */
export async function importConfirmedEClassGrades({
  classItem,
  validatedLearners = [],
  onProgress,
}) {
  if (!classItem?.id) throw new Error("Please select a class.");

  // P0-04E: the teacher explicitly picks the grading term in the upload
  // dialog. The import targets the sibling class for that term (same
  // teacher + subject + section + school year) so cross-term writes are
  // impossible.
  const requestedTerm = parseTermNumber(
    classItem.targetTerm ?? classItem.quarter
  );
  if (!isAcademicTermNumber(requestedTerm)) {
    throw new Error(
      "Choose Term 1, Term 2, or Term 3 for this import. Quarterly Final / Average is published from the ECR Summary instead."
    );
  }
  classItem = { ...classItem, quarter: requestedTerm, targetTerm: requestedTerm };

  const totalStart = now();
  const stamp = Date.now().toString(36);

  const confirmed = validatedLearners.filter(
    (l) =>
      l.included &&
      l.matchedStudent?.id &&
      l.status !== "WRONG_SECTION" &&
      l.status !== "UNMATCHED" &&
      l.status !== "AMBIGUOUS" &&
      l.status !== "DUPLICATE_ROW" &&
      l.changeType !== "invalid" &&
      !(l.published && l.changeType === "conflicting")
  );

  if (!confirmed.length) {
    throw new Error("No valid learners were selected for import.");
  }

  onProgress?.({ percent: 15, label: "Verifying teacher session..." });

  const session = await getCurrentTeacherSession();
  if (session.error || !session.data) {
    throw session.error ?? new Error("Teacher session required for import.");
  }

  onProgress?.({ percent: 30, label: "Preparing term classes..." });
  const setup = await prepareSiblingClasses(classItem, session);
  const { subjectId, schoolYear, termClassMap, siblingClassIds, teacherId } = setup;

  // Route the import to the sibling class that owns the selected term so the
  // DB class row's quarter always matches the requested term.
  const targetClassId = termClassMap.get(requestedTerm) ?? classItem.id;

  onProgress?.({ percent: 75, label: "Saving draft to E-Record..." });

  const learnersWithIds = confirmed.map((l) => ({
    ...l,
    student_id: l.matchedStudent.id,
  }));

  let syncResult = null;
  try {
    syncResult = await syncEcrFromImport({
      classItem: {
        ...classItem,
        id: targetClassId,
        school_year: schoolYear,
        subject_id: subjectId,
        subjectId,
        teacherId: classItem.teacherId ?? classItem.teacher_id ?? teacherId,
      },
      teacherId: classItem.teacherId ?? classItem.teacher_id ?? teacherId,
      learners: learnersWithIds,
      termClassMap,
    });
    if (syncResult?.error) throw syncResult.error;
  } catch (ecrErr) {
    throw ecrErr?.error ?? ecrErr;
  }

  const result = {
    imported: confirmed.length,
    gradesUpserted: 0,
    draftSaved: syncResult?.imported ?? confirmed.length,
    targetTerm: syncResult?.targetTerm ?? null,
    skippedRows: validatedLearners.length - confirmed.length,
    siblingClasses: siblingClassIds.length,
    counts: syncResult?.counts ?? null,
    totalMs: Math.round(now() - totalStart),
  };

  await notifyEClassImport({
    classItem,
    outcome: "imported",
    summary: result,
    stamp,
  });

  const tid = classItem.teacherId ?? classItem.teacher_id ?? teacherId;
  invalidateTeacherClassesCache(tid);

  return result;
}

