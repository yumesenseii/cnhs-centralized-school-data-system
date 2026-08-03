"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAcademicRecordsModel } from "@/lib/admin/academicRecordsMappers";
import {
  getCachedAdminSchoolYears,
  invalidateAdminRosterCache,
} from "@/lib/admin/adminRosterCache";
import { getAdminReportsBundle } from "@/lib/supabase/queries/reports";
import { QUARTER_OPTIONS, TERM_ALL_LABEL } from "@/lib/teacher/reportsConstants";
import { normalizeRiskLevel } from "@/lib/monitoring/recommendations";

/**
 * Live Academic Records — same roster / ECR source as Admin Reports.
 * Shares adminRosterCache with Overview; skips SF2 attendance + lesson plans.
 *
 * Boot: resolve school year once, then one heavy fetch (no setSchoolYear→refetch loop).
 */
export function useAcademicRecords() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [model, setModel] = useState(null);
  /** False until default SY is known — prevents empty-year roster fetch. */
  const [filtersReady, setFiltersReady] = useState(false);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [sectionFilter, setSectionFilter] = useState("All Sections");
  const [riskFilter, setRiskFilter] = useState("All Risk Levels");
  const [teacherFilter, setTeacherFilter] = useState("All Teachers");

  // Resolve default school year before any roster request.
  useEffect(() => {
    let cancelled = false;

    async function resolveYear() {
      const yearsResult = await getCachedAdminSchoolYears();
      if (cancelled) return;

      if (yearsResult.error) {
        setError(
          yearsResult.error.message || "Unable to load academic records."
        );
        setFiltersReady(true);
        setLoading(false);
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
  }, []);

  const refresh = useCallback(
    async ({ bustCache = false } = {}) => {
      if (!filtersReady) return;

      setLoading(true);
      setError("");

      try {
        if (bustCache) invalidateAdminRosterCache();

        // Same key as Overview: admin:roster|{SY}|all when quarter is empty.
        const result = await getAdminReportsBundle({
          schoolYear: schoolYear || null,
          quarter: quarter || null,
          includeAttendance: false,
          includeLessonPlans: false,
        });

        if (result.error) {
          setError(result.error.message || "Unable to load academic records.");
          setModel(null);
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

        const built = await buildAcademicRecordsModel({
          ...result.data,
          schoolYears: yearsForModel,
          filters: {
            schoolYear: schoolYear || undefined,
            quarter: quarter || undefined,
          },
        });
        setModel(built);
      } catch (err) {
        setError(err?.message || "Unable to load academic records.");
        setModel(null);
      } finally {
        setLoading(false);
      }
    },
    // schoolYears omitted on purpose — updating it must not re-trigger roster fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schoolYears is display-only after boot
    [filtersReady, schoolYear, quarter]
  );

  useEffect(() => {
    if (!filtersReady) return;
    refresh();
  }, [filtersReady, refresh]);

  const filteredStudents = useMemo(() => {
    const students = model?.students ?? [];
    const query = search.trim().toLowerCase();

    return students.filter((row) => {
      if (query) {
        const haystack = `${row.studentName} ${row.studentNumber}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (gradeFilter !== "All Grades" && row.grade !== gradeFilter) {
        return false;
      }
      if (sectionFilter !== "All Sections" && row.section !== sectionFilter) {
        return false;
      }
      if (riskFilter !== "All Risk Levels") {
        if (
          normalizeRiskLevel(row.riskLevel) !== normalizeRiskLevel(riskFilter)
        ) {
          return false;
        }
      }
      if (teacherFilter !== "All Teachers") {
        if (!(row.teacherNames ?? []).includes(teacherFilter)) return false;
      }
      return true;
    });
  }, [model, search, gradeFilter, sectionFilter, riskFilter, teacherFilter]);

  return {
    loading: loading || !filtersReady,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters: [{ value: "", label: TERM_ALL_LABEL }, ...QUARTER_OPTIONS],
    setSchoolYear,
    setQuarter,
    refresh: () => refresh({ bustCache: true }),
    summaryCards: model?.summaryCards ?? [],
    gradeSummary: model?.gradeSummary ?? [],
    students: filteredStudents,
    allStudents: model?.students ?? [],
    filterOptions: model?.filters ?? {
      grades: ["All Grades"],
      sections: ["All Sections"],
      risks: ["All Risk Levels"],
      teachers: ["All Teachers"],
    },
    teacherSubmissions: model?.teacherSubmissions ?? [],
    submissionProgress: model?.submissionProgress ?? {
      label: "0 of 0 submitted",
      percent: 0,
    },
    validationSummary: model?.validationSummary ?? [],
    validationLastUpdated: model?.validationLastUpdated ?? "—",
    academicAnalysis: model?.academicAnalysis ?? {
      status: "Waiting",
      lastAnalysis: "—",
      recordsProcessed: 0,
      learnersRequiringIntervention: 0,
    },
    recentUploadActivity: model?.recentUploadActivity ?? [],
    periodLabel: model?.periodLabel ?? "—",
    search,
    setSearch,
    gradeFilter,
    setGradeFilter,
    sectionFilter,
    setSectionFilter,
    riskFilter,
    setRiskFilter,
    teacherFilter,
    setTeacherFilter,
  };
}
