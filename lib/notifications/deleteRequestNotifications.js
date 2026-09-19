import {
  buildDeleteRequestNotification,
} from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  listActiveAdminProfileIds,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

export const notifyDeleteRequestCreated = safeNotify(async function notify({
  request,
  actorProfileId = null,
}) {
  if (!request?.id) return;
  const adminIds = await listActiveAdminProfileIds();
  for (const recipientProfileId of adminIds) {
    const payload = buildDeleteRequestNotification({
      recipientProfileId,
      actorProfileId,
      request,
      kind: "created",
    });
    if (payload) await createNotificationsSafely([payload]);
  }
}, "delete request created");

export const notifyDeleteRequestReviewed = safeNotify(async function notify({
  request,
  approved,
  actorProfileId = null,
}) {
  if (!request?.id) return;
  const teacherId = request.requester_teacher_id;
  const recipient = teacherId
    ? await resolveProfileIdForTeacher(teacherId)
    : { data: request.requester_profile_id };
  const recipientProfileId = recipient.data ?? request.requester_profile_id;
  if (!recipientProfileId) return;

  const payload = buildDeleteRequestNotification({
    recipientProfileId,
    actorProfileId,
    request,
    kind: approved ? "approved" : "rejected",
  });
  if (payload) await createNotificationsSafely([payload]);
}, "delete request reviewed");
