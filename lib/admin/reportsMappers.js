import { RECOMMENDATION, RISK_LEVEL } from "@/lib/monitoring/recommendations";
import { buildTeacherReportsModel } from "@/lib/teacher/reportsMappers";
import {
  buildAverageGradePerSubject,
  buildPerformanceDistribution,
} from "@/lib/teacher/reportsCalculations";
import {
  GRADE_RISK_BANDS,
  riskLevelFromGrade,
} from "@/lib/services/recommendation/riskFromGrade";
import { parseTermNumber } from "@/lib/academic/termLabels";
import { groupClassReportsForFolderLibrary } from "@/lib/reports/groupClassFolders";
import {
  buildAdminMonitoringStats,
  groupMonitoredStudentsForAdmin,
} from "@/lib/teacher/monitoringMappers";
import { buildHtReceivedClassReportFiles } from "@/lib/monitoring/classReportFiles";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import { ARAL_APPROVAL_STATUS } from "@/lib/monitoring/aralApproval";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";

const ICON_TONES = ["blue", "violet", "brown", "green", "gold", "pink"];

/** Final Grade / Average (DB quarter 4) — computed from Terms 1–3; omit from Reports lists. */
function isInstructionalTermRow(row) {
  return parseTermNumber(row?.quarterNumber ?? row?.quarter) !== 4;
}

function toGradeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function countRisk(students = []) {
  const counts = {
    [RISK_LEVEL.HIGH]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.LOW]: 0,
  };
  for (const student of students) {
    if (student.predictionsPending || student.riskLevel === "—") continue;
    const key = student.riskLevel;
    if (counts[key] !== undefined) counts[key] += 1;
  }
  return counts;
}

function countGradeBands(grades = []) {
  const bands = {
    below75: 0,
    band75to84: 0,
    band85plus: 0,
    // Backward-compatible aliases for existing report UI keys
    band75to80: 0,
    above80: 0,
    graded: 0,
  };
  for (const raw of grades) {
    const n = toGradeNumber(raw);
    if (n === null) continue;
    bands.graded += 1;
    if (n < GRADE_RISK_BANDS.highBelow) {
      bands.below75 += 1;
    } else if (n <= GRADE_RISK_BANDS.moderateMax) {
      bands.band75to84 += 1;
      bands.band75to80 += 1;
    } else {
      bands.band85plus += 1;
      bands.above80 += 1;
    }
  }
  return bands;
}

function resolveStudentSubjectGrade(
  student = {},
  classSubject = "",
  quarterNumber = null
) {
  // Prefer already-resolved class subject grade from monitoring roster.
  const direct = toGradeNumber(student.classSubjectGrade);
  if (direct !== null) return direct;

  const target = String(classSubject || student.subject || "")
    .trim()
    .toLowerCase();
  const rows = Array.isArray(student.subjectGrades)
    ? student.subjectGrades
    : [];

  for (const row of rows) {
    const subject = String(row.subjectName ?? row.subject ?? "")
      .trim()
      .toLowerCase();
    // Class subject only — never use another subject's grade.
    if (!target || !subject) continue;
    if (
      subject !== target &&
      !subject.includes(target) &&
      !target.includes(subject)
    ) {
      continue;
    }
    const grade = toGradeNumber(
      row.grade ?? row.finalGrade ?? row.final_grade
    );
    if (grade !== null) return grade;
  }

  // termGrades on roster rows are already scoped to the class subject.
  const terms = student.termGrades || {};
  const q = Number(quarterNumber);
  if (Number.isFinite(q) && terms[q] != null) {
    const g = toGradeNumber(terms[q]);
    if (g !== null) return g;
  }
  for (const key of [4, 3, 2, 1]) {
    const g = toGradeNumber(terms[key]);
    if (g !== null) return g;
  }
  return null;
}

/**
 * Risk counts for graded learners only (aligns with grade bands).
 */
function countGradedRisk(
  students = [],
  { classSubject, quarterNumber } = {}
) {
  const counts = {
    [RISK_LEVEL.HIGH]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.LOW]: 0,
    ungraded: 0,
    graded: 0,
  };

  for (const student of students) {
    const grade = resolveStudentSubjectGrade(
      student,
      classSubject,
      quarterNumber
    );
    if (grade === null && !student.riskLevel) {
      counts.ungraded += 1;
      continue;
    }
    counts.graded += 1;
    const risk =
      student.riskLevel &&
      Object.values(RISK_LEVEL).includes(student.riskLevel)
        ? student.riskLevel
        : riskLevelFromGrade(grade);
    if (counts[risk] !== undefined) counts[risk] += 1;
    else counts[RISK_LEVEL.LOW] += 1;
  }

  return counts;
}

function buildPriorityLearners(
  students = [],
  { classSubject, quarterNumber, aralEligible } = {}
) {
  return students
    .map((student) => {
      const grade = resolveStudentSubjectGrade(
        student,
        classSubject,
        quarterNumber
      );
      if (grade === null) return null;

      const riskLevel = student.predictionsPending
        ? "—"
        : student.riskLevel &&
            Object.values(RISK_LEVEL).includes(student.riskLevel)
          ? student.riskLevel
          : riskLevelFromGrade(grade);
      if (student.predictionsPending || riskLevel === "—") return null;
      const recommendation =
        student.recommendationDisplay || student.recommendation || "—";
      const isAral =
        aralEligible &&
        (recommendation === RECOMMENDATION.ARAL ||
          String(recommendation).toLowerCase().includes("aral"));
      const isPriority = riskLevel === RISK_LEVEL.HIGH || isAral;

      return {
        id: student.id || student.studentId,
        name: student.name || "—",
        studentNumber: student.studentNumber || "—",
        grade,
        riskLevel,
        recommendation: aralEligible
          ? recommendation
          : isAral
            ? "—"
            : recommendation,
        isPriority,
      };
    })
    .filter((row) => row && row.isPriority)
    .sort((a, b) => {
      const ga = a.grade == null ? 999 : a.grade;
      const gb = b.grade == null ? 999 : b.grade;
      if (ga !== gb) return ga - gb;
      return String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 10)
    .map(({ isPriority: _omit, ...rest }) => rest);
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
  return classReports.filter(isInstructionalTermRow).map((row, index) => {
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
  const gradedRisk = countGradedRisk(students, {
    classSubject: row.subject,
    quarterNumber: row.quarterNumber,
  });
  const gradedTotal = gradedRisk.graded || 1;
  const graded = row.subjectGrades ?? [];
  const passRate =
    graded.length > 0
      ? Math.round(
          (graded.filter((g) => Number(g) >= 75).length / graded.length) * 100
        )
      : null;

  const underMonitoring = students.filter(
    (s) => s.monitoringStatus && s.monitoringStatus !== "Not Started"
  ).length;
  const monitoringCompleted = students.filter(
    (s) => s.monitoringStatus === "Completed"
  ).length;

  const priorityLearners = buildPriorityLearners(students, {
    classSubject: row.subject,
    quarterNumber: row.quarterNumber,
    aralEligible: Boolean(row.aralEligible),
  });

  // Keep risk cards and grade bands on the same graded-learner base.
  // Prefer roster RF risk when present; otherwise official bands via riskLevelFromGrade.
  const below75 = gradedRisk[RISK_LEVEL.HIGH];
  const band75to84 = gradedRisk[RISK_LEVEL.MODERATE];
  const band85plus = gradedRisk[RISK_LEVEL.LOW];
  const band75to80 = band75to84;
  const above80 = band85plus;
  const gradedCount = gradedRisk.graded;

  return {
    id: row.id,
    title: `${row.className} · ${row.subject}`,
    subtitle: `${row.schoolYear ?? "—"} · ${row.quarter ?? "—"} · ${row.teacherName ?? "Teacher"}`,
    aralEligible: Boolean(row.aralEligible),
    classInformation: {
      teacher: row.teacherName || "—",
      subject: row.subject || "—",
      gradeSection: row.className || "—",
      schoolYear: row.schoolYear || "—",
      quarter: row.quarter || "—",
      students: row.students ?? students.length,
      lastUpload: row.latestUpload || row.lastUpdated || "—",
      monitoringStatus: row.monitoringStatus || "—",
      ungraded: gradedRisk.ungraded,
      graded: gradedCount,
    },
    academic: {
      classAverage:
        row.averageGrade == null || row.averageGrade === "—"
          ? "—"
          : String(row.averageGrade),
      passingRate: passRate == null ? "—" : `${passRate}%`,
      requiringIntervention: row.requiringIntervention ?? 0,
      gradedCount,
    },
    gradeBands: {
      below75,
      band75to84,
      band85plus,
      band75to80,
      above80,
      graded: gradedCount,
      ungraded: gradedRisk.ungraded,
    },
    risk: [
      {
        level: "High Risk",
        learners: gradedRisk[RISK_LEVEL.HIGH],
        percent: `${Math.round(
          (gradedRisk[RISK_LEVEL.HIGH] / gradedTotal) * 100
        )}%`,
        tone: "red",
      },
      {
        level: "Moderate Risk",
        learners: gradedRisk[RISK_LEVEL.MODERATE],
        percent: `${Math.round(
          (gradedRisk[RISK_LEVEL.MODERATE] / gradedTotal) * 100
        )}%`,
        tone: "orange",
      },
      {
        level: "Low Risk",
        learners: gradedRisk[RISK_LEVEL.LOW],
        percent: `${Math.round(
          (gradedRisk[RISK_LEVEL.LOW] / gradedTotal) * 100
        )}%`,
        tone: "green",
      },
    ],
    intervention: {
      aralScreening: row.aralEligible ? row.aralScreening : 0,
      classroomRemedial: row.classroomRemedialRecommended ? 1 : 0,
      classroomRemediation: row.classroomRemedialRecommended ? 1 : 0,
      underMonitoring,
      monitoringCompleted,
      completionRate: row.monitoringStatus || "—",
    },
    priorityLearners,
    schoolSummary,
  };
}

function buildOverviewActionCounts(students = [], classSummaries = []) {
  const files = buildHtReceivedClassReportFiles({
    students,
    classSummaries,
    teacherName: "Teacher",
  });
  const pendingFiles = files.filter(
    (f) => f.htStatus === ARAL_APPROVAL_STATUS.SUBMITTED
  ).length;
  const pendingAralApprovals = students.filter(
    (s) =>
      isAralRecommended(s) &&
      (s.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUBMITTED ||
        s.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUGGESTED)
  ).length;
  const unassignedFacilitators = students.filter(
    (s) => isAralRecommended(s) && !s.aralFacilitatorTeacherId
  ).length;
  return { pendingFiles, pendingAralApprovals, unassignedFacilitators };
}

function buildOverviewHotspots(groupedLearners = [], classRows = []) {
  const sectionMap = new Map();
  for (const learner of groupedLearners) {
    const label = String(learner.gradeSection || "—").trim() || "—";
    if (!sectionMap.has(label)) {
      sectionMap.set(label, { label, atRisk: 0, aral: 0 });
    }
    const entry = sectionMap.get(label);
    if (learner.atRisk) entry.atRisk += 1;
    if (isAralRecommended(learner)) entry.aral += 1;
  }
  const sections = [...sectionMap.values()]
    .filter((row) => row.atRisk > 0 || row.aral > 0)
    .sort(
      (a, b) => b.aral + b.atRisk - (a.aral + a.atRisk) || b.aral - a.aral
    )
    .slice(0, 6);

  const weakClasses = classRows
    .map((row) => {
      const graded = row.subjectGrades ?? [];
      const passRate =
        graded.length > 0
          ? Math.round(
              (graded.filter((g) => Number(g) >= PASSING_GRADE).length /
                graded.length) *
                100
            )
          : null;
      return {
        id: row.id,
        label: `${row.className} · ${row.subject}`,
        highRisk: Number(row.highRisk) || 0,
        needingSupport: Number(row.requiringIntervention) || 0,
        passRate,
        gradeSection: row.className,
      };
    })
    .filter(
      (row) =>
        row.highRisk > 0 ||
        row.needingSupport > 0 ||
        (row.passRate != null && row.passRate < PASSING_GRADE)
    )
    .sort((a, b) => {
      const aScore =
        a.highRisk * 2 +
        a.needingSupport +
        (a.passRate == null ? 0 : PASSING_GRADE - a.passRate);
      const bScore =
        b.highRisk * 2 +
        b.needingSupport +
        (b.passRate == null ? 0 : PASSING_GRADE - b.passRate);
      return bScore - aScore;
    })
    .slice(0, 6);

  return { sections, weakClasses };
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
  roster: rosterOverride = null,
} = {}) {
  const base = await buildTeacherReportsModel({
    classes,
    enrollments,
    grades,
    monitoringRecords,
    lessonPlans,
    roster: rosterOverride,
    filters: {
      schoolYear: filters.schoolYear,
      quarter: filters.quarter,
    },
  });

  const instructionalReports = (base.classReports ?? []).filter(
    isInstructionalTermRow
  );
  const classRows = mapAdminClassRows(instructionalReports);
  const groupedLearners = groupMonitoredStudentsForAdmin(
    base.students ?? [],
    instructionalReports
  );
  const uniqueStats = buildAdminMonitoringStats(
    groupedLearners,
    instructionalReports,
    { alreadyGrouped: true }
  );
  const folderCount = filters.quarter
    ? classRows.length
    : groupClassReportsForFolderLibrary(classRows).length;
  const uniqueLearners = groupedLearners.length;
  const atRisk = uniqueStats.totalAtRisk;
  const aralScreeningCount = uniqueStats.aral;
  const classroomRemedialCount = uniqueStats.classroomRemedialLearners;
  const allSubjectGrades = instructionalReports.flatMap(
    (row) => row.subjectGrades ?? []
  );
  const summary = {
    ...base.summary,
    totalClasses: folderCount,
    totalStudents: uniqueLearners,
    aralScreeningCount,
    classroomRemedialCount,
  };

  const schoolSummary = {
    overallAverage: summary.averageClassGrade ?? "—",
    totalLearners: uniqueLearners,
    atRisk,
    aralScreening: aralScreeningCount,
    classroomRemedial: classroomRemedialCount,
    classroomRemediation: classroomRemedialCount,
    monitoringCompletionRate: `${summary.monitoringCompletionRate}%`,
    lessonPlansApproved: base.lessonSummary.approved,
    academicRecordsValidated: classRows.filter(
      (r) => r.reportStatus === "Available"
    ).length,
    predictionsPending: Boolean(base.predictionsPending),
    lpPending: base.lessonSummary.pending,
  };

  const quickStats = [
    {
      id: "learners",
      label: "Learners",
      value: uniqueLearners,
      icon: "book",
      tone: "green",
    },
    {
      id: "at-risk",
      label: "At-risk learners",
      value: atRisk,
      icon: "alert",
      tone: atRisk > 0 ? "orange" : "green",
    },
    {
      id: "intervention",
      label: "ARAL Learners",
      value: aralScreeningCount,
      icon: "chart",
      tone: aralScreeningCount > 0 ? "blue" : "green",
    },
    {
      id: "remedial",
      label: "Classroom remedial",
      value: classroomRemedialCount,
      icon: "chart",
      tone: classroomRemedialCount > 0 ? "orange" : "green",
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
            summary.averageClassGrade == null
              ? "—"
              : String(summary.averageClassGrade),
        },
        {
          label: "Passing Rate",
          value:
            summary.passingRate == null ? "—" : `${summary.passingRate}%`,
        },
        {
          label: "Lowest Performing Subject",
          value: summary.lowestSubject,
        },
        {
          label: "Learners needing support",
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
          value: String(aralScreeningCount),
        },
        {
          label: "Classroom remedial",
          value: String(classroomRemedialCount),
        },
        {
          label: "Under Monitoring",
          value: String(summary.learnersUnderMonitoring),
        },
        {
          label: "Monitoring Completed",
          value: String(summary.monitoringCompleted),
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
          label: "Avg PA (SF2)",
          value:
            attendance?.monthlyAttendanceRate == null
              ? "—"
              : `${attendance.monthlyAttendanceRate}%`,
        },
        {
          label: "Flagged sections",
          value: String(attendance?.nearThresholdCount ?? 0),
          tone:
            (attendance?.nearThresholdCount ?? 0) > 0 ? "danger" : "default",
        },
        {
          label: "Late (total)",
          value: String(
            attendance?.sectionAnalytics?.totalLate ??
              attendance?.presentTotal ??
              0
          ),
        },
        {
          label: "Absences (total)",
          value: String(attendance?.absentTotal ?? 0),
        },
      ],
      actions: ["view"],
      note: "Separate from Academic Prediction (grades only).",
    },
  ];

  const charts = {
    riskDistribution: buildRiskDistributionChart(groupedLearners),
    performanceBySubject: buildAverageGradePerSubject(instructionalReports),
    performanceDistribution: buildPerformanceDistribution(allSubjectGrades),
    interventionMix: buildInterventionMixChart({
      aralCount: aralScreeningCount,
      classroomRemedialCount,
    }),
    lessonPlanStatus: buildLessonPlanStatusChart(base.lessonSummary),
    attendanceByMonth: buildAttendanceChart(attendance),
  };

  const overviewActionCounts = buildOverviewActionCounts(
    base.students ?? [],
    instructionalReports
  );
  const overviewHotspots = buildOverviewHotspots(groupedLearners, classRows);
  const overviewMonitoringHealth = {
    underMonitoring: Number(summary.learnersUnderMonitoring) || 0,
    completed: Number(summary.monitoringCompleted) || 0,
    completionRate: Number(summary.monitoringCompletionRate) || 0,
    ongoing: Number(uniqueStats.ongoing) || 0,
    notStarted: Number(uniqueStats.notStarted) || 0,
  };

  return {
    quickStats,
    reportCards,
    classReports: classRows,
    charts,
    summary,
    lessonSummary: base.lessonSummary,
    schoolSummary,
    schoolYears:
      schoolYears.length > 0
        ? schoolYears
        : base.filterOptions.schoolYears ?? [],
    attendance,
    overviewActionCounts,
    overviewHotspots,
    overviewMonitoringHealth,
    buildPreviewForClass(classId) {
      const row = classRows.find((item) => item.id === classId);
      if (!row) return null;
      return buildClassPreview(row, schoolSummary);
    },
  };
}
