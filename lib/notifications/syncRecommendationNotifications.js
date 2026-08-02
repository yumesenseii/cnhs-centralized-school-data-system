/**
 * Turns the teacher's monitoring roster into personal action items.
 *
 * The roster is already produced by recommendationService.generate() through
 * buildMonitoringRoster(), so subject policy (ARAL for English / Filipino only)
 * and the Classroom Remedial threshold are applied upstream. This module only
 * decides which of those results deserve a notification.
 */

import { RECOMMENDATION } from "@/lib/monitoring/recommendations";
import {
  buildAralScreeningNotification,
  buildClassroomRemedialNotification,
  buildEClassMissingGradesNotification,
} from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import { createNotificationsSafely } from "@/lib/supabase/queries/notifications";

/** Prevents a redundant write on every client-side navigation. */
const syncedSignatures = new Set();

function signature(profileId, payloads) {
  return `${profileId}|${payloads
    .map((item) => item.dedupeKey)
    .sort()
    .join(",")}`;
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
    // ARAL is student-level and language-subject only. `aralEligible` and
    // `recommendation` both come from the recommendation service.
    if (!learner.aralEligible) continue;
    if (learner.recommendation !== RECOMMENDATION.ARAL) continue;

    const classInfo = classById.get(learner.classId);
    if (!classInfo) continue;

    const payload = buildAralScreeningNotification({
      recipientProfileId: profileId,
      learner: { studentId: learner.studentId, name: learner.name },
      classInfo,
    });
    if (payload) payloads.push(payload);
  }

  return payloads;
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

  if (!payloads.length) return { data: [], error: null };

  const key = signature(profileId, payloads);
  if (syncedSignatures.has(key)) return { data: [], error: null };
  syncedSignatures.add(key);

  return createNotificationsSafely(payloads);
}, "recommendation sync");
