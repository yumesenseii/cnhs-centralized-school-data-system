import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import { buildAdminExcelPayload } from "@/lib/reports/scopedExcelPayload";
import {
  reportsClassFilename,
  reportsSchoolFilename,
} from "@/lib/reports/exportFilenames";
import {
  ADMIN_REPORT_EXPORT_OPTIONS,
  ADMIN_REPORT_EXPORT_SECTIONS,
  buildDailyAttendanceExportSummary,
  normalizeAdminClassRow,
  normalizeExportSections,
  resolveAdminReportTermLabel,
} from "@/lib/admin/reportsExportShared";
import {
  downloadAdminClassReportPdf,
  downloadAdminMeetingBriefPdf,
  downloadAdminReportsPdf,
} from "@/lib/admin/reportsPdfDownload";

export {
  ADMIN_REPORT_EXPORT_OPTIONS,
  ADMIN_REPORT_EXPORT_SECTIONS,
  buildDailyAttendanceExportSummary,
  normalizeAdminClassRow,
  normalizeExportSections,
};

function resolveTermLabel(quarter) {
  return resolveAdminReportTermLabel(quarter);
}

/** Real .pdf download (jsPDF). Optional sections omit unchecked parts. */
export function exportAdminReportsPdf(args = {}) {
  downloadAdminReportsPdf(args);
}

/** Short meeting brief as real .pdf. */
export function exportAdminMeetingBriefPdf(args = {}) {
  downloadAdminMeetingBriefPdf(args);
}

/** Single-class real .pdf download. */
export function exportAdminClassReportPdf(args = {}) {
  downloadAdminClassReportPdf(args);
}

function subjectAverageExtremes(performanceBySubject = []) {
  const values = performanceBySubject
    .map((row) => Number(row.average))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return { highest: null, lowest: null };
  return {
    highest: Math.max(...values),
    lowest: Math.min(...values),
  };
}

function buildAdminChartSeries(charts = {}) {
  const series = [];

  if (charts.riskDistribution?.length) {
    series.push({
      title: "Risk distribution (class grades)",
      chartType: "donut",
      categoryHeader: "Risk Level",
      valueHeader: "Learners",
      rows: charts.riskDistribution.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  if (charts.interventionMix?.length) {
    series.push({
      title: "ARAL and classroom remedial",
      chartType: "donut",
      categoryHeader: "Type",
      valueHeader: "Count",
      rows: charts.interventionMix.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  if (charts.performanceBySubject?.length) {
    series.push({
      title: "Average grade by subject",
      chartType: "hbar",
      categoryHeader: "Subject",
      valueHeader: "Average",
      rows: charts.performanceBySubject.map((row) => ({
        category: row.subject ?? row.name,
        value: row.average ?? row.value,
      })),
    });
  }

  if (charts.lessonPlanStatus?.length) {
    series.push({
      title: "Lesson plan status",
      chartType: "donut",
      categoryHeader: "Status",
      valueHeader: "Count",
      rows: charts.lessonPlanStatus.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  return series;
}

/**
 * School-wide Excel workbook. Optional `sections` omit unchecked parts.
 * `dailyAttendance` is Morning/Afternoon this month (not uploaded SF2).
 */
export async function exportAdminReportsExcel({
  classReports = [],
  summary = {},
  schoolSummary = {},
  charts = {},
  attendance = null,
  dailyAttendance = null,
  supportSections = [],
  sections: sectionsInput = null,
  schoolYear = "",
  quarter = "",
  generatedBy = "Head Teacher / Admin",
  filename = null,
} = {}) {
  const sections = normalizeExportSections(sectionsInput ?? {});
  const scopedRows = sections.classesTable
    ? classReports.filter(Boolean)
    : [];
  const rows = scopedRows.map(normalizeAdminClassRow).filter(Boolean);
  const scoped = buildAdminExcelPayload({
    classReports: sections.classesTable
      ? classReports.filter(Boolean)
      : classReports.filter(Boolean).slice(0, 0),
    summary,
    schoolSummary,
    charts: sections.classesTable ? charts : {},
    attendance: null,
  });
  const qLabel = resolveTermLabel(quarter);
  const totalClasses = sections.classesTable
    ? scoped.summary.totalClasses
    : classReports.length;
  const totalStudents =
    summary?.totalStudents ??
    schoolSummary?.totalLearners ??
    scoped.summary.totalStudents;
  const atRisk = schoolSummary?.atRisk ?? scoped.atRisk;
  const aralLearners =
    summary?.aralScreeningCount ??
    schoolSummary?.aralScreening ??
    scoped.summary.aralScreeningCount;
  const classroomRemedial =
    summary?.classroomRemedialCount ??
    schoolSummary?.classroomRemedial ??
    schoolSummary?.classroomRemediation ??
    scoped.summary.classroomRemedialCount;
  const averageGrade =
    summary?.averageClassGrade ??
    schoolSummary?.overallAverage ??
    scoped.summary.averageClassGrade;
  const monitoringRate = scoped.monitoringRate;
  const { highest, lowest } = subjectAverageExtremes(
    scoped.charts.performanceBySubject
  );

  const metrics = [];
  if (sections.schoolSummary) {
    metrics.push(
      { label: "Total Classes", value: totalClasses, tone: "default" },
      { label: "Total Learners", value: totalStudents, tone: "default" },
      {
        label: "At-Risk Learners",
        value: atRisk,
        tone: Number(atRisk) > 0 ? "red" : "green",
      },
      {
        label: "ARAL Learners",
        value: aralLearners,
        tone: Number(aralLearners) > 0 ? "amber" : "green",
      },
      {
        label: "Classroom remedial",
        value: classroomRemedial,
        tone: Number(classroomRemedial) > 0 ? "amber" : "green",
      },
      {
        label: "Average Class Grade",
        value: averageGrade ?? "—",
        tone:
          averageGrade != null && Number(averageGrade) < 75 ? "amber" : "green",
      }
    );
  }

  if (sections.learnersNeedingSupport) {
    metrics.push(
      {
        label: "ARAL Learners (support)",
        value: aralLearners,
        tone: Number(aralLearners) > 0 ? "amber" : "green",
      },
      {
        label: "Classroom remedial (support)",
        value: classroomRemedial,
        tone: Number(classroomRemedial) > 0 ? "amber" : "green",
      },
      {
        label: "Sections needing attention",
        value: (supportSections ?? []).length,
        tone: (supportSections ?? []).length > 0 ? "amber" : "green",
      }
    );
  }

  if (sections.attendanceThisMonth) {
    metrics.push(
      {
        label: "Attendance this month",
        value: dailyAttendance?.sessionRateLabel ?? "—",
        tone:
          dailyAttendance?.sessionRate != null &&
          Number(dailyAttendance.sessionRate) < 90
            ? "amber"
            : "green",
      },
      {
        label: "Sections with attendance",
        value: dailyAttendance
          ? `${dailyAttendance.sectionsWithMarks} / ${dailyAttendance.sectionsTotal}`
          : "—",
        tone: "default",
      },
      {
        label: "Sections without attendance",
        value: dailyAttendance?.sectionsWaiting ?? "—",
        tone:
          Number(dailyAttendance?.sectionsWaiting ?? 0) > 0 ? "amber" : "green",
      }
    );
  }

  if (!metrics.length) {
    metrics.push({
      label: "Learners",
      value: totalStudents,
      tone: "default",
    });
  }

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "School-Wide Academic & Monitoring Report",
      schoolYear: schoolYear || "—",
      quarter: qLabel,
      generatedBy,
      totalRecords: rows.length,
    },
    metrics,
    chartSeries: sections.classesTable
      ? buildAdminChartSeries(scoped.charts)
      : [],
    table: sections.classesTable
      ? {
          sheetName: "Detailed Report",
          title: `Class Performance — ${schoolYear || "SY"} · ${qLabel}`,
          columns: [
            { key: "gradeSection", header: "Class", width: 18 },
            { key: "subject", header: "Subject", width: 16 },
            { key: "termDisplay", header: "Term", width: 14 },
            { key: "teacherName", header: "Teacher", width: 20 },
            { key: "students", header: "Learners", width: 11, numeric: true },
            {
              key: "averageGrade",
              header: "Avg Grade",
              width: 12,
              numeric: true,
              gradeRule: true,
            },
            {
              key: "requiringIntervention",
              header: "Needing support",
              width: 14,
              numeric: true,
            },
            { key: "aralScreeningDisplay", header: "ARAL", width: 10 },
            {
              key: "classroomRemedial",
              header: "Classroom Remedial",
              width: 18,
            },
            {
              key: "monitoringStatus",
              header: "Monitoring",
              width: 16,
              statusRule: true,
            },
            {
              key: "reportStatus",
              header: "Status",
              width: 16,
              statusRule: true,
            },
          ],
          rows,
        }
      : {
          sheetName: "Summary",
          title: `School summary — ${schoolYear || "SY"} · ${qLabel}`,
          columns: [
            { key: "label", header: "Item", width: 28 },
            { key: "value", header: "Value", width: 18 },
          ],
          rows: metrics.map((m) => ({ label: m.label, value: m.value })),
        },
    narrativeContext: {
      totalClasses,
      totalStudents,
      averageGrade,
      highestAverage: highest,
      lowestAverage: lowest,
      atRisk,
      aralLearners,
      classroomRemedial,
      monitoringRate,
      attendanceRate: dailyAttendance?.sessionRate ?? null,
    },
  });

  if (sections.learnersNeedingSupport || sections.classesTable) {
    const { appendInterventionSheet } = await import(
      "@/lib/reports/interventionCaseloadExport"
    );
    await appendInterventionSheet(workbook, {
      learners: classReports.flatMap((row) => row.classStudents ?? []),
    });
  }

  const resolvedFilename =
    filename ||
    reportsSchoolFilename({
      schoolYear,
      termLabel: resolveTermLabel(quarter),
      ext: "xlsx",
    });

  await downloadWorkbook(workbook, resolvedFilename);
}

export async function exportAdminClassReportExcel(
  classReport,
  { schoolYear, quarter, charts = {}, attendance = null } = {}
) {
  const row = normalizeAdminClassRow(classReport);
  if (!row) return;

  const filename = reportsClassFilename({
    gradeSection: row.gradeSection,
    subject: row.subject,
    termLabel: resolveTermLabel(row.quarter ?? quarter),
    schoolYear: row.schoolYear || schoolYear,
    ext: "xlsx",
  });

  await exportAdminReportsExcel({
    classReports: [classReport],
    summary: {},
    schoolSummary: {},
    charts,
    attendance: null,
    schoolYear: row.schoolYear || schoolYear,
    quarter: row.quarter || quarter,
    generatedBy: row.teacherName || "Teacher",
    filename,
  });
}
