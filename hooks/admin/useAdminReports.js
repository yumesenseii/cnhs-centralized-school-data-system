"use client";

import { useCallback, useEffect, useState } from "react";
import { pickDefaultSchoolYear } from "@/lib/admin/academicRecordsMappers";
import { getAdminReportsBundle } from "@/lib/supabase/queries/reports";
import { buildAdminReportsModel } from "@/lib/admin/reportsMappers";
import { QUARTER_OPTIONS, TERM_ALL_LABEL } from "@/lib/teacher/reportsConstants";

export function useAdminReports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [model, setModel] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await getAdminReportsBundle({
      schoolYear: schoolYear || null,
      quarter: quarter || null,
    });

    if (result.error) {
      setError(result.error.message || "Unable to load admin reports.");
      setModel(null);
      setLoading(false);
      return;
    }

    const years = result.data.schoolYears ?? [];
    setSchoolYears(years);

    if (!initialized) {
      setInitialized(true);
      const preferred = pickDefaultSchoolYear(
        result.data.classes ?? [],
        years
      );
      if (!schoolYear && preferred) {
        setSchoolYear(preferred);
        setLoading(false);
        return;
      }
    }

    const built = await buildAdminReportsModel({
      ...result.data,
      schoolYears: years,
      filters: {
        schoolYear: schoolYear || undefined,
        quarter: quarter || undefined,
      },
    });
    setModel(built);
    setLoading(false);
  }, [schoolYear, quarter, initialized]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters: [{ value: "", label: TERM_ALL_LABEL }, ...QUARTER_OPTIONS],
    quickStats: model?.quickStats ?? [],
    reportCards: model?.reportCards ?? [],
    classReports: model?.classReports ?? [],
    charts: model?.charts ?? null,
    summary: model?.summary ?? null,
    schoolSummary: model?.schoolSummary ?? null,
    attendance: model?.attendance ?? null,
    setSchoolYear,
    setQuarter,
    refresh,
    getPreview(classId) {
      return model?.buildPreviewForClass?.(classId) ?? null;
    },
  };
}
