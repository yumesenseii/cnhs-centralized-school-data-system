"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAralAssessmentPeriod,
  setAralAssessmentPeriod,
} from "@/lib/supabase/queries/aralAssessmentPeriod";
import {
  getAralPeriodPermissions,
  normalizeAralPeriod,
} from "@/lib/monitoring/assessmentTimeline";

/**
 * Authoritative ARAL assessment period (BOSY/MOSY/EOSY) shared by teacher
 * and principal ARAL screens. Defaults to BOSY while loading or when the
 * setting is unavailable — never blocks rendering.
 */
export function useAralAssessmentPeriod() {
  const [period, setPeriod] = useState("BOSY");
  const [periodSchoolYear, setPeriodSchoolYear] = useState(null);
  const [fromConfig, setFromConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getAralAssessmentPeriod();
    const next = normalizeAralPeriod(result.data?.period) || "BOSY";
    setPeriod(next);
    setPeriodSchoolYear(result.data?.schoolYear ?? null);
    setFromConfig(Boolean(result.data?.fromConfig));
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updatePeriod = useCallback(
    async (nextPeriod, options) => {
      setSaving(true);
      setError("");
      const result = await setAralAssessmentPeriod(nextPeriod, options);
      setSaving(false);
      if (result.error) {
        setError(result.error.message || "Unable to update assessment period.");
        return { ok: false, error: result.error.message };
      }
      const next = normalizeAralPeriod(result.data?.period) || "BOSY";
      setPeriod(next);
      setPeriodSchoolYear(result.data?.schoolYear ?? null);
      setFromConfig(true);
      return { ok: true, period: next };
    },
    []
  );

  return {
    period,
    periodSchoolYear,
    fromConfig,
    loading,
    saving,
    error,
    permissions: getAralPeriodPermissions(period),
    updatePeriod,
    refresh,
  };
}
