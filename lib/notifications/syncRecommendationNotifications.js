/**
 * Turns the teacher's monitoring roster into personal action items.
 *
 * The roster is already produced by recommendationService.generate() through
 * buildMonitoringRoster(), so subject policy (ARAL for English / Filipino only),
 * ARAL-only-when-grade-<75, and the Classroom Remedial threshold are applied
 * upstream. This module only decides which of those results deserve a
 * notification — and marks stale ARAL alerts read when grades recover.
 */

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

export function buildRecommendationNotificationPayloads({
  profileId,
  students = [],
  classSummaries = [],
}) {
  if (!profileId) return [];

  const payloads = [];

  for (const classSummary of classSummaries) {
    if (classSummary.classroomRemedialRecommended) {
      const payload = buildClassroomRemedialNotification({
        recipientProfileId: profileId,
        classSummary,
      });
      if (payload) payloads.push(payload);
    }

    if (!classSummary.gradedStudentCount) {
      const payload = buildEClassMissingGradesNotification({
        recipientProfileId: profileId,
        classInfo: classSummary,
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
