/**
 * Shared in-memory cache for admin school-wide roster fetches.
 * Dedupes Strict Mode double-mount + Dashboard ↔ Academic Records ↔ Monitoring.
 * Keys must match across Overview / Academic Records / Reports / Monitoring.
 */

import { getAdminMonitoringRoster } from "@/lib/supabase/queries/monitoring";
import { createClient } from "@/lib/supabase/client";
import { buildMonitoringRoster } from "@/lib/teacher/monitoringMappers";
import {
  cacheKey,
  invalidateTtlCache,
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
    const supabase = createClient();
    const { data, error } = await supabase
      .from("classes")
      .select("school_year, quarter");
    if (error) return { data: [], error };
    const schoolYears = [
      ...new Set((data ?? []).map((row) => row.school_year).filter(Boolean)),
    ].sort((a, b) => String(b).localeCompare(String(a)));
    return { data: schoolYears, rows: data ?? [], error: null };
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
export async function getCachedBuiltMonitoringRoster(
  rosterPayload = {},
  { schoolYear = null, quarter = null, scope = "default" } = {}
) {
  const year = schoolYear || null;
  const q = normalizeQuarter(quarter);
  const key = cacheKey([PREFIX + "built", year, q, scope]);
  return withTtlCache(key, async () => {
    return buildMonitoringRoster({
      ...rosterPayload,
      preferLocalRecommendations: false,
    });
  });
}
