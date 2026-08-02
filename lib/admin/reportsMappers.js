import { RISK_LEVEL } from "@/lib/monitoring/recommendations";
import { buildTeacherReportsModel } from "@/lib/teacher/reportsMappers";
import {
  buildAverageGradePerSubject,
  buildPerformanceDistribution,
} from "@/lib/teacher/reportsCalculations";

const ICON_TONES = ["blue", "violet", "brown", "green", "gold", "pink"];

function countRisk(students = []) {
  const counts = {
    [RISK_LEVEL.HIGH]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.LOW]: 0,
  };
  for (const student of students) {
    const key = student.riskLevel;
    if (counts[key] !== undefined) counts[key] += 1;
    else counts[RISK_LEVEL.LOW] += 1;
  }
  return counts;
}

function buildRiskDistributionChart(students = []) {
  const counts = countRisk(students);
  const total = students.length || 1;
  return [
    {
      name: RISK_LEVEL.HIGH,
      value: counts[RISK_LEVEL.HIGH],
      color: "#e76f51",
      percent: Math.round((counts[RISK_LEVEL.HIGH] / total) * 100),
    },
    {
      name: RISK_LEVEL.MODERATE,
      value: counts[RISK_LEVEL.MODERATE],
      color: "#f4a261",
      percent: Math.round((counts[RISK_LEVEL.MODERATE] / total) * 100),
    },
    {
      name: RISK_LEVEL.LOW,
      value: counts[RISK_LEVEL.LOW],
      color: "#40916c",
      percent: Math.round((counts[RISK_LEVEL.LOW] / total) * 100),
    },
  ];
}

function buildInterventionMixChart({ aralCount, classroomRemedialCount }) {
  return [
    { name: "ARAL Learners", value: aralCount, color: "#e76f51" },
    {
      name: "Classroom Remedial",
      value: classroomRemedialCount,
      color: "#f4a261",
    },
  ];
}

function buildLessonPlanStatusChart(lessonSummary) {
  return [
    {
      name: "Approved",
      value: lessonSummary?.approved ?? 0,
      color: "#40916c",
    },
    {
      name: "Pending",
      value: lessonSummary?.pending ?? 0,
      color: "#f4a261",
    },
    {
      name: "Needs Revision",
      value: lessonSummary?.needsRevision ?? 0,
      color: "#e76f51",
    },
  ];
}

function buildAttendanceChart(attendance) {
  const trends = Array.isArray(attendance?.trends) ? attendance.trends : [];
  return trends.map((row) => ({
    name: row.monthName || `M${row.month}`,
    rate: row.rate ?? 0,
    present: row.present,
    absent: row.absent,
  }));
}

function mapAdminClassRows(classReports = []) {
  return classReports.map((row, index) => {
    const highRisk = (row.classStudents ?? []).filter(
      (s) => s.riskLevel === RISK_LEVEL.HIGH
    ).length;
    const interventionCount = row.aralEligible
      ? row.aralScreening
      : row.classroomRemedialRecommended
        ? row.remedialMeta?.belowPassingCount ?? 0
        : 0;

    return {
      id: row.id,
      className: row.gradeSection,
      subject: row.subject,
      iconTone: ICON_TONES[index % ICON_TONES.length],
      students: row.students,
      averageGrade:
        row.averageGradeValue == null ? "—" : row.averageGradeValue,
      requiringIntervention: interventionCount,
      highRisk,
      latestUpload: row.lastUpdated,
      reportStatus:
        row.subjectGrades?.length > 0 ? "Available" : "Not Generated",
      teacherName: row.teacherName,
      schoolYear: row.schoolYear,
      quarter: row.quarter,
      quarterNumber: row.quarterNumber,
      aralEligible: row.aralEligible,
      aralScreening: row.aralScreening,
      classroomRemedial: row.classroomRemedial,
      classroomRemedialRecommended: row.classroomRemedialRecommended,
      remedialMeta: row.remedialMeta,
      monitoringStatus: row.monitoringStatus,
      classStudents: row.classStudents,
      subjectGrades: row.subjectGrades,
    };
  });
}

function buildClassPreview(row, schoolSummary) {
  const students = row.classStudents ?? [];
  const riskCounts = countRisk(students);
  const total = students.length || 1;
  const graded = row.subjectGrades ?? [];
  const passRate =
    graded.length > 0
      ? Math.round(
          (graded.filter((g) => Number(g) >= 75).length / graded.length) * 100
        )
      : null;

  return {
    id: row.id,
    title: `${row.className} · ${row.subject}`,
    subtitle: `${row.schoolYear ?? "—"} · ${row.quarter ?? "—"} · ${row.teacherName ?? "Teacher"}`,
    classInformation: {
      teacher: row.teacherName || "—",
      subject: row.subject,
      gradeSection: row.className,
      schoolYear: row.schoolYear || "—",
      quarter: row.quarter || "—",
      students: row.students,
    },
    academic: {
      classAverage:
        row.averageGrade == null || row.averageGrade === "—"
          ? "—"
          : String(row.averageGrade),
      passingRate: passRate == null ? "—" : `${passRate}%`,
      highestSubject: row.subject,
      lowestSubject: row.subject,
      requiringIntervention: row.requiringIntervention,
    },
    attendance: {
      average: "—",
      perfect: 0,
      below90: 0,
      chart: [],
      note: "Attendance is tracked in the Attendance Monitoring module (separate from academic risk).",
    },
    weakSubjects: [],
    risk: [
      {
        level: "High Risk",
        learners: riskCounts[RISK_LEVEL.HIGH],
        percent: `${Math.round((riskCounts[RISK_LEVEL.HIGH] / total) * 100)}%`,
        tone: "red",
      },
      {
        level: "Moderate Risk",
        learners: riskCounts[RISK_LEVEL.MODERATE],
        percent: `${Math.round((riskCounts[RISK_LEVEL.MODERATE] / total) * 100)}%`,
        tone: "orange",
      },
      {
        level: "Low Risk",
        learners: riskCounts[RISK_LEVEL.LOW],
        percent: `${Math.round((riskCounts[RISK_LEVEL.LOW] / total) * 100)}%`,
        tone: "green",
      },
    ],
    intervention: {
      aralScreening: row.aralEligible ? row.aralScreening : 0,
      classroomRemediation: row.classroomRemedialRecommended ? 1 : 0,
      underMonitoring: students.filter(
        (s) => s.monitoringStatus && s.monitoringStatus !== "Not Started"
      ).length,
      monitoringCompleted: students.filter(
        (s) => s.monitoringStatus === "Completed"
      ).length,
      completionRate: row.monitoringStatus || "—",
    },
    teacherRecommendations: {
      recommendAral: row.aralEligible ? row.aralScreening : 0,
      continueRemediation: row.classroomRemedialRecommended ? 1 : 0,
      showingImprovement: 0,
      immediateAttention: riskCounts[RISK_LEVEL.HIGH],
    },
    schoolSummary,
  };
}

/**
 * Admin Reports page model from school-wide roster + lesson plans + SF2 analytics.
 */
export async function buildAdminReportsModel({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  lessonPlans = [],
  attendance = null,
  schoolYears = [],
  filters = {},
} = {}) {
  const base = await buildTeacherReportsModel({
    classes,
    enrollments,
    grades,
    monitoringRecords,
    lessonPlans,
    filters: {
      schoolYear: filters.schoolYear,
      quarter: filters.quarter,
    },
  });

  const riskCounts = countRisk(base.students);
  const atRisk = riskCounts[RISK_LEVEL.HIGH] + riskCounts[RISK_LEVEL.MODERATE];
  const classRows = mapAdminClassRows(base.classReports);
  const allSubjectGrades = base.classReports.flatMap(
    (row) => row.subjectGrades ?? []
  );

  const schoolSummary = {
    overallAverage: base.summary.averageClassGrade ?? "—",
    totalLearners: base.summary.totalStudents,
    atRisk,
    aralScreening: base.summary.aralScreeningCount,
    classroomRemediation: base.summary.classroomRemedialCount,
    monitoringCompletionRate: `${base.summary.monitoringCompletionRate}%`,
    lessonPlansApproved: base.lessonSummary.approved,
    academicRecordsValidated: classRows.filter(
      (r) => r.reportStatus === "Available"
    ).length,
  };

  const quickStats = [
    {
      id: "classes",
      label: "Classes",
      value: base.summary.totalClasses,
      icon: "book",
      tone: "green",
    },
    {
      id: "at-risk",
      label: "At-Risk Learners",
      value: atRisk,
      icon: "alert",
      tone: "orange",
    },
    {
      id: "intervention",
      label: "ARAL Learners",
      value: base.summary.aralScreeningCount,
      icon: "chart",
      tone: "blue",
    },
    {
      id: "pending",
      label: "LP Pending Review",
      value: base.lessonSummary.pending,
      icon: "clock",
      tone: "red",
    },
  ];

  const reportCards = [
    {
      id: "academic",
      title: "Academic Performance",
      status: allSubjectGrades.length ? "Live" : "No grades",
      statusTone: allSubjectGrades.length ? "green" : "orange",
      metrics: [
        {
          label: "Overall Class Average",
          value:
            base.summary.averageClassGrade == null
              ? "—"
              : String(base.summary.averageClassGrade),
        },
        {
          label: "Passing Rate",
          value:
            base.summary.passingRate == null
              ? "—"
              : `${base.summary.passingRate}%`,
        },
        {
          label: "Lowest Performing Subject",
          value: base.summary.lowestSubject,
        },
        {
          label: "Learners Requiring Intervention",
          value: String(atRisk),
          tone: atRisk > 0 ? "danger" : "default",
        },
      ],
      actions: ["view"],
    },
    {
      id: "intervention",
      title: "Intervention Report",
      status: "Live",
      statusTone: "green",
      metrics: [
        {
          label: "ARAL Learners",
          value: String(base.summary.aralScreeningCount),
        },
        {
          label: "Classroom Remediation",
          value: String(base.summary.classroomRemedialCount),
        },
        {
          label: "Under Monitoring",
          value: String(base.summary.learnersUnderMonitoring),
        },
        {
          label: "Monitoring Completed",
          value: String(base.summary.monitoringCompleted),
        },
      ],
      actions: ["view"],
    },
    {
      id: "lesson-plan",
      title: "Lesson Plan Report",
      status: base.lessonSummary.pending > 0 ? "Needs Review" : "Live",
      statusTone: base.lessonSummary.pending > 0 ? "orange" : "green",
      metrics: [
        { label: "Submitted", value: String(base.lessonSummary.total) },
        { label: "Approved", value: String(base.lessonSummary.approved) },
        {
          label: "Needs Revision",
          value: String(base.lessonSummary.needsRevision),
        },
        {
          label: "Pending Review",
          value: String(base.lessonSummary.pending),
        },
      ],
      actions: ["view"],
    },
    {
      id: "attendance",
      title: "Attendance Monitoring",
      status: attendance ? "Live" : "No SF2 data",
      statusTone: attendance ? "green" : "orange",
      metrics: [
        {
          label: "Monthly Attendance Rate",
          value:
            attendance?.monthlyAttendanceRate == null
              ? "—"
              : `${attendance.monthlyAttendanceRate}%`,
        },
        {
          label: "Near 20% Absence",
          value: String(attendance?.nearThresholdCount ?? 0),
          tone:
            (attendance?.nearThresholdCount ?? 0) > 0 ? "danger" : "default",
        },
        {
          label: "Present Days (total)",
          value: String(attendance?.presentTotal ?? 0),
        },
        {
          label: "Absent Days (total)",
          value: String(attendance?.absentTotal ?? 0),
        },
      ],
      actions: ["view"],
      note: "Separate from Academic Prediction (grades only).",
    },
  ];

  const charts = {
    riskDistribution: buildRiskDistributionChart(base.students),
    performanceBySubject: buildAverageGradePerSubject(base.classReports),
    performanceDistribution: buildPerformanceDistribution(allSubjectGrades),
    interventionMix: buildInterventionMixChart({
      aralCount: base.summary.aralScreeningCount,
      classroomRemedialCount: base.summary.classroomRemedialCount,
    }),
    lessonPlanStatus: buildLessonPlanStatusChart(base.lessonSummary),
    attendanceByMonth: buildAttendanceChart(attendance),
  };

  return {
    quickStats,
    reportCards,
    classReports: classRows,
    charts,
    summary: base.summary,
    lessonSummary: base.lessonSummary,
    schoolSummary,
    schoolYears:
      schoolYears.length > 0
        ? schoolYears
        : base.filterOptions.schoolYears ?? [],
    attendance,
    buildPreviewForClass(classId) {
      const row = classRows.find((item) => item.id === classId);
      if (!row) return null;
      return buildClassPreview(row, schoolSummary);
    },
  };
}
