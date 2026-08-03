import { getAttendanceAnalytics } from "@/lib/supabase/queries/attendance";
import {
  getAllLessonPlansForReview,
} from "@/lib/supabase/queries/lessonPlans";
import {
  resolveTeacherSessionForMonitoring,
} from "@/lib/supabase/queries/monitoring";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import {
  getCachedAdminRoster,
  getCachedAdminSchoolYears,
} from "@/lib/admin/adminRosterCache";
import { getCachedTeacherReportsBundle } from "@/lib/teacher/teacherRosterCache";

/**
 * Load everything needed for the Teacher Reports page in a small number of queries.
 * Classes / enrollments / grades / monitoring come from one roster fetch.
 * Lesson plans are loaded once for the authenticated teacher.
 */
export async function getTeacherReportsBundle({
  teacherId,
  schoolYear = null,
  quarter = null,
} = {}) {
  return getCachedTeacherReportsBundle({ teacherId, schoolYear, quarter });
}

export async function resolveTeacherReportsSession() {
  return resolveTeacherSessionForMonitoring();
}

/**
 * School-wide bundle for Admin Reports / Academic Records.
 * Roster is shared via adminRosterCache (Dashboard ↔ Academic Records).
 * Academic Records can skip SF2 attendance + lesson plans.
 */
export async function getAdminReportsBundle({
  schoolYear = null,
  quarter = null,
  includeAttendance = true,
  includeLessonPlans = true,
} = {}) {
  const auth = await requireAdmin("view admin reports");
  if (!auth.ok) {
    return { data: null, error: auth.error };
  }

  const quarterNumber =
    quarter !== null && quarter !== undefined && quarter !== ""
      ? Number(quarter)
      : null;
  const resolvedQuarter = Number.isFinite(quarterNumber) ? quarterNumber : null;

  const tasks = [
    getCachedAdminRoster({
      schoolYear: schoolYear || null,
      quarter: resolvedQuarter,
    }),
    getCachedAdminSchoolYears(),
  ];

  if (includeLessonPlans) {
    tasks.push(
      getAllLessonPlansForReview({
        schoolYear: schoolYear || null,
        quarter: resolvedQuarter,
      })
    );
  }
  if (includeAttendance) {
    tasks.push(getAttendanceAnalytics({ schoolYear: schoolYear || null }));
  }

  const results = await Promise.all(tasks);
  const rosterResult = results[0];
  const yearsResult = results[1];
  let cursor = 2;
  const lessonPlansResult = includeLessonPlans
    ? results[cursor++]
    : { data: [], error: null };
  const attendanceResult = includeAttendance
    ? results[cursor++]
    : { data: null, error: null };

  if (rosterResult.error) {
    return { data: null, error: rosterResult.error };
  }
  if (lessonPlansResult.error) {
    return { data: null, error: lessonPlansResult.error };
  }
  if (yearsResult.error) {
    return { data: null, error: yearsResult.error };
  }

  const schoolYears = yearsResult.data ?? [];

  return {
    data: {
      ...(rosterResult.data ?? {
        classes: [],
        enrollments: [],
        grades: [],
        monitoringRecords: [],
      }),
      lessonPlans: lessonPlansResult.data ?? [],
      attendance: attendanceResult.error ? null : attendanceResult.data,
      attendanceError: attendanceResult.error?.message ?? null,
      schoolYears,
      profile: auth.profile,
    },
    error: null,
  };
}
