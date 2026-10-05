/**
 * Lesson plan notifications:
 * - Teacher: status changes after School Principal review
 * - Admins: new submit / resubmit awaiting review
 */

import {
  buildLessonPlanAdminSubmitNotification,
  buildLessonPlanNotification,
} from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  getCurrentProfile,
  listActiveAdminProfileIds,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function teacherNameFromRow(row) {
  const teacher = unwrap(row?.teachers);
  if (!teacher) return null;
  return (
    [teacher.first_name, teacher.middle_name, teacher.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || null
  );
}

function planSummary(row) {
  const classRow = unwrap(row.classes);
  const section = unwrap(classRow?.sections);
  const subject = unwrap(classRow?.subjects);

  return {
    id: row.id,
    title: row.lesson_title ?? "Lesson plan",
    subject: subject?.subject_name ?? null,
    gradeLevel: section?.grade_level ?? null,
    section: section?.section_name ?? null,
    schoolYear: row.school_year ?? classRow?.school_year ?? null,
    quarter: row.quarter ?? classRow?.quarter ?? null,
    weekCovered: row.week_covered ?? null,
    teacherName: teacherNameFromRow(row),
  };
}

/**
 * @param {object} input
 * @param {object} input.plan Row returned by the lesson plan review mutation.
 * @param {"Under Review"|"Approved"|"Needs Revision"} input.status
 */
export const notifyLessonPlanStatus = safeNotify(async function notify({
  plan,
  status,
  remarks = null,
  actorProfileId = null,
}) {
  if (!plan?.id || !plan?.teacher_id) return;

  const recipient = await resolveProfileIdForTeacher(plan.teacher_id);
  if (recipient.error || !recipient.data) return;

  const payload = buildLessonPlanNotification({
    recipientProfileId: recipient.data,
    actorProfileId,
    plan: planSummary(plan),
    status,
    remarks,
  });

  if (payload) await createNotificationsSafely([payload]);
}, "lesson plan");

/**
 * Notify all active School Principals / admins when a teacher submits or resubmits.
 * One insert per admin — same pattern as teacher status notify (single recipient).
 * @param {"submitted"|"resubmitted"} input.kind
 */
export const notifyLessonPlanSubmitted = safeNotify(async function notify({
  plan,
  kind = "submitted",
  actorProfileId = null,
  stamp = null,
  teacherDisplayName = null,
}) {
  if (!plan?.id) return;

  const adminIds = await listActiveAdminProfileIds();
  if (!adminIds.length) {
    console.warn("[notifications] no active admin profiles to notify");
    return;
  }

  const summary = planSummary(plan);
  if (!summary.teacherName && teacherDisplayName) {
    summary.teacherName = teacherDisplayName;
  }

  let actorId = actorProfileId;
  if (!actorId) {
    const actor = await getCurrentProfile();
    actorId = actor.data?.id ?? null;
    if (!summary.teacherName && actor.data?.full_name) {
      summary.teacherName = actor.data.full_name;
    }
  }

  // Always stamp so each submit/resubmit is unique per admin recipient.
  const eventStamp = stamp ?? String(plan.submitted_at || Date.now());

  for (const recipientProfileId of adminIds) {
    const payload = buildLessonPlanAdminSubmitNotification({
      recipientProfileId,
      actorProfileId: actorId,
      plan: summary,
      kind,
      stamp: eventStamp,
    });
    if (payload) await createNotificationsSafely([payload]);
  }
}, "lesson plan submitted");
