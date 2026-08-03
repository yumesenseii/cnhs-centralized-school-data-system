import { RECOMMENDATION } from "@/lib/monitoring/recommendations";
import {
  formatPersonName,
} from "@/lib/teacher/monitoringMappers";
import { getCachedBuiltTeacherRoster } from "@/lib/teacher/teacherRosterCache";
import { getCachedBuiltMonitoringRoster } from "@/lib/admin/adminRosterCache";
import {
  REPORT_FILTER_ALL,
} from "@/lib/teacher/reportsConstants";
import {
  averageOf,
  buildAralDistribution,
  buildAverageGradePerSubject,
  buildMonitoringProgressChart,
  buildPerformanceDistribution,
  collectClassSubjectGrades,
  countAralScreening,
  countMonitoringBuckets,
  evaluateClassroomRemedial,
  formatAralScreeningCell,
  formatMonitoringStatusLabel,
  highestLowestSubjects,
  monitoringCompletionRate,
  passingRateFromGrades,
  summarizeLessonPlans,
  uniqueSorted,
} from "@/lib/teacher/reportsCalculations";
import { isAralEligibleSubject } from "@/lib/services/recommendation/subjectCapabilities";

function teacherDisplayName(teacher, profile) {
  const fromTeacher = formatPersonName(teacher);
  if (fromTeacher && fromTeacher !== "—") return fromTeacher;
  return profile?.full_name?.trim() || "Teacher";
}

/**
 * Build class report rows + aggregates from monitoring roster payload.
 */
export async function buildTeacherReportsModel({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  lessonPlans = [],
  teacher = null,
  profile = null,
  filters = {},
  teacherId = null,
} = {}) {
  const payload = {
    classes,
    enrollments,
    grades,
    monitoringRecords,
  };
  const scope = {
    schoolYear: filters.schoolYear || null,
    quarter: filters.quarter || null,
  };
  const resolvedTeacherId = teacherId || teacher?.id || null;
  const roster = resolvedTeacherId
    ? await getCachedBuiltTeacherRoster(payload, {
        teacherId: resolvedTeacherId,
      })
    : await getCachedBuiltMonitoringRoster(payload, scope);

  let classSummaries = roster.classSummaries;
  let students = roster.students;

  if (scope.schoolYear) {
    classSummaries = classSummaries.filter(
      (c) => c.schoolYear === scope.schoolYear
    );
    students = students.filter((s) => s.schoolYear === scope.schoolYear);
  }
  if (scope.quarter !== null && scope.quarter !== undefined && scope.quarter !== "") {
    const q = Number(scope.quarter);
    if (Number.isFinite(q)) {
      classSummaries = classSummaries.filter((c) => Number(c.quarter) === q);
      students = students.filter(
        (s) => Number(s.quarterNumber ?? s.quarter) === q
      );
    }
  }

  const subjectFilter = filters.subject ?? REPORT_FILTER_ALL;
  const sectionFilter = filters.section ?? REPORT_FILTER_ALL;

  if (subjectFilter !== REPORT_FILTER_ALL) {
    classSummaries = classSummaries.filter((c) => c.subject === subjectFilter);
    students = students.filter((s) => s.subject === subjectFilter);
  }
  if (sectionFilter !== REPORT_FILTER_ALL) {
    classSummaries = classSummaries.filter(
      (c) => c.sectionName === sectionFilter || c.gradeSection === sectionFilter
    );
    students = students.filter(
      (s) => s.section === sectionFilter || s.gradeSection === sectionFilter
    );
  }

  const classReports = classSummaries.map((classInfo) => {
    const classStudents = students.filter((s) => s.classId === classInfo.id);
    const subjectGrades = collectClassSubjectGrades({
      classId: classInfo.id,
      subjectId: classInfo.subjectId,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
      enrollments,
      grades,
    });
    const averageGrade = averageOf(subjectGrades);
    const remedial = evaluateClassroomRemedial(subjectGrades);
    const aralEligible =
      classInfo.aralEligible ?? isAralEligibleSubject(classInfo.subject);
    // Student ARAL Learners only for English / Filipino class offerings.
    const aralScreening = aralEligible
      ? classStudents.filter((s) => s.recommendation === RECOMMENDATION.ARAL)
          .length
      : 0;
    const monitoringBuckets = countMonitoringBuckets(classStudents);
    const monitoringStatus = formatMonitoringStatusLabel({
      totalStudents: classStudents.length,
      ...monitoringBuckets,
    });
    const lastUpdatedSource = classStudents
      .map((s) => s.latestObservationDate)
      .filter((d) => d && d !== "—")
      .sort()
      .at(-1);

    return {
      id: classInfo.id,
      section: classInfo.gradeSection,
      gradeSection: classInfo.gradeSection,
      sectionName: classInfo.sectionName,
      subject: classInfo.subject,
      subjectId: classInfo.subjectId,
      aralEligible,
      students: classStudents.length,
      averageGrade: averageGrade ?? "—",
      averageGradeValue: averageGrade,
      aralScreening,
      aralScreeningDisplay: formatAralScreeningCell({
        aralEligible,
        aralScreening,
      }),
      intervention: aralEligible ? aralScreening : null,
      classroomRemedial: remedial.label,
      classroomRemedialRecommended: remedial.recommended,
      remedialMeta: remedial,
      monitoringStatus,
      reportStatus: remedial.recommended ? "Needs Update" : "Available",
      lastUpdated: lastUpdatedSource ?? "—",
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarterLabel,
      quarterNumber: classInfo.quarter,
      teacherName: classInfo.teacherName || teacherDisplayName(teacher, profile),
      classStudents,
      subjectGrades,
    };
  });

  const allSubjectGrades = classReports.flatMap((row) => row.subjectGrades);
  const aralCount = countAralScreening(students);
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
  const lessonSummary = summarizeLessonPlans(lessonPlans, {
    schoolYear: filters.schoolYear,
    quarter: filters.quarter,
  });
  const monitoringBuckets = countMonitoringBuckets(students);

  const summary = {
    totalClasses: classReports.length,
    totalStudents: students.length,
    aralScreeningCount: aralCount,
    classroomRemedialCount,
    averageClassGrade: avgClassGrade,
    monitoringCompletionRate: completionRate,
    passingRate: passRate,
    highestSubject: highest,
    lowestSubject: lowest,
    monitoringCompleted: monitoringBuckets.completed,
    learnersUnderMonitoring: students.filter(
      (s) =>
        s.monitoringStatus &&
        s.monitoringStatus !== "Not Started"
    ).length,
    hasAralClass,
  };

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
            summary.averageClassGrade === null ||
            summary.averageClassGrade === undefined
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
            summary.passingRate === null || summary.passingRate === undefined
              ? "—"
              : `${summary.passingRate}%`,
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
          value: String(summary.aralScreeningCount),
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
      metrics: [
        { label: "Approved", value: String(lessonSummary.approved) },
        { label: "Pending Review", value: String(lessonSummary.pending) },
        {
          label: "Needs Revision",
          value: String(lessonSummary.needsRevision),
        },
      ],
      tone: "violet",
      icon: "clipboard",
    },
  ];

  const reportCards = [
    {
      id: "academic-performance",
      title: "Academic Performance Report",
      metrics: [
        {
          label: "Class Average",
          value:
            summary.averageClassGrade === null ||
            summary.averageClassGrade === undefined
              ? "—"
              : String(summary.averageClassGrade),
        },
        {
          label: "Passing Rate",
          value:
            summary.passingRate === null || summary.passingRate === undefined
              ? "—"
              : `${summary.passingRate}%`,
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
          value: String(summary.aralScreeningCount),
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
    {
      id: "lesson-plan-report",
      title: "Lesson Plan Report",
      metrics: [
        { label: "Latest Submission", value: lessonSummary.latestTitle },
        { label: "Review Status", value: lessonSummary.latestStatus },
        { label: "Submission Date", value: lessonSummary.latestDate },
      ],
    },
    {
      id: "eclass-report",
      title: "E-Class Record Report",
      metrics: [
        {
          label: "Classes with Grades",
          value: `${classReports.filter((r) => r.subjectGrades.length > 0).length} of ${classReports.length}`,
        },
        {
          label: "Graded Subject Entries",
          value: String(allSubjectGrades.length),
        },
        {
          label: "Average Class Grade",
          value:
            summary.averageClassGrade === null ||
            summary.averageClassGrade === undefined
              ? "—"
              : String(summary.averageClassGrade),
        },
      ],
    },
  ];

  const charts = {
    performanceDistribution: buildPerformanceDistribution(allSubjectGrades),
    aralDistribution: buildAralDistribution(students),
    averageGradePerSubject: buildAverageGradePerSubject(classReports),
    monitoringProgress: buildMonitoringProgressChart(students),
  };

  const filterOptions = {
    schoolYears: uniqueSorted(classes.map((c) => c.school_year)),
    subjects: uniqueSorted(roster.classSummaries.map((c) => c.subject)),
    sections: uniqueSorted(roster.classSummaries.map((c) => c.sectionName)),
  };

  return {
    teacherName: teacherDisplayName(teacher, profile),
    summary,
    summaryCards,
    reportCards,
    classReports,
    charts,
    students,
    lessonSummary,
    filterOptions,
  };
}

export function buildClassReportPreview(classReport, { teacherName, schoolYear, quarter } = {}) {
  if (!classReport) return null;

  const classStudents = classReport.classStudents ?? [];
  const aralEligible =
    classReport.aralEligible ?? isAralEligibleSubject(classReport.subject);
  const weakMap = new Map();
  for (const student of classStudents) {
    for (const subject of student.weakSubjects ?? []) {
      const entry = weakMap.get(subject) ?? { subject, learners: 0 };
      entry.learners += 1;
      weakMap.set(subject, entry);
    }
  }
  const weakSubjects = [...weakMap.values()]
    .map((row) => ({
      ...row,
      percent: classStudents.length
        ? Math.round((row.learners / classStudents.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.learners - a.learners);

  const monitoringBuckets = countMonitoringBuckets(classStudents);
  const aral = aralEligible ? (classReport.aralScreening ?? 0) : 0;
  const aralDisplay = formatAralScreeningCell({
    aralEligible,
    aralScreening: aral,
  });
  const classroomRemedialFlag = classReport.classroomRemedialRecommended ? 1 : 0;

  return {
    id: classReport.id,
    title: `${classReport.subject} — ${classReport.gradeSection}`,
    subtitle: `Teacher Report Preview · ${schoolYear ?? classReport.schoolYear} · ${quarter ?? classReport.quarter}`,
    aralEligible,
    classInformation: {
      subject: classReport.subject,
      gradeSection: classReport.gradeSection,
      quarter: quarter ?? classReport.quarter,
      teacher: teacherName ?? classReport.teacherName,
      schoolYear: schoolYear ?? classReport.schoolYear,
    },
    academic: {
      classAverage: classReport.averageGrade,
      passingRate:
        passingRateFromGrades(classReport.subjectGrades) != null
          ? `${passingRateFromGrades(classReport.subjectGrades)}%`
          : "—",
      highestSubject: classReport.subject,
      lowestSubject: classReport.subject,
      requiringIntervention: aral + classroomRemedialFlag,
    },
    attendance: {
      average: "—",
      perfect: "—",
      below90: "—",
      // SF2 metrics live in Attendance Monitoring; class reports keep a placeholder.
      chart: [],
    },
    weakSubjects:
      weakSubjects.length > 0
        ? weakSubjects
        : [{ subject: classReport.subject, learners: 0, percent: 0 }],
    monitoring: {
      aralScreening: aralDisplay,
      classroomRemediation: classroomRemedialFlag,
      monitoringCompleted: monitoringBuckets.completed,
      stillUnderMonitoring:
        monitoringBuckets.ongoing + monitoringBuckets.needsFollowUp,
    },
    recommendations: {
      recommendAral: aralDisplay,
      // Class-level Classroom Remedial (0 or 1), not a student count.
      continueRemediation: classroomRemedialFlag,
      showingImprovement: monitoringBuckets.improved,
      immediateFollowUp: monitoringBuckets.needsFollowUp,
    },
    classroomRemedial: classReport.classroomRemedial,
  };
}
