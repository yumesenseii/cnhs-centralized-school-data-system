/**
 * Teacher sends class report to HT → notify all active admins.
 */

import { buildClassReportSubmittedToHtNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  getCurrentProfile,
  listActiveAdminProfileIds,
} from "@/lib/supabase/queries/notifications";

export const notifyClassReportSubmittedToHt = safeNotify(async function notify({
  classId,
  classLabel = null,
  schoolYear = "",
  quarter = "",
  teacherName = null,
  actorProfileId = null,
} = {}) {
  if (!classId) return;

  const adminIds = await listActiveAdminProfileIds();
  if (!adminIds.length) return;

  let actorId = actorProfileId;
  let displayTeacher = teacherName;
  if (!actorId || !displayTeacher) {
    const actor = await getCurrentProfile();
    actorId = actorId || actor.data?.id || null;
    displayTeacher = displayTeacher || actor.data?.full_name || null;
  }

  const submittedAtLabel = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const stamp = String(Date.now());

  for (const recipientProfileId of adminIds) {
    const payload = buildClassReportSubmittedToHtNotification({
      recipientProfileId,
      actorProfileId: actorId,
      report: {
        classId,
        classLabel,
        schoolYear,
        quarter,
        teacherName: displayTeacher,
        submittedAtLabel,
        stamp,
      },
    });
    if (payload) await createNotificationsSafely([payload]);
  }
}, "class report to HT");
