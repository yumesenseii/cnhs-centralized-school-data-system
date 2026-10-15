/**
 * ARAL Referral & Review Handoff Notifications.
 * Routes submission events to Principal inboxes and review decisions back to teachers.
 */

import {
  buildAralReferralSubmittedToAdminNotification,
  buildAralReviewDecisionToTeacherNotification,
} from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  listActiveAdminProfileIds,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

/**
 * Notify all active admins/principals when a teacher submits an ARAL referral.
 */
export const notifyAralReferralSubmitted = safeNotify(async function notify({
  studentId,
  classId = null,
  studentName = "Learner",
  subjectName = "Language Subject",
  quarter = 1,
  schoolYear = "SY 2026-2027",
  actorProfileId = null,
}) {
  if (!studentId) return;

  const adminIds = await listActiveAdminProfileIds();
  if (!adminIds.length) return;

  const stamp = String(Date.now());
  const payloads = adminIds
    .map((adminId) =>
      buildAralReferralSubmittedToAdminNotification({
        recipientProfileId: adminId,
        actorProfileId,
        studentId,
        classId,
        studentName,
        subjectName,
        quarter,
        schoolYear,
        stamp,
      })
    )
    .filter(Boolean);

  if (payloads.length) {
    await createNotificationsSafely(payloads);
  }
}, "aral referral submitted");

/**
 * Notify the referring teacher when the Principal approves or returns an ARAL referral.
 */
export const notifyAralReviewDecision = safeNotify(async function notify({
  studentId,
  classId = null,
  studentName = "Learner",
  status, // 'approved' | 'returned'
  reviewNote = null,
  quarter = 1,
  schoolYear = "SY 2026-2027",
  teacherId = null,
  recipientProfileId = null,
  actorProfileId = null,
}) {
  if (!studentId || !status) return;

  let targetProfileId = recipientProfileId;
  if (!targetProfileId && teacherId) {
    const res = await resolveProfileIdForTeacher(teacherId);
    targetProfileId = res?.data;
  }
  if (!targetProfileId) return;

  const stamp = String(Date.now());
  const payload = buildAralReviewDecisionToTeacherNotification({
    recipientProfileId: targetProfileId,
    actorProfileId,
    studentId,
    classId,
    studentName,
    status,
    reviewNote,
    quarter,
    schoolYear,
    stamp,
  });

  if (payload) {
    await createNotificationsSafely([payload]);
  }
}, "aral review decision");
