/**
 * Turns the teacher's monitoring roster into personal action items.
 *
 * The roster is already produced by recommendationService.generate() through
 * buildMonitoringRoster(), so subject policy (ARAL for English / Filipino only),
 * ARAL-only-when-grade-<75, and the Classroom Remedial threshold are applied
 * upstream. This module only decides which of those results deserve a
 * notification — and marks stale ARAL alerts read when grades recover.
 *
 * Class-level alerts (Classroom Remedial / missing grades):
 * - Skip Final (quarter 4) — computed average, not a teaching term.
 * - One alert per class family (subject + section + SY), using the latest
 *   instructional term (Terms 1–3) so All Terms does not spam Q1–Q3 duplicates.
 */

import { parseTermNumber } from "@/lib/academic/termLabels";
import { RECOMMENDATION } from "@/lib/monitoring/recommendations";
import { dedupeKeys, NOTIFICATION_TYPE } from "@/lib/notifications/notificationConstants";
import {
  buildAralScreeningNotification,
  buildClassroomRemedialNotification,
  buildEClassMissingGradesNotification,
} from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  markNotificationsReadByDedupeKeys,
} from "@/lib/supabase/queries/notifications";
import { classReportFolderKey } from "@/lib/reports/groupClassFolders";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";

/** Prevents a redundant write on every client-side navigation. */
const syncedSignatures = new Set();

function signature(profileId, payloads, staleKeys = []) {
  return `${profileId}|${payloads
    .map((item) => item.dedupeKey)
    .sort()
    .join(",")}|stale:${[...staleKeys].sort().join(",")}`;
}

function isBelowPassingGrade(learner) {
  if (learner?.belowPassing === true) return true;
  const g = Number(learner?.classSubjectGrade ?? learner?.generalAverage);
  return Number.isFinite(g) && g < PASSING_GRADE;
}

function isInstructionalTerm(row) {
  return parseTermNumber(row?.quarter) !== 4;
}

function termRank(row) {
  return parseTermNumber(row?.quarter) ?? 0;
}

/**
 * Group instructional classes by family (Terms 1–3 only).
 * @returns {Map<string, object[]>} sorted high→low term within each family
 */
function instructionalFamilies(classSummaries = []) {
  const groups = new Map();
  for (const row of classSummaries) {
    if (!isInstructionalTerm(row)) continue;
    const key = classReportFolderKey({
      schoolYear: row.schoolYear,
      gradeSection: row.gradeSection,
      className: row.gradeSection,
      subject: row.subject,
      teacherName: row.teacherName,
    });
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  for (const [key, list] of groups) {
    groups.set(
      key,
      [...list].sort((a, b) => termRank(b) - termRank(a))
    );
  }
  return groups;
}

export function buildRecommendationNotificationPayloads({
  profileId,
  students = [],
  classSummaries = [],
}) {
  if (!profileId) return [];

  const payloads = [];
  const families = instructionalFamilies(classSummaries);

  for (const siblings of families.values()) {
    // One remedial alert per family — latest instructional term that qualifies.
    const remedialSource = siblings.find(
      (row) => row.classroomRemedialRecommended
    );
    if (remedialSource) {
      const payload = buildClassroomRemedialNotification({
        recipientProfileId: profileId,
        classSummary: remedialSource,
      });
      if (payload) payloads.push(payload);
    }

    // Missing grades only when no Term 1–3 sibling has grades yet.
    const anyGraded = siblings.some((row) => Number(row.gradedStudentCount) > 0);
    if (!anyGraded && siblings[0]) {
      const payload = buildEClassMissingGradesNotification({
        recipientProfileId: profileId,
        classInfo: siblings[0],
      });
      if (payload) payloads.push(payload);
    }
  }

  const classById = new Map(classSummaries.map((item) => [item.id, item]));

  for (const learner of students) {
    // ARAL is student-level, language-subject only, and only when grade < 75.
    if (!learner.aralEligible) continue;
    if (learner.recommendation !== RECOMMENDATION.ARAL) continue;
    if (!isBelowPassingGrade(learner)) continue;

    const classInfo = classById.get(learner.classId);
    if (!classInfo) continue;
    if (!isInstructionalTerm(classInfo)) continue;

    const payload = buildAralScreeningNotification({
      recipientProfileId: profileId,
      learner: {
        studentId: learner.studentId,
        name: learner.name,
        classSubjectGrade: learner.classSubjectGrade,
        generalAverage: learner.generalAverage,
      },
      classInfo,
    });
    if (payload) payloads.push(payload);
  }

  return payloads;
}

/**
 * Dedupe keys for language-class learners who no longer qualify for ARAL
 * (e.g. grade raised to ≥75) so prior alerts can be marked read.
 */
export function buildStaleAralDedupeKeys({
  students = [],
  classSummaries = [],
  activePayloads = [],
} = {}) {
  const activeKeys = new Set(
    activePayloads
      .filter((p) => p.type === NOTIFICATION_TYPE.ARAL_SCREENING)
      .map((p) => p.dedupeKey)
      .filter(Boolean)
  );

  const classById = new Map(classSummaries.map((item) => [item.id, item]));
  const stale = [];

  for (const learner of students) {
    if (!learner.aralEligible || !learner.studentId || !learner.classId) continue;
    const classInfo = classById.get(learner.classId);
    if (!classInfo) continue;

    const key = dedupeKeys.aral({
      studentId: learner.studentId,
      classId: classInfo.id,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
    });
    if (!activeKeys.has(key)) stale.push(key);
  }

  return [...new Set(stale)];
}

/**
 * Fire-and-forget. Never throws, so a monitoring refresh cannot fail because
 * of notification bookkeeping.
 */
export const syncRecommendationNotifications = safeNotify(async function sync({
  profileId,
  students = [],
  classSummaries = [],
}) {
  const payloads = buildRecommendationNotificationPayloads({
    profileId,
    students,
    classSummaries,
  });

  const staleKeys = buildStaleAralDedupeKeys({
    students,
    classSummaries,
    activePayloads: payloads,
  });

  if (staleKeys.length) {
    await markNotificationsReadByDedupeKeys(profileId, staleKeys);
  }

  if (!payloads.length) return { data: [], error: null };

  const key = signature(profileId, payloads, staleKeys);
  if (syncedSignatures.has(key)) return { data: [], error: null };
  syncedSignatures.add(key);

  return createNotificationsSafely(payloads);
}, "recommendation sync");
