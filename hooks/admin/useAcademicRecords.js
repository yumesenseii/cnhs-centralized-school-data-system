"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAcademicRecordsModel, groupAcademicRecordClassCards } from "@/lib/admin/academicRecordsMappers";
import {
  getCachedAdminSchoolYears,
  invalidateAdminRosterCache,
} from "@/lib/admin/adminRosterCache";
import { getAdminReportsBundle } from "@/lib/supabase/queries/reports";
import { QUARTER_OPTIONS, TERM_ALL_LABEL } from "@/lib/teacher/reportsConstants";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

function gradesMatch(rowGrade, filter) {
  if (!filter || filter === "All Grades") return true;
  const a = String(rowGrade ?? "").trim();
  const b = String(filter).trim();
  if (!a) return false;
  if (a === b) return true;
  return a.replace(/^Grade\s+/i, "") === b.replace(/^Grade\s+/i, "");
}

function normalizeTeacherName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function teacherNameKey(name) {
  const normalized = normalizeTeacherName(name);
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1]}`;
  return normalized;
}

function classMatchesTeacher(cls, teacherFilter) {
  if (!teacherFilter || teacherFilter === "All Teachers") return true;
  return teacherNameKey(cls.teacherName) === teacherNameKey(teacherFilter);
}

/**
 * Academic Records — class lists from ECR uploads (not monitoring risk/ARAL).
 */
export function useAcademicRecords() {
  const [error, setError] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [model, setModel] = useState(null);
  const [filtersReady, setFiltersReady] = useState(false);
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [sectionFilter, setSectionFilter] = useState("All Sections");
  const [teacherFilter, setTeacherFilter] = useState("All Teachers");
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

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
          includeAttendance: false,
          includeLessonPlans: false,
        });

        if (result.error) {
          setError(result.error.message || "Unable to load academic records.");
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

        const built = await buildAcademicRecordsModel({
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
        setError(err?.message || "Unable to load academic records.");
        setModel(null);
        endLoad(false);
      }
    },
    [filtersReady, schoolYear, quarter, beginLoad, endLoad]
  );

  useEffect(() => {
    if (!filtersReady) return;
    refresh();
  }, [filtersReady, refresh]);

  const catalog = useMemo(() => {
    const classes = model?.classes ?? [];
    if (quarter) return classes;
    return groupAcademicRecordClassCards(classes);
  }, [model, quarter]);

  const classesInGrade = useMemo(() => {
    if (gradeFilter === "All Grades") return [];
    return catalog.filter((cls) => {
      if (!gradesMatch(cls.gradeLabel, gradeFilter)) return false;
      if (!classMatchesTeacher(cls, teacherFilter)) return false;
      return true;
    });
  }, [catalog, gradeFilter, teacherFilter]);

  const sectionFolders = useMemo(() => {
    const map = new Map();
    for (const cls of classesInGrade) {
      const key = cls.section || "—";
      const entry = map.get(key) ?? {
        section: key,
        classCount: 0,
        students: 0,
        graded: 0,
        pending: 0,
        uploaded: 0,
      };
      entry.classCount += 1;
      entry.students += cls.learnerCount;
      entry.graded += cls.gradedCount;
      entry.pending += cls.pendingCount;
      if (cls.hasUpload) entry.uploaded += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) =>
      String(a.section).localeCompare(String(b.section))
    );
  }, [classesInGrade]);

  const scopedClasses = useMemo(() => {
    if (sectionFilter === "All Sections") return [];
    return classesInGrade.filter((cls) => cls.section === sectionFilter);
  }, [classesInGrade, sectionFilter]);

  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return (
      catalog.find(
        (cls) =>
          cls.id === selectedClassId ||
          (cls.relatedClassIds ?? []).includes(selectedClassId)
      ) || null
    );
  }, [catalog, selectedClassId]);

  const rosterStudents = useMemo(() => {
    if (!selectedClass) return [];
    const query = search.trim().toLowerCase();
    return (selectedClass.students ?? []).filter((row) => {
      if (query) {
        const haystack = `${row.studentName} ${row.studentNumber}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter === "graded") return row.hasGrade;
      if (statusFilter === "ungraded") return !row.hasGrade;
      return true;
    });
  }, [selectedClass, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const rows = selectedClass?.students ?? [];
    let graded = 0;
    let ungraded = 0;
    for (const row of rows) {
      if (row.hasGrade) graded += 1;
      else ungraded += 1;
    }
    return { all: rows.length, graded, ungraded };
  }, [selectedClass]);

  const selectGradeFolder = useCallback((gradeLabel) => {
    setGradeFilter(gradeLabel || "All Grades");
    setSectionFilter("All Sections");
    setTeacherFilter("All Teachers");
    setSelectedClassId(null);
    setStatusFilter("all");
    setSearch("");
  }, []);

  const clearGradeFolder = useCallback(() => {
    setGradeFilter("All Grades");
    setSectionFilter("All Sections");
    setSelectedClassId(null);
    setStatusFilter("all");
    setSearch("");
  }, []);

  const selectSectionFolder = useCallback((sectionName) => {
    setSectionFilter(sectionName || "All Sections");
    setSelectedClassId(null);
    setStatusFilter("all");
    setSearch("");
  }, []);

  const clearSectionFolder = useCallback(() => {
    setSectionFilter("All Sections");
    setSelectedClassId(null);
    setStatusFilter("all");
    setSearch("");
  }, []);

  const selectClass = useCallback((cls) => {
    if (!cls) return;
    setSelectedClassId(cls.id);
    setGradeFilter(cls.gradeLabel || "All Grades");
    setSectionFilter(cls.section || "All Sections");
    setTeacherFilter(cls.teacherName || "All Teachers");
    setStatusFilter("all");
    setSearch("");
  }, []);

  const clearClass = useCallback(() => {
    setSelectedClassId(null);
    setStatusFilter("all");
    setSearch("");
  }, []);

  return {
    loading: (loading || !filtersReady) && !model,
    refreshing,
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
    sectionFolders,
    classes: scopedClasses,
    selectedClass,
    students: rosterStudents,
    filterOptions: model?.filters ?? {
      sections: ["All Sections"],
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
    selectGradeFolder,
    clearGradeFolder,
    selectSectionFolder,
    clearSectionFolder,
    sectionFilter,
    setSectionFilter,
    teacherFilter,
    setTeacherFilter,
    statusFilter,
    setStatusFilter,
    statusCounts,
    selectClass,
    clearClass,
  };
}
