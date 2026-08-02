import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import { getAdminMonitoringRoster } from "@/lib/supabase/queries/monitoring";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function teacherLabel(teacher) {
  if (!teacher) return "A teacher";
  const name = [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "A teacher";
}

/**
 * School-wide bundle for the Admin Overview dashboard.
 * One roster fetch + small count/activity queries (no N+1).
 */
export async function getAdminDashboardBundle() {
  const auth = await requireAdmin("view the admin dashboard");
  if (!auth.ok) {
    return { data: null, error: auth.error };
  }

  const [
    rosterResult,
    teachersCountResult,
    studentsCountResult,
    lessonPlansResult,
    monitoringResult,
    classesResult,
  ] = await Promise.all([
    getAdminMonitoringRoster(),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase
      .from("lesson_plans")
      .select(
        `
        id,
        lesson_title,
        status,
        submitted_at,
        updated_at,
        teachers (
          id,
          first_name,
          middle_name,
          last_name
        )
      `
      )
      .order("submitted_at", { ascending: false })
      .limit(10),
    supabase
      .from("monitoring_records")
      .select(
        `
        id,
        monitoring_status,
        created_at,
        updated_at,
        teachers (
          id,
          first_name,
          middle_name,
          last_name
        ),
        students (
          id,
          first_name,
          middle_name,
          last_name
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("classes")
      .select(
        `
        id,
        school_year,
        quarter,
        created_at,
        teachers (
          id,
          first_name,
          middle_name,
          last_name
        ),
        subjects (
          id,
          subject_name
        ),
        sections (
          id,
          section_name,
          grade_level
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (rosterResult.error) {
    return { data: null, error: rosterResult.error };
  }
  if (teachersCountResult.error) {
    return { data: null, error: teachersCountResult.error };
  }
  if (studentsCountResult.error) {
    return { data: null, error: studentsCountResult.error };
  }

  // Activity sources are best-effort — missing optional tables should not fail the dashboard.
  const lessonPlans = lessonPlansResult.error
    ? []
    : (lessonPlansResult.data ?? []).map((row) => ({
        ...row,
        teachers: unwrap(row.teachers),
      }));

  const monitoringRecords = monitoringResult.error
    ? []
    : (monitoringResult.data ?? []).map((row) => ({
        ...row,
        teachers: unwrap(row.teachers),
        students: unwrap(row.students),
      }));

  const recentClasses = classesResult.error
    ? []
    : (classesResult.data ?? []).map((row) => ({
        ...row,
        teachers: unwrap(row.teachers),
        subjects: unwrap(row.subjects),
        sections: unwrap(row.sections),
      }));

  return {
    data: {
      profile: auth.profile,
      roster: rosterResult.data ?? {
        classes: [],
        enrollments: [],
        grades: [],
        monitoringRecords: [],
      },
      teacherCount: teachersCountResult.count ?? 0,
      studentCount: studentsCountResult.count ?? 0,
      activitySources: {
        lessonPlans,
        monitoringRecords,
        recentClasses,
      },
    },
    error: null,
  };
}

export { teacherLabel };
