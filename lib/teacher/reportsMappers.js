import { RECOMMENDATION } from "@/lib/monitoring/recommendations";
import {
  formatPersonName,
} from "@/lib/teacher/monitoringMappers";
import { getCachedBuiltTeacherRoster } from "@/lib/teacher/teacherRosterCache";
import { getCachedBuiltMonitoringRoster } from "@/lib/admin/adminRosterCache";
import {
  CLASSROOM_REMEDIAL,
  PASSING_GRADE,
  REPORT_FILTER_ALL,
} from "@/lib/teacher/reportsConstants";
import { parseTermNumber, termLabel } from "@/lib/academic/termLabels";
import { formatSf2LearnerName } from "@/lib/attendance/sf2Daily";
import { compareLearnersBySurname } from "@/lib/ecr/gridLayout";
import {
  gradeForReportTerm,
  isFailingLearner,
  isPassingLearner,
  isUngradedLearner,
  riskLabelForReportTerm,
} from "@/lib/monitoring/classReportFiles";
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
  roster: rosterOverride = null,
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
  const roster =
    rosterOverride ??
    (resolvedTeacherId
      ? await getCachedBuiltTeacherRoster(payload, {
          teacherId: resolvedTeacherId,
        })
      : await getCachedBuiltMonitoringRoster(payload, scope));

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
    const aralPending = classStudents.some((s) => s.predictionsPending);
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
      aralScreeningDisplay: aralPending
        ? "—"
        : formatAralScreeningCell({
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
          value: roster.predictionsPending
            ? "—"
            : String(summary.aralScreeningCount),
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
          value: roster.predictionsPending
            ? "—"
            : String(summary.aralScreeningCount),
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
    predictionsPending: Boolean(roster.predictionsPending),
  };
}

function reportLearnerName(learner = {}) {
  const named = formatSf2LearnerName({
    last_name: learner.lastName ?? learner.last_name,
    first_name: learner.firstName ?? learner.first_name,
    middle_name: learner.middleName ?? learner.middle_name,
  });
  if (named && named !== "—") return named;
  return learner.name || "Learner";
}

function sortBySurname(learners = []) {
  return [...learners].sort((a, b) =>
    compareLearnersBySurname(
      {
        last_name: a.lastName ?? a.last_name,
        first_name: a.firstName ?? a.first_name,
        name: a.name,
      },
      {
        last_name: b.lastName ?? b.last_name,
        first_name: b.firstName ?? b.first_name,
        name: b.name,
      }
    )
  );
}

function mapActionLearner(learner, reportQuarter, classId) {
  const grade = gradeForReportTerm(learner, reportQuarter);
  const risk = riskLabelForReportTerm(learner, reportQuarter);
  const id = learner.classId || classId;
  return {
    studentId: learner.studentId,
    classId: id,
    name: reportLearnerName(learner),
    lastName: learner.lastName ?? learner.last_name ?? null,
    firstName: learner.firstName ?? learner.first_name ?? null,
    grade,
    gradeLabel: grade === null ? "—" : grade,
    risk,
    hrefClass: id ? `/teacher/my-classes/${id}` : null,
    hrefERecord: id ? `/teacher/my-classes/${id}/e-record` : null,
    hrefMonitoring: "/teacher/monitoring",
  };
}

/**
 * Single-class Teacher Report snapshot.
 * Grades from termGrades[term] only (empty → UNGRADED, not 0).
 */
export function buildClassReportPreview(classReport, { teacherName, schoolYear, quarter } = {}) {
  if (!classReport) return null;

  const classStudents = classReport.classStudents ?? [];
  const classId = classReport.id;
  const reportQuarter =
    parseTermNumber(classReport.quarterNumber ?? classReport.quarter ?? quarter) ??
    1;
  const termName = termLabel(reportQuarter);
  const sy = schoolYear ?? classReport.schoolYear;
  const generatedAt = new Date();

  const aralEligible =
    classReport.aralEligible ?? isAralEligibleSubject(classReport.subject);

  const failing = [];
  const moderate = [];
  const passing = [];
  const ungraded = [];
  const gradedValues = [];

  for (const learner of classStudents) {
    const g = gradeForReportTerm(learner, reportQuarter);
    if (isUngradedLearner(learner, reportQuarter)) {
      ungraded.push(learner);
    } else if (isFailingLearner(learner, PASSING_GRADE, reportQuarter)) {
      failing.push(learner);
      if (g !== null) gradedValues.push(g);
    } else if (isPassingLearner(learner, PASSING_GRADE, reportQuarter)) {
      passing.push(learner);
      if (g !== null) gradedValues.push(g);
    } else {
      moderate.push(learner);
      if (g !== null) gradedValues.push(g);
    }
  }

  const rosterSize = classStudents.length;
  const gradedCount = gradedValues.length;
  const ungradedCount = ungraded.length;
  const failingCount = failing.length;
  const classAverage = averageOf(gradedValues);
  const passingAmongGraded =
    gradedCount > 0
      ? gradedValues.filter((g) => g >= PASSING_GRADE).length
      : 0;
  const passingRatePct =
    gradedCount > 0 ? Math.round((passingAmongGraded / gradedCount) * 100) : null;
  const belowPassingPercentOfGraded =
    gradedCount > 0 ? Math.round((failingCount / gradedCount) * 100) : 0;
  const belowPassingPercentOfRoster =
    rosterSize > 0 ? Math.round((failingCount / rosterSize) * 100) : 0;

  const monitoringBuckets = countMonitoringBuckets(classStudents);
  const aralCount = aralEligible ? (classReport.aralScreening ?? 0) : 0;
  const aralDisplay = formatAralScreeningCell({
    aralEligible,
    aralScreening: aralCount,
  });
  const remedialYes = Boolean(classReport.classroomRemedialRecommended);
  const classroomRemedialLabel = remedialYes ? "Yes" : "No";

  const failingLearners = sortBySurname(failing).map((row) =>
    mapActionLearner(row, reportQuarter, classId)
  );
  const ungradedLearners = sortBySurname(ungraded).map((row) =>
    mapActionLearner(row, reportQuarter, classId)
  );

  const percentOfRoster = (count) =>
    rosterSize > 0 ? Math.round((count / rosterSize) * 100) : 0;

  const performanceBuckets = [
    {
      id: "failing",
      label: "FAILING (<75)",
      learners: failingCount,
      percent: percentOfRoster(failingCount),
      tone: "red",
    },
    {
      id: "moderate",
      label: "MODERATE (75–84)",
      learners: moderate.length,
      percent: percentOfRoster(moderate.length),
      tone: "amber",
    },
    {
      id: "passing",
      label: "PASSING (≥85)",
      learners: passing.length,
      percent: percentOfRoster(passing.length),
      tone: "green",
    },
    {
      id: "ungraded",
      label: "UNGRADED",
      learners: ungradedCount,
      percent: percentOfRoster(ungradedCount),
      tone: "slate",
    },
  ];

  const interventions = {
    aral: aralDisplay,
    classroomRemedial: classroomRemedialLabel,
    classroomRemedialRecommended: remedialYes,
    monitoringCompleted: monitoringBuckets.completed,
    stillUnderMonitoring:
      monitoringBuckets.ongoing + monitoringBuckets.needsFollowUp,
    showingImprovement: monitoringBuckets.improved,
    needsFollowUp: monitoringBuckets.needsFollowUp,
  };

  return {
    id: classId,
    title: `${classReport.subject} — ${classReport.gradeSection}`,
    subtitle: `Generated from E-Record · ${termName} · ${sy ?? "—"}`,
    generatedAt: generatedAt.toISOString(),
    generatedAtLabel: generatedAt.toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    reportQuarter,
    termLabel: termName,
    aralEligible,
    classInformation: {
      subject: classReport.subject,
      gradeSection: classReport.gradeSection,
      term: termName,
      teacher: teacherName ?? classReport.teacherName,
      schoolYear: sy,
    },
    academic: {
      classAverage: classAverage == null ? "—" : classAverage,
      passingRate: passingRatePct == null ? "—" : `${passingRatePct}%`,
      passingRateDetail:
        gradedCount > 0
          ? `${passingAmongGraded} of ${gradedCount} graded`
          : "No graded learners",
      belowPassingCount: failingCount,
      belowPassingPercent: belowPassingPercentOfGraded,
      belowPassingPercentOfRoster,
      gradedCount,
      ungradedCount,
      rosterSize,
      requiringIntervention: failingCount,
    },
    attendance: {
      available: false,
    },
    performanceBuckets,
    failingLearners,
    ungradedLearners,
    interventions,
    monitoring: {
      aralScreening: aralDisplay,
      classroomRemediation: classroomRemedialLabel,
      monitoringCompleted: monitoringBuckets.completed,
      stillUnderMonitoring:
        monitoringBuckets.ongoing + monitoringBuckets.needsFollowUp,
    },
    recommendations: {
      recommendAral: aralDisplay,
      continueRemediation: classroomRemedialLabel,
      showingImprovement: monitoringBuckets.improved,
      immediateFollowUp: monitoringBuckets.needsFollowUp,
    },
    classroomRemedial: remedialYes
      ? CLASSROOM_REMEDIAL.RECOMMENDED
      : CLASSROOM_REMEDIAL.NOT_NEEDED,
  };
}
