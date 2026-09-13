import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import {
  chartRowsFromList,
  escapeHtml,
  renderBarChartHtml,
  renderDataTableHtml,
  renderDetailListHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";
import { buildAdminExcelPayload } from "@/lib/reports/scopedExcelPayload";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";

function resolveTermLabel(quarter) {
  if (!quarter) return TERM_ALL_LABEL;
  return termLabel(quarter);
}

function termFilenameToken(quarter) {
  const label = resolveTermLabel(quarter);
  if (label === TERM_ALL_LABEL) return "All-Terms";
  return (
    String(label)
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 24) || "Term"
  );
}

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
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

/**
 * School-wide printable HTML report (Print → Save as PDF).
 * CNHS target layout: letterhead, KPI row (≤4), detail list, table, optional charts.
 */
export function exportAdminReportsPdf({
  schoolYear = "",
  quarter = "",
  summary = {},
  schoolSummary = {},
  classReports = [],
  charts = {},
  attendance = null,
  generatedAt = new Date(),
} = {}) {
  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const qLabel = resolveTermLabel(quarter);
  const rows = classReports.map(normalizeAdminClassRow).filter(Boolean);

  const learners = summary?.totalStudents ?? schoolSummary?.totalLearners ?? 0;
  const atRisk = schoolSummary?.atRisk ?? "—";
  const aralLearners =
    summary?.aralScreeningCount ?? schoolSummary?.aralScreening ?? 0;
  const averageGrade =
    summary?.averageClassGrade ?? schoolSummary?.overallAverage ?? "—";
  const classes =
    summary?.totalClasses ??
    schoolSummary?.academicRecordsValidated ??
    rows.length;
  const classroomRemedial =
    summary?.classroomRemedialCount ??
    schoolSummary?.classroomRemediation ??
    0;
  const attendanceRate =
    attendance?.monthlyAttendanceRate == null
      ? "—"
      : `${attendance.monthlyAttendanceRate}%`;
  const nearAbsence = attendance?.nearThresholdCount ?? 0;

  const summaryHtml = `
    ${renderKpiRowHtml([
      ["Learners", learners],
      ["At-risk", atRisk],
      ["ARAL learners", aralLearners],
      ["Avg class grade", averageGrade],
    ])}
    ${renderDetailListHtml([
      ["Classes", classes],
      ["Classroom remedial", classroomRemedial],
      ["SF2 monthly attendance", attendanceRate],
      ["Near 20% absence", nearAbsence],
    ])}
  `;

  const tableRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.gradeSection)}</td>
        <td>${escapeHtml(row.subject)}</td>
        <td>${escapeHtml(row.termDisplay)}</td>
        <td>${escapeHtml(row.teacherName)}</td>
        <td>${escapeHtml(row.students)}</td>
        <td>${escapeHtml(row.averageGrade)}</td>
        <td>${escapeHtml(row.requiringIntervention)}</td>
        <td>${escapeHtml(row.aralScreeningDisplay)}</td>
        <td>${escapeHtml(row.classroomRemedial)}</td>
        <td>${escapeHtml(row.reportStatus)}</td>
      </tr>`
    )
    .join("");

  const riskChart = renderBarChartHtml(
    "Risk Distribution",
    chartRowsFromList(charts.riskDistribution)
  );
  const interventionChart = renderBarChartHtml(
    "Intervention Mix",
    chartRowsFromList(charts.interventionMix)
  );
  const subjectChart = renderBarChartHtml(
    "Average Grade by Subject",
    chartRowsFromList(charts.performanceBySubject, "subject", "average")
  );
  const lessonPlanChart = renderBarChartHtml(
    "Lesson Plan Status",
    chartRowsFromList(charts.lessonPlanStatus)
  );
  const analyticsCharts = [
    riskChart,
    interventionChart,
    subjectChart,
    lessonPlanChart,
  ]
    .filter(Boolean)
    .join("");

  const attendanceBars = chartRowsFromList(
    charts.attendanceByMonth,
    "name",
    "rate"
  ).map((r) => ({
    ...r,
    display: r.value != null && r.value !== "" ? `${r.value}%` : "—",
  }));
  const attendanceChart = renderBarChartHtml(
    "Attendance Rate by Month",
    attendanceBars
  );

  const bodyHtml = `
    <p class="section-label">Summary</p>
    ${summaryHtml}

    <p class="section-label">Class Performance</p>
    ${renderDataTableHtml({
      headers: [
        "Class",
        "Subject",
        "Term",
        "Teacher",
        "Students",
        "Avg Grade",
        "Intervention",
        "ARAL",
        "Classroom Remedial",
        "Status",
      ],
      rowsHtml: tableRows,
      emptyText: "No class reports for the selected filters.",
    })}

    ${
      analyticsCharts
        ? `<p class="section-label">Analytics</p><div class="charts">${analyticsCharts}</div>`
        : ""
    }

    ${
      attendanceChart
        ? `<p class="section-label">Attendance Monitoring (SF2)</p><div class="charts">${attendanceChart}</div>`
        : ""
    }
  `;

  const html = wrapCnhsPrintDocument({
    documentTitle: `Admin School Report — CNHS`,
    letterheadSub: "CNHS Learn · School Reports",
    title: "SCHOOL PERFORMANCE REPORT",
    subtitle: `${schoolYear || "—"} · ${qLabel}`,
    metaRows: [
      ["School", "Cambaog National High School"],
      ["Coverage", schoolYear || "—"],
      ["Report category", "School-wide academic performance"],
      ["Term", qLabel],
      ["Report type", "Head Teacher summary"],
      ["Date generated", dateGenerated],
    ],
    noteHtml:
      "Academic risk is based on ECR grades only. Attendance (SF2) is a separate monitoring module.",
    bodyHtml,
    signatureLabel: "Reviewed / certified by Head Teacher:",
  });

  openPrintableHtml(html, {
    title: `Admin-Report-${schoolYear || "CNHS"}`,
    autoPrint: true,
  });
}

/**
 * Single-class printable PDF from live admin class row / preview.
 */
export function exportAdminClassReportPdf({
  classReport,
  schoolYear = "",
  quarter = "",
} = {}) {
  const row = normalizeAdminClassRow(classReport);
  if (!row) {
    throw new Error("Class report is required.");
  }

  exportAdminReportsPdf({
    schoolYear: row.schoolYear || schoolYear,
    quarter: row.quarter || quarter,
    summary: {
      totalClasses: 1,
      totalStudents: row.students,
      aralScreeningCount: row.aralEligible ? row.aralScreening : 0,
      classroomRemedialCount: row.classroomRemedialRecommended ? 1 : 0,
      averageClassGrade: row.averageGradeValue ?? row.averageGrade,
    },
    schoolSummary: {
      atRisk: row.highRisk,
      aralScreening: row.aralEligible ? row.aralScreening : 0,
      classroomRemediation: row.classroomRemedialRecommended ? 1 : 0,
      overallAverage: row.averageGradeValue ?? row.averageGrade,
      totalLearners: row.students,
    },
    classReports: [classReport],
    charts: {},
    attendance: null,
  });
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
      title: "Risk Distribution (ECR grades)",
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
      title: "Intervention Mix",
      chartType: "donut",
      categoryHeader: "Intervention",
      valueHeader: "Count",
      rows: charts.interventionMix.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  if (charts.performanceBySubject?.length) {
    series.push({
      title: "Average Grade by Subject",
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
      title: "Lesson Plan Status",
      chartType: "donut",
      categoryHeader: "Status",
      valueHeader: "Count",
      rows: charts.lessonPlanStatus.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  if (charts.attendanceByMonth?.length) {
    series.push({
      title: "SF2 Attendance Rate by Month",
      chartType: "bar",
      categoryHeader: "Month",
      valueHeader: "Attendance %",
      rows: charts.attendanceByMonth.map((row) => ({
        category: row.name,
        value: row.rate ?? row.value,
      })),
    });
  }

  return series;
}

/**
 * School-wide Excel workbook from live admin reports (official CNHS template).
 * Cover metrics, charts, table, and narratives all use the same scoped payload.
 */
export async function exportAdminReportsExcel({
  classReports = [],
  summary = {},
  schoolSummary = {},
  charts = {},
  attendance = null,
  schoolYear = "",
  quarter = "",
  generatedBy = "Head Teacher / Admin",
  filename = null,
} = {}) {
  const rows = classReports.map(normalizeAdminClassRow).filter(Boolean);
  const scoped = buildAdminExcelPayload({
    classReports: classReports.filter(Boolean),
    summary,
    schoolSummary,
    charts,
    attendance,
  });
  const qLabel = resolveTermLabel(quarter);
  const totalClasses = scoped.summary.totalClasses;
  const totalStudents = scoped.summary.totalStudents;
  const atRisk = scoped.atRisk;
  const aralLearners = scoped.summary.aralScreeningCount;
  const classroomRemedial = scoped.summary.classroomRemedialCount;
  const averageGrade = scoped.summary.averageClassGrade;
  const monitoringRate = scoped.monitoringRate;
  const attendanceRate = attendance?.monthlyAttendanceRate ?? null;
  const { highest, lowest } = subjectAverageExtremes(
    scoped.charts.performanceBySubject
  );

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "School-Wide Academic & Monitoring Report",
      schoolYear: schoolYear || "—",
      quarter: qLabel,
      generatedBy,
      totalRecords: rows.length,
    },
    metrics: [
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
        label: "Classroom Remedial Classes",
        value: classroomRemedial,
        tone: Number(classroomRemedial) > 0 ? "amber" : "green",
      },
      {
        label: "Average Class Grade",
        value: averageGrade ?? "—",
        tone:
          averageGrade != null && Number(averageGrade) < 75 ? "amber" : "green",
      },
      {
        label: "SF2 Monthly Attendance Rate",
        value: attendanceRate == null ? "—" : `${attendanceRate}%`,
        tone:
          attendanceRate != null && Number(attendanceRate) < 90
            ? "amber"
            : "green",
      },
      {
        label: "Near 20% Absence",
        value: attendance?.nearThresholdCount ?? 0,
        tone:
          Number(attendance?.nearThresholdCount ?? 0) > 0 ? "red" : "green",
      },
    ],
    chartSeries: buildAdminChartSeries(scoped.charts),
    table: {
      sheetName: "Detailed Report",
      title: `Class Performance — ${schoolYear || "SY"} · ${qLabel}`,
      columns: [
        { key: "gradeSection", header: "Class", width: 18 },
        { key: "subject", header: "Subject", width: 16 },
        { key: "termDisplay", header: "Term", width: 14 },
        { key: "teacherName", header: "Teacher", width: 20 },
        { key: "students", header: "Students", width: 11, numeric: true },
        {
          key: "averageGrade",
          header: "Avg Grade",
          width: 12,
          numeric: true,
          gradeRule: true,
        },
        {
          key: "requiringIntervention",
          header: "Intervention",
          width: 12,
          numeric: true,
        },
        { key: "aralScreeningDisplay", header: "ARAL", width: 10 },
        { key: "classroomRemedial", header: "Classroom Remedial", width: 18 },
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
      attendanceRate,
    },
  });

  const { appendInterventionSheet } = await import(
    "@/lib/reports/interventionCaseloadExport"
  );
  await appendInterventionSheet(workbook, {
    learners: classReports.flatMap((row) => row.classStudents ?? []),
  });

  const resolvedFilename =
    filename ||
    `Enhanced_Admin_Reports_${safeToken(schoolYear || "SY")}_${termFilenameToken(quarter)}.xlsx`;

  await downloadWorkbook(workbook, resolvedFilename);
}

export async function exportAdminClassReportExcel(
  classReport,
  { schoolYear, quarter, charts = {}, attendance = null } = {}
) {
  const row = normalizeAdminClassRow(classReport);
  if (!row) return;

  const filename = `Enhanced_Class_Report_${safeToken(row.subject)}_${safeToken(
    row.gradeSection
  )}_${termFilenameToken(row.quarter ?? quarter)}.xlsx`;

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
