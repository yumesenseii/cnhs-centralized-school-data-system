import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";
import { buildAdminExcelPayload } from "@/lib/reports/scopedExcelPayload";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chartListHtml(title, rows = [], nameKey = "name", valueKey = "value") {
  if (!rows?.length) {
    return `<h3>${escapeHtml(title)}</h3><p>No data</p>`;
  }
  const items = rows
    .map(
      (row) =>
        `<li><span>${escapeHtml(row[nameKey])}</span><strong>${escapeHtml(
          row[valueKey]
        )}${row.percent != null ? ` (${escapeHtml(row.percent)}%)` : ""}</strong></li>`
    )
    .join("");
  return `<h3>${escapeHtml(title)}</h3><ul class="chart-list">${items}</ul>`;
}

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

/** Normalize admin class rows for shared Excel columns. */
export function normalizeAdminClassRow(row) {
  if (!row) return null;
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
    classStudents: row.classStudents,
    subjectGrades: row.subjectGrades,
  };
}

/**
 * School-wide printable HTML report (Print → Save as PDF).
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

  const summaryRows = [
    ["Classes", summary?.totalClasses ?? schoolSummary?.academicRecordsValidated ?? rows.length],
    ["Learners", summary?.totalStudents ?? schoolSummary?.totalLearners ?? 0],
    ["At-Risk (High + Moderate)", schoolSummary?.atRisk ?? "—"],
    ["ARAL Learners", summary?.aralScreeningCount ?? schoolSummary?.aralScreening ?? 0],
    [
      "Classroom Remedial Classes",
      summary?.classroomRemedialCount ?? schoolSummary?.classroomRemediation ?? 0,
    ],
    [
      "Average Class Grade",
      summary?.averageClassGrade ?? schoolSummary?.overallAverage ?? "—",
    ],
    [
      "SF2 Monthly Attendance Rate",
      attendance?.monthlyAttendanceRate == null
        ? "—"
        : `${attendance.monthlyAttendanceRate}%`,
    ],
    [
      "Near 20% Absence",
      attendance?.nearThresholdCount ?? 0,
    ],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(
          value
        )}</strong></div>`
    )
    .join("");

  const tableRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.gradeSection)}</td>
        <td>${escapeHtml(row.subject)}</td>
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Admin School Report — CNHS</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1e293b; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 28px 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    h3 { font-size: 13px; margin: 16px 0 8px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .meta div { margin: 2px 0; }
    .note { font-size: 11px; color: #64748b; margin: 8px 0 0; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .metric span { display: block; font-size: 11px; color: #94a3b8; }
    .metric strong { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; }
    th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .chart-list { list-style: none; padding: 0; margin: 0; }
    .chart-list li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    @media print {
      body { margin: 16px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <button onclick="window.print()" style="margin-bottom:16px;padding:8px 12px;cursor:pointer;">Print / Save PDF</button>
  <h1>CNHS School Reports</h1>
  <div class="meta">
    <div><strong>School:</strong> Cambaog National High School</div>
    <div><strong>School Year:</strong> ${escapeHtml(schoolYear || "—")}</div>
    <div><strong>Term:</strong> ${escapeHtml(qLabel)}</div>
    <div><strong>Date Generated:</strong> ${escapeHtml(dateGenerated)}</div>
  </div>
  <p class="note">Academic risk is based on ECR grades only. Attendance (SF2) is a separate monitoring module.</p>

  <h2>Summary</h2>
  <div class="metrics">${summaryRows}</div>

  <h2>Class Performance</h2>
  <table>
    <thead>
      <tr>
        <th>Class</th>
        <th>Subject</th>
        <th>Teacher</th>
        <th>Students</th>
        <th>Avg Grade</th>
        <th>Intervention</th>
        <th>ARAL</th>
        <th>Classroom Remedial</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${
        tableRows ||
        `<tr><td colspan="9">No class reports for the selected filters.</td></tr>`
      }
    </tbody>
  </table>

  <h2>Analytics</h2>
  <div class="charts">
    ${chartListHtml("Risk Distribution", charts.riskDistribution)}
    ${chartListHtml("Intervention Mix", charts.interventionMix)}
    ${chartListHtml("Average Grade by Subject", charts.performanceBySubject, "subject", "average")}
    ${chartListHtml("Lesson Plan Status", charts.lessonPlanStatus)}
  </div>

  <h2>Attendance Monitoring (SF2)</h2>
  ${chartListHtml("Attendance Rate by Month", charts.attendanceByMonth, "name", "rate")}
</body>
</html>`;

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
