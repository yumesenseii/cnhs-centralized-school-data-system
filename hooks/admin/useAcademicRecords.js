"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAcademicRecordsModel,
  pickDefaultSchoolYear,
} from "@/lib/admin/academicRecordsMappers";
import { getAdminReportsBundle } from "@/lib/supabase/queries/reports";
import { QUARTER_OPTIONS, TERM_ALL_LABEL } from "@/lib/teacher/reportsConstants";
import { normalizeRiskLevel } from "@/lib/monitoring/recommendations";

/**
 * Live Academic Records — same roster / ECR source as Admin Reports.
 */
export function useAcademicRecords() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [model, setModel] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [sectionFilter, setSectionFilter] = useState("All Sections");
  const [riskFilter, setRiskFilter] = useState("All Risk Levels");
  const [teacherFilter, setTeacherFilter] = useState("All Teachers");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await getAdminReportsBundle({
      schoolYear: schoolYear || null,
      quarter: quarter || null,
    });

    if (result.error) {
      setError(result.error.message || "Unable to load academic records.");
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

    const built = await buildAcademicRecordsModel({
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
        if (normalizeRiskLevel(row.riskLevel) !== normalizeRiskLevel(riskFilter)) {
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
    loading,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters: [{ value: "", label: TERM_ALL_LABEL }, ...QUARTER_OPTIONS],
    setSchoolYear,
    setQuarter,
    refresh,
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
