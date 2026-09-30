"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAcademicRecordsModel,
  buildGradeFoldersFromClasses,
  buildSectionFoldersFromClasses,
  groupAcademicRecordClassCards,
} from "@/lib/admin/academicRecordsMappers";
import {
  getCachedAdminSchoolYears,
  invalidateAdminRosterCache,
  loadBuiltMonitoringRoster,
} from "@/lib/admin/adminRosterCache";
import { createClient } from "@/lib/supabase/client";
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

function isTransientFetchError(err) {
  const message = String(err?.message ?? err ?? "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("aborted") ||
    err?.name === "AbortError"
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAuthSession() {
  const supabase = createClient();
  await supabase.auth.getSession();
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
  const { loading, refreshing, beginLoad, endLoad, endFirstPaint } =
    useSoftLoadState(true);

  const loadSeq = useRef(0);
  const hasBootedRef = useRef(false);
  const schoolYearsRef = useRef([]);

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [sectionFilter, setSectionFilter] = useState("All Sections");
  const [teacherFilter, setTeacherFilter] = useState("All Teachers");
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(
    async ({
      schoolYear: year,
      quarter: term,
      bustCache = false,
      retryCount = 0,
    } = {}) => {
      const seq = ++loadSeq.current;
      const resolvedYear = year ?? "";
      const resolvedQuarter = term ?? "";

      beginLoad();
      setError("");

      try {
        await ensureAuthSession();
        if (seq !== loadSeq.current) return;

        if (bustCache) invalidateAdminRosterCache();

        const result = await getAdminReportsBundle({
          schoolYear: resolvedYear || null,
          quarter: resolvedQuarter || null,
          includeAttendance: false,
          includeLessonPlans: false,
        });

        if (seq !== loadSeq.current) return;

        if (result.error) {
          if (isTransientFetchError(result.error) && retryCount < 2) {
            await delay(400 * (retryCount + 1));
            if (seq !== loadSeq.current) return;
            return loadData({
              schoolYear: resolvedYear,
              quarter: resolvedQuarter,
              bustCache,
              retryCount: retryCount + 1,
            });
          }

          setError(
            isTransientFetchError(result.error)
              ? "Connection temporarily interrupted. Please click Refresh."
              : result.error.message || "Unable to load academic records."
          );
          setModel(null);
          endLoad(false);
          return;
        }

        const yearsForModel =
          result.data.schoolYears?.length > 0
            ? result.data.schoolYears
            : schoolYearsRef.current;

        if (result.data.schoolYears?.length) {
          schoolYearsRef.current = result.data.schoolYears;
          setSchoolYears((prev) =>
            prev.length === result.data.schoolYears.length &&
            prev.every((y, i) => y === result.data.schoolYears[i])
              ? prev
              : result.data.schoolYears
          );
        }

        const payload = {
          classes: result.data.classes ?? [],
          enrollments: result.data.enrollments ?? [],
          grades: result.data.grades ?? [],
          monitoringRecords: result.data.monitoringRecords ?? [],
        };
        const modelInput = {
          ...result.data,
          schoolYears: yearsForModel,
          filters: {
            schoolYear: resolvedYear || undefined,
            quarter: resolvedQuarter || undefined,
          },
        };
        const roster = await loadBuiltMonitoringRoster(
          payload,
          {
            schoolYear: resolvedYear || null,
            quarter: resolvedQuarter || null,
          },
          {
            onShell: async (shell) => {
              if (seq !== loadSeq.current) return;
              const built = await buildAcademicRecordsModel({
                ...modelInput,
                roster: shell,
              });
              if (seq !== loadSeq.current) return;
              setModel(built);
              endFirstPaint();
            },
          }
        );

        const built = await buildAcademicRecordsModel({
          ...modelInput,
          roster,
        });

        if (seq !== loadSeq.current) return;

        setModel(built);
        endLoad(true);
      } catch (err) {
        if (seq !== loadSeq.current) return;

        if (isTransientFetchError(err) && retryCount < 2) {
          await delay(400 * (retryCount + 1));
          if (seq !== loadSeq.current) return;
          return loadData({
            schoolYear: resolvedYear,
            quarter: resolvedQuarter,
            bustCache,
            retryCount: retryCount + 1,
          });
        }

        setError(
          isTransientFetchError(err)
            ? "Connection temporarily interrupted. Please click Refresh."
            : err?.message || "Unable to load academic records."
        );
        setModel((current) => current);
        endLoad(false);
      }
    },
    [beginLoad, endLoad, endFirstPaint]
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      await ensureAuthSession();
      if (cancelled) return;

      const yearsResult = await getCachedAdminSchoolYears();
      if (cancelled) return;

      const years = yearsResult.data?.length
        ? yearsResult.data
        : ["SY 2026-2027", "SY 2025-2026"];
      const resolvedYear = years[0] ?? "SY 2026-2027";

      schoolYearsRef.current = years;
      setSchoolYears(years);
      setSchoolYear(resolvedYear);
      setFiltersReady(true);

      await loadData({ schoolYear: resolvedYear, quarter: "" });
      if (!cancelled) hasBootedRef.current = true;
    }

    boot();

    return () => {
      cancelled = true;
      loadSeq.current += 1;
    };
  }, [endLoad, loadData]);

  useEffect(() => {
    if (!filtersReady || !hasBootedRef.current) return;
    loadData({ schoolYear, quarter });
  }, [filtersReady, schoolYear, quarter, loadData]);

  useEffect(() => {
    if (quarter === "4") setQuarter("");
  }, [quarter]);

  const catalog = useMemo(() => {
    const classes = model?.classes ?? [];
    if (quarter) return classes;
    return groupAcademicRecordClassCards(classes);
  }, [model, quarter]);

  const catalogForTeacher = useMemo(
    () => catalog.filter((cls) => classMatchesTeacher(cls, teacherFilter)),
    [catalog, teacherFilter]
  );

  const gradeSummary = useMemo(
    () => buildGradeFoldersFromClasses(catalogForTeacher),
    [catalogForTeacher]
  );

  const classesInGrade = useMemo(() => {
    if (gradeFilter === "All Grades") return [];
    return catalogForTeacher.filter((cls) =>
      gradesMatch(cls.gradeLabel, gradeFilter)
    );
  }, [catalogForTeacher, gradeFilter]);

  const sectionFolders = useMemo(
    () => buildSectionFoldersFromClasses(classesInGrade),
    [classesInGrade]
  );

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

  const refresh = useCallback(() => {
    loadData({ schoolYear, quarter, bustCache: true });
  }, [loadData, schoolYear, quarter]);

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
    setSchoolYear,
    setQuarter,
    refresh,
    summaryCards: model?.summaryCards ?? [],
    gradeSummary,
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
