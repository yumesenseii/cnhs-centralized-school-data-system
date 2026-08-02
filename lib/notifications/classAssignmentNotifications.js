/**
 * Admin class assignment changes → assigned teacher's notification.
 */

import { buildClassAssignmentNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Normalize a `classes` row (with embedded subject/section) for the builder. */
export function assignmentSummary(row) {
  const section = unwrap(row?.sections);
  const subject = unwrap(row?.subjects);

  return {
    classId: row?.id ?? null,
    subject: subject?.subject_name ?? null,
    gradeLevel: section?.grade_level ?? null,
    section: section?.section_name ?? null,
    schoolYear: row?.school_year ?? null,
    quarter: row?.quarter ?? null,
  };
}

/**
 * @param {object} input
 * @param {"created"|"updated"|"removed"} input.action
 * @param {string} input.teacherId teachers.id of the affected teacher.
 * @param {object} input.assignment Output of assignmentSummary().
 */
export const notifyClassAssignmentChange = safeNotify(async function notify({
  action,
  teacherId,
  assignment,
  actorProfileId = null,
}) {
  if (!teacherId || !assignment?.classId) return;

  const recipient = await resolveProfileIdForTeacher(teacherId);
  if (recipient.error || !recipient.data) return;

  const payload = buildClassAssignmentNotification({
    recipientProfileId: recipient.data,
    actorProfileId,
    action,
    assignment,
  });

  if (payload) await createNotificationsSafely([payload]);
}, "class assignment");
