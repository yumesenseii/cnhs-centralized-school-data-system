"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTeacherReportsBundle,
  resolveTeacherReportsSession,
} from "@/lib/supabase/queries/reports";
import {
  QUARTER_OPTIONS,
  REPORT_FILTER_ALL,
} from "@/lib/teacher/reportsConstants";
import {
  buildClassReportPreview,
  buildTeacherReportsModel,
} from "@/lib/teacher/reportsMappers";
import { loadBuiltTeacherRoster } from "@/lib/teacher/teacherRosterCache";
import {
  averageOf,
  buildAralDistribution,
  buildAverageGradePerSubject,
  buildMonitoringProgressChart,
  buildPerformanceDistribution,
  countAralScreening,
  monitoringCompletionRate,
  highestLowestSubjects,
  passingRateFromGrades,
} from "@/lib/teacher/reportsCalculations";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

const EMPTY_LIST = [];
const EMPTY_CHARTS = {
  performanceDistribution: [],
  aralDistribution: [],
  averageGradePerSubject: [],
  monitoringProgress: [],
};

function defaultSchoolYear(years = []) {
  return years[0] ?? "SY 2026-2027";
}

function applySubjectSectionFilter(base, subject, section) {
  if (!base) return null;

  let classReports = base.classReports ?? [];
  let students = base.students ?? [];

  if (subject !== REPORT_FILTER_ALL) {
    classReports = classReports.filter((row) => row.subject === subject);
    students = students.filter((s) => s.subject === subject);
  }
  if (section !== REPORT_FILTER_ALL) {
    classReports = classReports.filter(
      (row) => row.sectionName === section || row.gradeSection === section
    );
    students = students.filter(
      (s) => s.section === section || s.gradeSection === section
    );
  }

  const allSubjectGrades = classReports.flatMap((row) => row.subjectGrades ?? []);
  const aralCount = countAralScreening(students);
  const predictionsPending = students.some((s) => s.predictionsPending);
  const classroomRemedialCount = classReports.filter(
    (row) => row.classroomRemedialRecommended
  ).length;
  const hasAralClass = classReports.some((row) => row.aralEligible);
  const avgClassGrade = averageOf(
    classReports
      .map((row) => row.averageGradeValue)
      .filter((v) => v !== null && v !== undefined)
  );
  const completionRate = monitoringCompletionRate(students);
  const { highest, lowest } = highestLowestSubjects(classReports);
  const passRate = passingRateFromGrades(allSubjectGrades);

  const summary = {
    ...base.summary,
    totalClasses: classReports.length,
    totalStudents: students.length,
    aralScreeningCount: aralCount,
    classroomRemedialCount,
    averageClassGrade: avgClassGrade,
    monitoringCompletionRate: completionRate,
    passingRate: passRate,
    highestSubject: highest,
    lowestSubject: lowest,
    monitoringCompleted: students.filter((s) => s.monitoringStatus === "Completed")
      .length,
    learnersUnderMonitoring: students.filter(
      (s) => s.monitoringStatus && s.monitoringStatus !== "Not Started"
    ).length,
    hasAralClass,
  };

  const lessonMetrics = base.summaryCards?.find((c) => c.id === "lesson-plans")
    ?.metrics ?? [
    { label: "Approved", value: "0" },
    { label: "Pending Review", value: "0" },
    { label: "Needs Revision", value: "0" },
  ];

  const summaryCards = [
    {
      id: "classes",
      title: "Classes Assigned",
      metrics: [
        { label: "Total Classes", value: String(summary.totalClasses) },
        { label: "Total Students", value: String(summary.totalStudents) },
        {
          label: "Average Class Grade",
          value:
            summary.averageClassGrade == null
              ? "—"
              : String(summary.averageClassGrade),
        },
      ],
      tone: "green",
      icon: "book",
    },
    {
      id: "academic",
      title: "Academic Reports",
      metrics: [
        {
          label: "Passing Rate",
          value:
            summary.passingRate == null ? "—" : `${summary.passingRate}%`,
        },
        { label: "Highest Performing Subject", value: summary.highestSubject },
        { label: "Lowest Performing Subject", value: summary.lowestSubject },
      ],
      tone: "blue",
      icon: "chart",
    },
    {
      id: "monitoring",
      title: "Monitoring Reports",
      metrics: [
        {
          label: "ARAL Learners Count",
          value: predictionsPending ? "—" : String(summary.aralScreeningCount),
        },
        {
          label: "Classroom Remedial Count",
          value: String(summary.classroomRemedialCount),
        },
        {
          label: "Monitoring Completion Rate",
          value: `${summary.monitoringCompletionRate}%`,
        },
      ],
      tone: "orange",
      icon: "users",
    },
    {
      id: "lesson-plans",
      title: "Lesson Plan Status",
      metrics: lessonMetrics,
      tone: "violet",
      icon: "clipboard",
    },
  ];

  const lessonCard = base.reportCards?.find((c) => c.id === "lesson-plan-report");

  const reportCards = [
    {
      id: "academic-performance",
      title: "Academic Performance Report",
      metrics: [
        {
          label: "Class Average",
          value:
            summary.averageClassGrade == null
              ? "—"
              : String(summary.averageClassGrade),
        },
        {
          label: "Passing Rate",
          value:
            summary.passingRate == null ? "—" : `${summary.passingRate}%`,
        },
        { label: "Highest Performing Subject", value: summary.highestSubject },
        { label: "Lowest Performing Subject", value: summary.lowestSubject },
      ],
    },
    {
      id: "monitoring-report",
      title: "Monitoring Report",
      metrics: [
        {
          label: "Learners Under Monitoring",
          value: String(summary.learnersUnderMonitoring),
        },
        {
          label: "ARAL Learners",
          value: predictionsPending ? "—" : String(summary.aralScreeningCount),
        },
        {
          label: "Classroom Remedial",
          value: String(summary.classroomRemedialCount),
        },
        {
          label: "Monitoring Completed",
          value: String(summary.monitoringCompleted),
        },
      ],
    },
    lessonCard ?? {
      id: "lesson-plan-report",
      title: "Lesson Plan Report",
      metrics: [
        { label: "Latest Submission", value: "—" },
        { label: "Review Status", value: "—" },
        { label: "Submission Date", value: "—" },
      ],
    },
    {
      id: "eclass-report",
      title: "E-Class Record Report",
      metrics: [
        {
          label: "Classes with Grades",
          value: `${classReports.filter((r) => (r.subjectGrades ?? []).length > 0).length} of ${classReports.length}`,
        },
        {
          label: "Graded Subject Entries",
          value: String(allSubjectGrades.length),
        },
        {
          label: "Average Class Grade",
          value:
            summary.averageClassGrade == null
              ? "—"
              : String(summary.averageClassGrade),
        },
      ],
    },
  ];

  return {
    ...base,
    summary,
    summaryCards,
    reportCards,
    classReports,
    students,
    charts: {
      performanceDistribution: buildPerformanceDistribution(allSubjectGrades),
      aralDistribution: buildAralDistribution(students),
      averageGradePerSubject: buildAverageGradePerSubject(classReports),
      monitoringProgress: buildMonitoringProgressChart(students),
    },
  };
}

export function useTeacherReports() {
  const [bundle, setBundle] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [profile, setProfile] = useState(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [baseModel, setBaseModel] = useState(null);
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("1");
  const [subject, setSubject] = useState(REPORT_FILTER_ALL);
  const [section, setSection] = useState(REPORT_FILTER_ALL);

  const refresh = useCallback(async ({ bustCache = false } = {}) => {
    beginLoad();
    setError("");

    if (bustCache) {
      const { invalidateTeacherRosterCache } = await import(
        "@/lib/teacher/teacherRosterCache"
      );
      invalidateTeacherRosterCache();
    }

    const session = await resolveTeacherReportsSession();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setTeacher(null);
      setProfile(null);
      setBundle(null);
      setBaseModel(null);
      endLoad(false);
      return;
    }

    setTeacher(session.data.teacher);
    setProfile(session.data.profile);

    const result = await getTeacherReportsBundle({
      teacherId: session.data.teacherId,
    });

    if (result.error) {
      setError(result.error.message);
      setBundle(null);
      setBaseModel(null);
      endLoad(false);
      return;
    }

    const nextBundle = result.data;
    setBundle(nextBundle);

    const years = [
      ...new Set(
        (nextBundle.allClasses ?? nextBundle.classes ?? [])
          .map((row) => row.school_year)
          .filter(Boolean)
      ),
    ].sort();

    setSchoolYear((current) => current || defaultSchoolYear(years));
    endLoad(true);
  }, [beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!bundle) {
        setBaseModel(null);
        return;
      }

      setBuilding(true);
      try {
        const year = schoolYear || null;
        const quarterNumber = quarter ? Number(quarter) : null;
        const payload = {
          classes: bundle.classes ?? [],
          enrollments: bundle.enrollments ?? [],
          grades: bundle.grades ?? [],
          monitoringRecords: bundle.monitoringRecords ?? [],
        };
        const modelInput = {
          classes: payload.classes,
          enrollments: payload.enrollments,
          grades: payload.grades,
          monitoringRecords: payload.monitoringRecords,
          lessonPlans: bundle.lessonPlans ?? [],
          teacher,
          profile,
          teacherId: teacher?.id ?? null,
          filters: {
            schoolYear: year,
            quarter: quarterNumber,
            subject: REPORT_FILTER_ALL,
            section: REPORT_FILTER_ALL,
          },
        };

        const wrap = (next) => ({
          ...next,
          filterOptions: {
            schoolYears: [
              ...new Set(
                (bundle.allClasses ?? [])
                  .map((row) => row.school_year)
                  .filter(Boolean)
              ),
            ].sort(),
            subjects: next.filterOptions.subjects,
            sections: next.filterOptions.sections,
          },
        });

        const roster = await loadBuiltTeacherRoster(
          payload,
          { teacherId: teacher?.id ?? null },
          {
            onShell: async (shell) => {
              if (cancelled) return;
              const next = await buildTeacherReportsModel({
                ...modelInput,
                roster: shell,
              });
              if (!cancelled) setBaseModel(wrap(next));
            },
          }
        );

        const next = await buildTeacherReportsModel({
          ...modelInput,
          roster,
        });

        if (!cancelled) {
          setBaseModel(wrap(next));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? "Unable to build report data.");
          setBaseModel((current) => current);
        }
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [bundle, teacher, profile, schoolYear, quarter]);

  const built = useMemo(
    () => applySubjectSectionFilter(baseModel, subject, section),
    [baseModel, subject, section]
  );

  const schoolYears = useMemo(() => {
    const years = built?.filterOptions?.schoolYears ?? EMPTY_LIST;
    return years.length ? years : [defaultSchoolYear(EMPTY_LIST)];
  }, [built]);

  const classReports = built?.classReports ?? EMPTY_LIST;
  const summaryCards = built?.summaryCards ?? EMPTY_LIST;
  const reportCards = built?.reportCards ?? EMPTY_LIST;
  const subjects = built?.filterOptions?.subjects ?? EMPTY_LIST;
  const sections = built?.filterOptions?.sections ?? EMPTY_LIST;
  const charts = built?.charts ?? EMPTY_CHARTS;

  const quarterLabel =
    QUARTER_OPTIONS.find((q) => q.value === String(quarter))?.label ??
    `Quarter ${quarter}`;

  function getPreview(classReport) {
    return buildClassReportPreview(classReport, {
      teacherName: built?.teacherName,
      schoolYear: schoolYear || defaultSchoolYear(schoolYears),
      quarter: quarterLabel,
    });
  }

  return {
    loading: loading || (building && !baseModel),
    refreshing: refreshing || (building && Boolean(baseModel)),
    error,
    teacher,
    profile,
    teacherName: built?.teacherName ?? profile?.full_name ?? "Teacher",
    summary: built?.summary ?? null,
    lessonSummary: built?.lessonSummary ?? null,
    summaryCards,
    reportCards,
    classReports,
    charts,
    schoolYear: schoolYear || defaultSchoolYear(schoolYears),
    quarter,
    quarterLabel,
    subject,
    section,
    schoolYears,
    subjects,
    sections,
    setSchoolYear,
    setQuarter,
    setSubject,
    setSection,
    refresh: () => refresh({ bustCache: true }),
    getPreview,
  };
}
