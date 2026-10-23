"use client";

import { useCallback, useState } from "react";
import { getAralPeriodPermissions, normalizeAralPeriod } from "@/lib/monitoring/assessmentTimeline";

/** Local view selection only; no activation or settings-table dependency. */
export function useAralAssessmentPeriod(initialPeriod = "BOSY") {
  const [period, setPeriod] = useState(() => normalizeAralPeriod(initialPeriod) || "BOSY");
  const updatePeriod = useCallback((nextPeriod) => {
    const next = normalizeAralPeriod(nextPeriod);
    if (!next) return { ok: false, error: "Choose BOSY, MOSY, or EOSY." };
    setPeriod(next);
    return { ok: true, period: next };
  }, []);
  return { period, updatePeriod, permissions: getAralPeriodPermissions(), loading: false, saving: false, error: "" };
}
