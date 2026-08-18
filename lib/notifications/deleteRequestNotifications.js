import { buildDeleteRequestNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

async function listAdminProfileIds() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);
  if (error) return [];
  return (data ?? []).map((row) => row.id).filter(Boolean);
}

export const notifyDeleteRequestCreated = safeNotify(async function notify({
  request,
  actorProfileId = null,
}) {
  if (!request?.id) return;
  const adminIds = await listAdminProfileIds();
  const payloads = adminIds.map((recipientProfileId) =>
    buildDeleteRequestNotification({
      recipientProfileId,
      actorProfileId,
      request,
      kind: "created",
    })
  );
  await createNotificationsSafely(payloads.filter(Boolean));
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
