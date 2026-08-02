import { getAttendanceAnalytics } from "@/lib/supabase/queries/attendance";
import {
  getAllLessonPlansForReview,
  getTeacherLessonPlans,
} from "@/lib/supabase/queries/lessonPlans";
import {
  getAdminMonitoringRoster,
  getTeacherMonitoringRoster,
  resolveTeacherSessionForMonitoring,
} from "@/lib/supabase/queries/monitoring";
import { getTeacherClasses } from "@/lib/supabase/queries/myClasses";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import { createClient } from "@/lib/supabase/client";

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
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }

  const [rosterResult, lessonPlansResult, allClassesResult] = await Promise.all([
    getTeacherMonitoringRoster({ teacherId, schoolYear, quarter }),
    getTeacherLessonPlans(teacherId),
    getTeacherClasses(teacherId),
  ]);

  if (rosterResult.error) {
    return { data: null, error: rosterResult.error };
  }
  if (lessonPlansResult.error) {
    return { data: null, error: lessonPlansResult.error };
  }
  if (allClassesResult.error) {
    return { data: null, error: allClassesResult.error };
  }

  return {
    data: {
      ...(rosterResult.data ?? {
        classes: [],
        enrollments: [],
        grades: [],
        monitoringRecords: [],
      }),
      lessonPlans: lessonPlansResult.data ?? [],
      allClasses: allClassesResult.data ?? [],
    },
    error: null,
  };
}

export async function resolveTeacherReportsSession() {
  return resolveTeacherSessionForMonitoring();
}

/**
 * School-wide bundle for Admin Reports analytics + charts.
 */
export async function getAdminReportsBundle({
  schoolYear = null,
  quarter = null,
} = {}) {
  const auth = await requireAdmin("view admin reports");
  if (!auth.ok) {
    return { data: null, error: auth.error };
  }

  const supabase = createClient();
  const quarterNumber =
    quarter !== null && quarter !== undefined && quarter !== ""
      ? Number(quarter)
      : null;

  const [rosterResult, lessonPlansResult, attendanceResult, yearsResult] =
    await Promise.all([
      getAdminMonitoringRoster({
        schoolYear: schoolYear || null,
        quarter: Number.isFinite(quarterNumber) ? quarterNumber : null,
      }),
      getAllLessonPlansForReview({
        schoolYear: schoolYear || null,
        quarter: Number.isFinite(quarterNumber) ? quarterNumber : null,
      }),
      getAttendanceAnalytics({ schoolYear: schoolYear || null }),
      supabase.from("classes").select("school_year, quarter"),
    ]);

  if (rosterResult.error) {
    return { data: null, error: rosterResult.error };
  }
  if (lessonPlansResult.error) {
    return { data: null, error: lessonPlansResult.error };
  }

  const yearRows = yearsResult.data ?? [];
  const schoolYears = [
    ...new Set(yearRows.map((row) => row.school_year).filter(Boolean)),
  ].sort((a, b) => String(b).localeCompare(String(a)));

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
