/**
 * E-Class Record import outcomes → the importing teacher's notification.
 * The importer is always the recipient, so no teacher lookup is needed.
 */

import { buildEClassImportNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  getCurrentProfile,
} from "@/lib/supabase/queries/notifications";

function classInfoFrom(classItem) {
  const quarter =
    Number(classItem?.quarter) ||
    Number(String(classItem?.quarterLabel ?? "").replace(/\D/g, "")) ||
    null;

  return {
    id: classItem?.id ?? null,
    subject: classItem?.subject ?? null,
    gradeSection: classItem?.gradeSection ?? null,
    section: classItem?.section ?? null,
    schoolYear: classItem?.schoolYear ?? classItem?.school_year ?? null,
    quarter,
  };
}

/**
 * @param {object} input
 * @param {"imported"|"failed"} input.outcome
 * @param {string} input.stamp Distinguishes one upload attempt from the next.
 */
export const notifyEClassImport = safeNotify(async function notify({
  classItem,
  outcome,
  summary = {},
  reason = null,
  stamp = null,
}) {
  if (!classItem?.id) return;

  const profile = await getCurrentProfile();
  if (profile.error || !profile.data) return;

  const payload = buildEClassImportNotification({
    recipientProfileId: profile.data.id,
    outcome,
    classInfo: classInfoFrom(classItem),
    summary,
    reason,
    stamp,
  });

  if (payload) await createNotificationsSafely([payload]);
}, "e-class import");
