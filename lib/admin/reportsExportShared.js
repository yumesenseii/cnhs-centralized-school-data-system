/**
 * Shared admin report export helpers (no PDF/Excel side effects).
 */

import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";
import {
  formatSessionRate,
  sessionRatePercent,
} from "@/lib/attendance/dailyAnalytics";

export function resolveAdminReportTermLabel(quarter) {
  if (!quarter) return TERM_ALL_LABEL;
  return termLabel(quarter);
}

/** Default sections for school PDF / Excel export chooser. */
export const ADMIN_REPORT_EXPORT_SECTIONS = {
  schoolSummary: true,
  classesTable: true,
  learnersNeedingSupport: true,
  attendanceThisMonth: true,
};

export const ADMIN_REPORT_EXPORT_OPTIONS = [
  {
    id: "schoolSummary",
    label: "School summary (key figures and rates)",
  },
  {
    id: "classesTable",
    label: "Classes table",
  },
  {
    id: "learnersNeedingSupport",
    label: "Learners needing support",
  },
  {
    id: "attendanceThisMonth",
    label: "Attendance this month",
  },
];

export function normalizeExportSections(sections = {}) {
  return {
    ...ADMIN_REPORT_EXPORT_SECTIONS,
    ...sections,
  };
}

/** Daily AM/PM snapshot for exports (not uploaded SF2). */
export function buildDailyAttendanceExportSummary(daily = null) {
  if (!daily) return null;
  const rows = daily.rows ?? [];
  if (!rows.length) return null;
  const sectionsWithMarks = rows.filter((row) => {
    const present = Number(row.present || 0);
    const absent = Number(row.absent || 0);
    const marked = Number(row.learnersMarked || 0);
    return present > 0 || absent > 0 || marked > 0;
  }).length;
  const present = rows.reduce((sum, row) => sum + (row.present || 0), 0);
  const absent = rows.reduce((sum, row) => sum + (row.absent || 0), 0);
  const rate =
    daily.sessionRate ?? sessionRatePercent({ present, absent });
  return {
    monthName: daily.monthName || "This month",
    sessionRate: rate,
    sessionRateLabel: formatSessionRate(rate),
    sectionsWithMarks,
    sectionsTotal: rows.length,
    sectionsWaiting: Math.max(0, rows.length - sectionsWithMarks),
  };
}

/** Normalize admin class rows for shared Excel / PDF columns. */
export function normalizeAdminClassRow(row) {
  if (!row) return null;
  const quarterSource = row.quarter ?? row.quarterNumber;
  const termDisplay =
    quarterSource === null ||
    quarterSource === undefined ||
    quarterSource === ""
      ? "—"
      : termLabel(quarterSource);
  return {
    section: row.className ?? row.gradeSection ?? row.section,
    gradeSection: row.className ?? row.gradeSection ?? row.section,
    subject: row.subject,
    students: row.students,
    averageGrade: row.averageGrade,
    averageGradeValue:
      typeof row.averageGrade === "number"
        ? row.averageGrade
        : row.averageGradeValue ?? null,
    aralScreening: row.aralScreening ?? 0,
    aralEligible: row.aralEligible,
    aralScreeningDisplay:
      row.aralEligible === false ? "—" : (row.aralScreening ?? 0),
    classroomRemedial: row.classroomRemedial ?? "—",
    classroomRemedialRecommended: Boolean(row.classroomRemedialRecommended),
    monitoringStatus: row.monitoringStatus ?? "—",
    requiringIntervention: row.requiringIntervention ?? 0,
    highRisk: row.highRisk ?? 0,
    reportStatus: row.reportStatus ?? "—",
    teacherName: row.teacherName ?? "—",
    schoolYear: row.schoolYear,
    quarter: row.quarter,
    quarterNumber: row.quarterNumber,
    termDisplay,
    classStudents: row.classStudents,
    subjectGrades: row.subjectGrades,
  };
}
