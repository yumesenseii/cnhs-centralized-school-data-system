import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import {
  ARAL_ASSESSMENT_PERIODS,
  normalizeAralPeriod,
} from "@/lib/monitoring/assessmentTimeline";

const SETTING_KEY = "aral.assessment_period";
const FALLBACK_PERIOD = ARAL_ASSESSMENT_PERIODS.BOSY;

function rowToPeriod(row) {
  const period = normalizeAralPeriod(row?.value?.period);
  return {
    period,
    schoolYear: row?.value?.school_year ?? null,
    updatedAt: row?.updated_at ?? null,
    fromConfig: Boolean(row),
  };
}

/**
 * Authoritative current ARAL assessment period (BOSY/MOSY/EOSY).
 * Fail-safe: missing table/row/permission resolves to BOSY, never throws,
 * so reads and historical views keep working offline of the new setting.
 */
export async function getAralAssessmentPeriod() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value, updated_at")
      .eq("key", SETTING_KEY)
      .maybeSingle();
    if (error || !data) {
      return { data: { period: FALLBACK_PERIOD, schoolYear: null, updatedAt: null, fromConfig: false }, error: null };
    }
    return { data: rowToPeriod(data), error: null };
  } catch {
    return { data: { period: FALLBACK_PERIOD, schoolYear: null, updatedAt: null, fromConfig: false }, error: null };
  }
}

/**
 * Advance the school-wide ARAL assessment period. Admin only.
 */
export async function setAralAssessmentPeriod(period, { schoolYear = null } = {}) {
  const auth = await requireAdmin("manage the ARAL assessment period");
  if (!auth.ok) return { data: null, error: auth.error };

  const normalized = normalizeAralPeriod(period);
  if (!normalized) {
    return { data: null, error: new Error("Assessment period must be BOSY, MOSY, or EOSY.") };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .upsert(
        {
          key: SETTING_KEY,
          value: {
            period: normalized,
            ...(schoolYear ? { school_year: schoolYear } : {}),
          },
          updated_by_profile_id: auth.profile?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      )
      .select("value, updated_at")
      .single();
    if (error) return { data: null, error };
    return { data: rowToPeriod(data), error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
