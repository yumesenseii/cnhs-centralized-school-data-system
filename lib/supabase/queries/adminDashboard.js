import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import {
  getCachedAdminRoster,
  getCachedAdminSchoolYears,
} from "@/lib/admin/adminRosterCache";
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
 * Scoped to the latest school year to avoid loading every historical term.
 * Activity panels reuse roster data — no duplicate classes/monitoring fetches.
 */
export async function getAdminDashboardBundle() {
  const auth = await requireAdmin("view the admin dashboard");
  if (!auth.ok) {
    return { data: null, error: auth.error };
  }

  // Resolve active school year first so the heavy roster stays bounded.
  const yearsResult = await getCachedAdminSchoolYears();
  if (yearsResult.error) {
    return { data: null, error: yearsResult.error };
  }

  const schoolYear = yearsResult.data?.[0] ?? null;

  const [
    rosterResult,
    teachersCountResult,
    studentsCountResult,
    lessonPlansResult,
  ] = await Promise.all([
    getCachedAdminRoster({ schoolYear, quarter: null }),
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

  const roster = rosterResult.data ?? {
    classes: [],
    enrollments: [],
    grades: [],
    monitoringRecords: [],
  };

  const lessonPlans = lessonPlansResult.error
    ? []
    : (lessonPlansResult.data ?? []).map((row) => ({
        ...row,
        teachers: unwrap(row.teachers),
      }));

  // Derive activity from the roster payload — avoids a second classes /
  // monitoring_records round-trip that used to duplicate the waterfall.
  const monitoringRecords = [...(roster.monitoringRecords ?? [])]
    .sort(
      (a, b) =>
        new Date(b.created_at || b.observation_date || 0).getTime() -
        new Date(a.created_at || a.observation_date || 0).getTime()
    )
    .slice(0, 10)
    .map((row) => ({
      ...row,
      teachers: unwrap(row.teachers),
      students: unwrap(row.students),
    }));

  const recentClasses = [...(roster.classes ?? [])]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, 10)
    .map((row) => ({
      ...row,
      teachers: unwrap(row.teachers),
      subjects: unwrap(row.subjects),
      sections: unwrap(row.sections),
    }));

  return {
    data: {
      profile: auth.profile,
      schoolYear,
      roster,
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
