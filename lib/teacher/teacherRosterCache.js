/**
 * Shared teacher roster + reports bundle cache.
 * Dashboard ↔ Monitoring ↔ Reports share one fetch + preferLocal score.
 */

import {
  getTeacherMonitoringRoster,
} from "@/lib/supabase/queries/monitoring";
import { getTeacherLessonPlans } from "@/lib/supabase/queries/lessonPlans";
import { buildMonitoringRoster } from "@/lib/teacher/monitoringMappers";
import {
  cacheKey,
  invalidateTtlCache,
  withTtlCache,
} from "@/lib/cache/ttlCache";

const PREFIX = "teacher:";

export function invalidateTeacherRosterCache() {
  invalidateTtlCache(PREFIX);
}

export async function getCachedTeacherRoster({
  teacherId,
  schoolYear = null,
  quarter = null,
} = {}) {
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }
  const key = cacheKey([PREFIX + "roster", teacherId, schoolYear, quarter]);
  return withTtlCache(key, async () => {
    const result = await getTeacherMonitoringRoster({
      teacherId,
      schoolYear,
      quarter,
    });
    if (result.error) return { data: null, error: result.error };
    return {
      data: result.data ?? {
        classes: [],
        enrollments: [],
        grades: [],
        monitoringRecords: [],
      },
      error: null,
    };
  });
}

export async function getCachedTeacherLessonPlans(teacherId) {
  if (!teacherId) {
    return { data: [], error: new Error("Teacher id is required.") };
  }
  const key = cacheKey([PREFIX + "lessonPlans", teacherId]);
  return withTtlCache(key, async () => getTeacherLessonPlans(teacherId));
}

export async function getCachedBuiltTeacherRoster(
  rosterPayload = {},
  { teacherId = null, schoolYear = null, quarter = null } = {}
) {
  const key = cacheKey([
    PREFIX + "built",
    teacherId,
    schoolYear,
    quarter,
  ]);
  return withTtlCache(key, async () =>
    buildMonitoringRoster({
      ...rosterPayload,
      preferLocalRecommendations: true,
    })
  );
}

/**
 * Teacher reports/dashboard bundle — one roster + lesson plans (no duplicate classes fetch).
 */
export async function getCachedTeacherReportsBundle({
  teacherId,
  schoolYear = null,
  quarter = null,
} = {}) {
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }

  const key = cacheKey([
    PREFIX + "bundle",
    teacherId,
    schoolYear,
    quarter,
  ]);

  return withTtlCache(key, async () => {
    const [rosterResult, lessonPlansResult] = await Promise.all([
      getCachedTeacherRoster({ teacherId, schoolYear, quarter }),
      getCachedTeacherLessonPlans(teacherId),
    ]);

    if (rosterResult.error) {
      return { data: null, error: rosterResult.error };
    }
    if (lessonPlansResult.error) {
      return { data: null, error: lessonPlansResult.error };
    }

    const roster = rosterResult.data ?? {
      classes: [],
      enrollments: [],
      grades: [],
      monitoringRecords: [],
    };

    return {
      data: {
        ...roster,
        lessonPlans: lessonPlansResult.data ?? [],
        // Roster classes already carry school_year / quarter for filter pickers.
        allClasses: roster.classes ?? [],
      },
      error: null,
    };
  });
}
