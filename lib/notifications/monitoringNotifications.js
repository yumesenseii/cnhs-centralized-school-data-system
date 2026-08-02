/**
 * Monitoring record saves → the owning teacher's follow-up action items.
 * Scoped to the teacher on the record, so only their own classes are covered.
 */

import { buildMonitoringNotification } from "@/lib/notifications/notificationEvents";
import { safeNotify } from "@/lib/notifications/safeNotify";
import {
  createNotificationsSafely,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function learnerName(student) {
  if (!student) return "This learner";
  return (
    [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "This learner"
  );
}

/**
 * @param {object} row Row returned by createMonitoringRecord / updateMonitoringRecord.
 */
export const notifyMonitoringRecord = safeNotify(async function notify(row) {
  if (!row?.id || !row?.teacher_id) return;

  const recipient = await resolveProfileIdForTeacher(row.teacher_id);
  if (recipient.error || !recipient.data) return;

  const student = unwrap(row.students);
  const classRow = unwrap(row.classes);
  const section = unwrap(classRow?.sections);
  const subject = unwrap(classRow?.subjects);

  const payload = buildMonitoringNotification({
    recipientProfileId: recipient.data,
    record: { id: row.id, monitoringStatus: row.monitoring_status },
    learner: {
      studentId: row.student_id,
      name: learnerName(student),
    },
    classInfo: {
      id: row.class_id,
      subject: subject?.subject_name ?? null,
      gradeSection:
        section?.grade_level != null
          ? `Grade ${section.grade_level} ${section.section_name ?? ""}`.trim()
          : (section?.section_name ?? null),
      schoolYear: row.school_year,
      quarter: row.quarter,
    },
  });

  if (payload) await createNotificationsSafely([payload]);
}, "monitoring record");
