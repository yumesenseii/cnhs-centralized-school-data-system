/**
 * Build Excel export summary + charts from the class rows in scope
 * so Cover / Charts / Detailed / Narratives all match the same payload.
 */

import { RISK_LEVEL } from "@/lib/monitoring/recommendations";
import {
  buildAralDistribution,
  buildAverageGradePerSubject,
  buildMonitoringProgressChart,
  buildPerformanceDistribution,
  monitoringCompletionRate,
} from "@/lib/teacher/reportsCalculations";

function collectStudents(classReports = []) {
  return classReports.flatMap((row) => row.classStudents ?? []);
}

function collectGrades(classReports = []) {
  return classReports.flatMap((row) => row.subjectGrades ?? []);
}

function countAtRisk(students = []) {
  return students.filter(
    (s) =>
      s.riskLevel === RISK_LEVEL.HIGH || s.riskLevel === RISK_LEVEL.MODERATE
  ).length;
}

function sumStudents(classReports = []) {
  return classReports.reduce((sum, row) => sum + Number(row.students || 0), 0);
}

function averageGradeFromRows(classReports = []) {
  const values = classReports
    .map((row) => {
      if (typeof row.averageGradeValue === "number") return row.averageGradeValue;
      if (typeof row.averageGrade === "number") return row.averageGrade;
      const n = Number(row.averageGrade);
      return Number.isFinite(n) ? n : null;
    })
    .filter((n) => n !== null);
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Teacher-scoped payload from the class reports included in this export.
 */
export function buildTeacherExcelPayload({
  classReports = [],
  summary = {},
  charts = {},
} = {}) {
  const rows = classReports.filter(Boolean);
  const students = collectStudents(rows);
  const grades = collectGrades(rows);

  const rebuiltCharts = {
    performanceDistribution: buildPerformanceDistribution(grades),
    aralDistribution: buildAralDistribution(students),
    averageGradePerSubject: buildAverageGradePerSubject(rows),
    monitoringProgress: buildMonitoringProgressChart(students),
  };

  const hasIncomingCharts =
    (charts.performanceDistribution?.length ?? 0) > 0 ||
    (charts.averageGradePerSubject?.length ?? 0) > 0 ||
    (charts.aralDistribution?.length ?? 0) > 0 ||
    (charts.monitoringProgress?.length ?? 0) > 0;

  const resolvedCharts = hasIncomingCharts
    ? {
        performanceDistribution:
          charts.performanceDistribution?.length
            ? charts.performanceDistribution
            : rebuiltCharts.performanceDistribution,
        aralDistribution:
          charts.aralDistribution?.length
            ? charts.aralDistribution
            : rebuiltCharts.aralDistribution,
        averageGradePerSubject:
          charts.averageGradePerSubject?.length
            ? charts.averageGradePerSubject
            : rebuiltCharts.averageGradePerSubject,
        monitoringProgress:
          charts.monitoringProgress?.length
            ? charts.monitoringProgress
            : rebuiltCharts.monitoringProgress,
      }
    : rebuiltCharts;

  const aralFromRows = rows.reduce((sum, row) => {
    if (row.aralEligible === false) return sum;
    return sum + Number(row.aralScreening ?? 0);
  }, 0);
  const remedialFromRows = rows.filter(
    (row) => row.classroomRemedialRecommended
  ).length;

  const resolvedSummary = {
    totalClasses: summary.totalClasses ?? rows.length,
    totalStudents: summary.totalStudents ?? sumStudents(rows),
    aralScreeningCount: summary.aralScreeningCount ?? aralFromRows,
    classroomRemedialCount:
      summary.classroomRemedialCount ?? remedialFromRows,
    averageClassGrade:
      summary.averageClassGrade ?? averageGradeFromRows(rows),
    monitoringCompletionRate:
      summary.monitoringCompletionRate ??
      monitoringCompletionRate(students),
  };

  return {
    summary: resolvedSummary,
    charts: resolvedCharts,
    atRisk: countAtRisk(students),
  };
}

/**
 * Admin-scoped payload; rebuilds academic charts from class rows when missing.
 * Keeps lesson-plan / attendance series from the live admin charts object.
 */
export function buildAdminExcelPayload({
  classReports = [],
  summary = {},
  schoolSummary = {},
  charts = {},
  attendance = null,
} = {}) {
  const rows = classReports.filter(Boolean);
  const students = collectStudents(rows);
  const grades = collectGrades(rows);

  const rebuiltRisk = (() => {
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
  })();

  const aralCount =
    summary.aralScreeningCount ??
    schoolSummary.aralScreening ??
    rows.reduce((sum, row) => {
      if (row.aralEligible === false) return sum;
      return sum + Number(row.aralScreening ?? 0);
    }, 0);
  const remedialCount =
    summary.classroomRemedialCount ??
    schoolSummary.classroomRemediation ??
    rows.filter((row) => row.classroomRemedialRecommended).length;

  const rebuiltIntervention = [
    { name: "ARAL Learners", value: aralCount, color: "#e76f51" },
    {
      name: "Classroom Remedial",
      value: remedialCount,
      color: "#f4a261",
    },
  ];

  const resolvedCharts = {
    riskDistribution: charts.riskDistribution?.length
      ? charts.riskDistribution
      : rebuiltRisk,
    performanceBySubject: charts.performanceBySubject?.length
      ? charts.performanceBySubject
      : buildAverageGradePerSubject(rows),
    performanceDistribution: charts.performanceDistribution?.length
      ? charts.performanceDistribution
      : buildPerformanceDistribution(grades),
    interventionMix: charts.interventionMix?.length
      ? charts.interventionMix
      : rebuiltIntervention,
    lessonPlanStatus: charts.lessonPlanStatus ?? [],
    attendanceByMonth: charts.attendanceByMonth?.length
      ? charts.attendanceByMonth
      : Array.isArray(attendance?.trends)
        ? attendance.trends.map((row) => ({
            name: row.monthName || `M${row.month}`,
            rate: row.rate ?? 0,
            present: row.present,
            absent: row.absent,
          }))
        : [],
  };

  const atRisk =
    schoolSummary.atRisk ??
    countAtRisk(students);

  const monitoringRaw =
    schoolSummary.monitoringCompletionRate ??
    summary.monitoringCompletionRate;
  let monitoringRate = null;
  if (monitoringRaw != null && monitoringRaw !== "") {
    const n = Number(String(monitoringRaw).replace(/%/g, ""));
    monitoringRate = Number.isFinite(n) ? n : null;
  }
  if (monitoringRate == null && students.length) {
    monitoringRate = monitoringCompletionRate(students);
  }

  const resolvedSummary = {
    totalClasses: summary.totalClasses ?? rows.length,
    totalStudents:
      summary.totalStudents ??
      schoolSummary.totalLearners ??
      sumStudents(rows),
    aralScreeningCount: aralCount,
    classroomRemedialCount: remedialCount,
    averageClassGrade:
      summary.averageClassGrade ??
      schoolSummary.overallAverage ??
      averageGradeFromRows(rows),
    monitoringCompletionRate: monitoringRate ?? 0,
  };

  const resolvedSchoolSummary = {
    ...schoolSummary,
    atRisk,
    totalLearners: resolvedSummary.totalStudents,
    aralScreening: aralCount,
    classroomRemediation: remedialCount,
    overallAverage: resolvedSummary.averageClassGrade,
    monitoringCompletionRate:
      schoolSummary.monitoringCompletionRate ??
      (monitoringRate == null ? undefined : `${monitoringRate}%`),
  };

  return {
    summary: resolvedSummary,
    schoolSummary: resolvedSchoolSummary,
    charts: resolvedCharts,
    atRisk,
    monitoringRate: monitoringRate ?? 0,
  };
}
