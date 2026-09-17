/**
 * Shared teacher roster + reports bundle cache.
 * Dashboard ↔ Monitoring ↔ Reports share one fetch + RF /predict_batch.
 */

import {
  getTeacherMonitoringRoster,
} from "@/lib/supabase/queries/monitoring";
import { getTeacherLessonPlans } from "@/lib/supabase/queries/lessonPlans";
import { buildMonitoringRoster, enrichMonitoringRosterWithRetry, stripRosterGenerateInputs } from "@/lib/teacher/monitoringMappers";
import { isFullyFallbackRoster } from "@/lib/monitoring/recommendationSource";
import {
  cacheKey,
  invalidateTtlCache,
  peekTtlInflight,
  readTtlCache,
  withTtlCache,
  writeTtlCache,
} from "@/lib/cache/ttlCache";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";

const PREFIX = "teacher:";

export function invalidateTeacherRosterCache() {
  invalidateTtlCache(PREFIX);
}

/** Patch in-memory TTL roster after a class-report save. Does not bust or rebuild RF. */
export function patchCachedTeacherRosterAfterGradeSave(
  teacherId,
  { students, updates = [] } = {}
) {
  if (!teacherId) return;

  if (Array.isArray(students)) {
    const builtKey = cacheKey([PREFIX + "built", teacherId, null, null]);
    const built = readTtlCache(builtKey);
    if (built && typeof built === "object") {
      writeTtlCache(builtKey, { ...built, students });
    }
  }

  if (!updates.length) return;

  const rosterKey = cacheKey([PREFIX + "roster", teacherId, null, null]);
  const roster = readTtlCache(rosterKey);
  const grades = roster?.data?.grades;
  if (!Array.isArray(grades)) return;

  const nextGrades = grades.map((row) => {
    const hit = updates.find(
      (update) =>
        update.student_id === row.student_id &&
        update.class_id === row.class_id &&
        Number(update.quarter) === Number(row.quarter) &&
        (!update.school_year ||
          !row.school_year ||
          update.school_year === row.school_year) &&
        (!update.subject_id || update.subject_id === row.subject_id)
    );
    if (!hit) return row;
    return { ...row, final_grade: parseRecordedGrade(hit.final_grade) };
  });

  writeTtlCache(rosterKey, {
    ...roster,
    data: { ...roster.data, grades: nextGrades },
  });
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

export async function getCachedTeacherRosterShell(
  rosterPayload = {},
  { teacherId = null, schoolYear = null, quarter = null } = {}
) {
  const key = cacheKey([
    PREFIX + "shell",
    teacherId,
    schoolYear,
    quarter,
  ]);
  return withTtlCache(key, async () =>
    buildMonitoringRoster({
      ...rosterPayload,
      skipRecommendations: true,
    })
  );
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
  return withTtlCache(
    key,
    async () => {
      const shell = await getCachedTeacherRosterShell(rosterPayload, {
        teacherId,
        schoolYear,
        quarter,
      });
      return enrichMonitoringRosterWithRetry(shell);
    },
    undefined,
    (roster) =>
      !roster?.predictionsPending && !isFullyFallbackRoster(roster)
  );
}

export async function loadBuiltTeacherRoster(
  rosterPayload = {},
  { teacherId = null, schoolYear = null, quarter = null } = {},
  { onShell } = {}
) {
  const key = cacheKey([
    PREFIX + "built",
    teacherId,
    schoolYear,
    quarter,
  ]);
  const cached = readTtlCache(key);
  if (cached) return cached;

  const alreadyStarted = Boolean(peekTtlInflight(key));
  const shell = await getCachedTeacherRosterShell(rosterPayload, {
    teacherId,
    schoolYear,
    quarter,
  });
  const cachedAfterShell = readTtlCache(key);
  if (cachedAfterShell) return cachedAfterShell;

  if (!alreadyStarted) {
    try {
      await onShell?.(stripRosterGenerateInputs(shell));
    } catch (err) {
      console.warn("[teacher roster] shell paint failed", err);
    }
  }
  const cachedAfterPaint = readTtlCache(key);
  if (cachedAfterPaint) return cachedAfterPaint;

  return getCachedBuiltTeacherRoster(rosterPayload, {
    teacherId,
    schoolYear,
    quarter,
  });
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
