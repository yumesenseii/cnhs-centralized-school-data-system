"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCachedAdminSchoolYears,
  invalidateAdminRosterCache,
} from "@/lib/admin/adminRosterCache";
import { getAdminReportsBundle } from "@/lib/supabase/queries/reports";
import { buildAdminReportsModel } from "@/lib/admin/reportsMappers";
import { QUARTER_OPTIONS, TERM_ALL_LABEL } from "@/lib/teacher/reportsConstants";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useAdminReports() {
  const [error, setError] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [model, setModel] = useState(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolveYear() {
      const yearsResult = await getCachedAdminSchoolYears();
      if (cancelled) return;

      if (yearsResult.error) {
        setError(yearsResult.error.message || "Unable to load admin reports.");
        setFiltersReady(true);
        endLoad(false);
        return;
      }

      const years = yearsResult.data ?? [];
      setSchoolYears(years);
      setSchoolYear((current) => current || years[0] || "");
      setFiltersReady(true);
    }

    resolveYear();
    return () => {
      cancelled = true;
    };
  }, [endLoad]);

  const refresh = useCallback(
    async ({ bustCache = false } = {}) => {
      if (!filtersReady) return;

      beginLoad();
      setError("");

      try {
        if (bustCache) invalidateAdminRosterCache();

        const result = await getAdminReportsBundle({
          schoolYear: schoolYear || null,
          quarter: quarter || null,
        });

        if (result.error) {
          setError(result.error.message || "Unable to load admin reports.");
          setModel(null);
          endLoad(false);
          return;
        }

        const yearsForModel =
          result.data.schoolYears?.length > 0
            ? result.data.schoolYears
            : schoolYears;

        if (result.data.schoolYears?.length) {
          setSchoolYears((prev) =>
            prev.length === result.data.schoolYears.length &&
            prev.every((y, i) => y === result.data.schoolYears[i])
              ? prev
              : result.data.schoolYears
          );
        }

        const built = await buildAdminReportsModel({
          ...result.data,
          schoolYears: yearsForModel,
          filters: {
            schoolYear: schoolYear || undefined,
            quarter: quarter || undefined,
          },
        });
        setModel(built);
        endLoad(true);
      } catch (err) {
        setError(err?.message || "Unable to load admin reports.");
        setModel(null);
        endLoad(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schoolYears is display-only after boot
    [filtersReady, schoolYear, quarter, beginLoad, endLoad]
  );

  useEffect(() => {
    if (!filtersReady) return;
    refresh();
  }, [filtersReady, refresh]);

  useEffect(() => {
    if (quarter === "4") setQuarter("");
  }, [quarter]);

  return {
    loading: (loading || !filtersReady) && !model,
    refreshing,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters: [
      { value: "", label: TERM_ALL_LABEL },
      ...QUARTER_OPTIONS.filter((opt) => opt.value !== "4"),
    ],
    quickStats: model?.quickStats ?? [],
    reportCards: model?.reportCards ?? [],
    classReports: model?.classReports ?? [],
    charts: model?.charts ?? null,
    summary: model?.summary ?? null,
    lessonSummary: model?.lessonSummary ?? null,
    schoolSummary: model?.schoolSummary ?? null,
    attendance: model?.attendance ?? null,
    setSchoolYear,
    setQuarter,
    refresh: () => refresh({ bustCache: true }),
    getPreview(classId) {
      return model?.buildPreviewForClass?.(classId) ?? null;
    },
  };
}
