/**
 * Lesson plan review → owning teacher's notification.
 * Only the teacher who submitted the plan is notified.
 */

import { buildLessonPlanNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
