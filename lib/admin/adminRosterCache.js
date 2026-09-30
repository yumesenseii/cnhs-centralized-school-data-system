/**
 * Shared in-memory cache for admin school-wide roster fetches.
 * Dedupes Strict Mode double-mount + Dashboard ↔ Academic Records ↔ Monitoring.
 * Keys must match across Overview / Academic Records / Reports / Monitoring.
 */

import { getAdminMonitoringRoster } from "@/lib/supabase/queries/monitoring";
import { createClient } from "@/lib/supabase/client";
import {
  buildMonitoringRoster,
  enrichMonitoringRosterWithRetry,
  stripRosterGenerateInputs,
} from "@/lib/teacher/monitoringMappers";
import { isFullyFallbackRoster } from "@/lib/monitoring/recommendationSource";
import {
  cacheKey,
  invalidateTtlCache,
  peekTtlInflight,
  readTtlCache,
  withTtlCache,
} from "@/lib/cache/ttlCache";

const PREFIX = "admin:";

/** Normalize quarter so "" / undefined / null all share the same key segment. */
function normalizeQuarter(quarter) {
  if (quarter === null || quarter === undefined || quarter === "") return null;
  const n = Number(quarter);
  return Number.isFinite(n) ? n : null;
}

export function invalidateAdminRosterCache() {
  invalidateTtlCache(PREFIX);
}

/**
 * Distinct school years from classes (cached).
 */
export async function getCachedAdminSchoolYears() {
  return withTtlCache(cacheKey([PREFIX + "years"]), async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("classes")
        .select("school_year, quarter");
      if (error) throw error;
      const rawYears = (data ?? []).map((row) => row.school_year).filter(Boolean);
      const combined = Array.from(new Set(["SY 2026-2027", "SY 2025-2026", ...rawYears]));
      const schoolYears = combined.sort((a, b) => String(b).localeCompare(String(a)));
      return { data: schoolYears, rows: data ?? [], error: null };
    } catch (err) {
      console.warn("[admin roster] getCachedAdminSchoolYears fetch error, using default school years:", err?.message || err);
      const fallbackYears = ["SY 2026-2027", "SY 2025-2026"];
      return { data: fallbackYears, rows: [], error: null };
    }
  });
}

/**
 * Cached admin monitoring roster (classes / enrollments / grades / monitoring).
 * Key shape: admin:roster|{schoolYear|all}|{quarter|all}
 */
export async function getCachedAdminRoster({
  schoolYear = null,
  quarter = null,
} = {}) {
  const year = schoolYear || null;
  const q = normalizeQuarter(quarter);
  const key = cacheKey([PREFIX + "roster", year, q]);
  return withTtlCache(key, async () => {
    const result = await getAdminMonitoringRoster({
      schoolYear: year,
      quarter: q,
    });
    if (result.error) {
      return { data: null, error: result.error };
    }
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

/**
 * Cached buildMonitoringRoster using trained RF /predict_batch.
 * Default scope matches Overview + Academic Records (All Terms).
 */
export async function getCachedMonitoringRosterShell(
  rosterPayload = {},
  { schoolYear = null, quarter = null, scope = "default" } = {}
) {
  const year = schoolYear || null;
  const q = normalizeQuarter(quarter);
  const key = cacheKey([PREFIX + "shell", year, q, scope]);
  return withTtlCache(key, async () =>
    buildMonitoringRoster({
      ...rosterPayload,
      skipRecommendations: true,
    })
  );
}

export async function getCachedBuiltMonitoringRoster(
  rosterPayload = {},
  { schoolYear = null, quarter = null, scope = "default" } = {}
) {
  const year = schoolYear || null;
  const q = normalizeQuarter(quarter);
  const key = cacheKey([PREFIX + "built", year, q, scope]);
  return withTtlCache(
    key,
    async () => {
      const shell = await getCachedMonitoringRosterShell(rosterPayload, {
        schoolYear: year,
        quarter: q,
        scope,
      });
      return enrichMonitoringRosterWithRetry(shell);
    },
    undefined,
    (roster) =>
      !roster?.predictionsPending && !isFullyFallbackRoster(roster)
  );
}

/** Paint grades shell immediately; share one in-flight RF batch across pages. */
export async function loadBuiltMonitoringRoster(
  rosterPayload = {},
  { schoolYear = null, quarter = null, scope = "default" } = {},
  { onShell } = {}
) {
  const year = schoolYear || null;
  const q = normalizeQuarter(quarter);
  const rfKey = cacheKey([PREFIX + "built", year, q, scope]);
  const cached = readTtlCache(rfKey);
  if (cached) return cached;

  const alreadyStarted = Boolean(peekTtlInflight(rfKey));
  const shell = await getCachedMonitoringRosterShell(rosterPayload, {
    schoolYear: year,
    quarter: q,
    scope,
  });
  const cachedAfterShell = readTtlCache(rfKey);
  if (cachedAfterShell) return cachedAfterShell;

  if (!alreadyStarted) {
    try {
      await onShell?.(stripRosterGenerateInputs(shell));
    } catch (err) {
      console.warn("[admin roster] shell paint failed", err);
    }
  }
  const cachedAfterPaint = readTtlCache(rfKey);
  if (cachedAfterPaint) return cachedAfterPaint;

  return getCachedBuiltMonitoringRoster(rosterPayload, {
    schoolYear: year,
    quarter: q,
    scope,
  });
}
