/**
 * ARAL facilitator assignment → assigned teacher's notification.
 */

import { buildAralFacilitatorAssignedNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

export const notifyAralFacilitatorAssigned = safeNotify(async function notify({
  assignment,
  actorProfileId = null,
  learnerName = null,
}) {
  if (!assignment?.id || !assignment?.facilitator_teacher_id) return;

  const recipient = await resolveProfileIdForTeacher(
    assignment.facilitator_teacher_id
  );
  if (recipient.error || !recipient.data) return;

  const payload = buildAralFacilitatorAssignedNotification({
    recipientProfileId: recipient.data,
    actorProfileId,
    assignment: {
      id: assignment.id,
      studentId: assignment.student_id,
      learnerName,
      stamp: String(Date.now()),
    },
  });

  if (payload) await createNotificationsSafely([payload]);
}, "aral facilitator assigned");
