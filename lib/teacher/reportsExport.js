import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chartListHtml(title, rows = [], nameKey = "name", valueKey = "value") {
  if (!rows.length) {
    return `<h3>${escapeHtml(title)}</h3><p>No data</p>`;
  }
  const items = rows
    .map(
      (row) =>
        `<li><span>${escapeHtml(row[nameKey])}</span><strong>${escapeHtml(row[valueKey])}</strong></li>`
    )
    .join("");
  return `<h3>${escapeHtml(title)}</h3><ul class="chart-list">${items}</ul>`;
}

/**
 * Open a printable HTML report (browser Print → Save as PDF).
 */
export function exportTeacherReportsPdf({
  teacherName,
  schoolYear,
  quarter,
  summary,
  classReports = [],
  charts = {},
  generatedAt = new Date(),
} = {}) {
  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const summaryRows = [
    ["Total Classes", summary?.totalClasses ?? 0],
    ["Total Students", summary?.totalStudents ?? 0],
    ["ARAL Learners Count", summary?.aralScreeningCount ?? 0],
    ["Classroom Remedial Count", summary?.classroomRemedialCount ?? 0],
    [
      "Average Class Grade",
      summary?.averageClassGrade == null ? "—" : summary.averageClassGrade,
    ],
    [
      "Monitoring Completion Rate",
      `${summary?.monitoringCompletionRate ?? 0}%`,
    ],
  ]
    .map(
      ([label, value]) =>
        `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("");

  const tableRows = classReports
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.section ?? row.gradeSection)}</td>
        <td>${escapeHtml(row.subject)}</td>
        <td>${escapeHtml(row.students)}</td>
        <td>${escapeHtml(row.averageGrade)}</td>
        <td>${escapeHtml(row.aralScreeningDisplay ?? (row.aralEligible === false ? "—" : row.aralScreening))}</td>
        <td>${escapeHtml(row.classroomRemedial)}</td>
        <td>${escapeHtml(row.monitoringStatus)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Teacher Report — ${escapeHtml(teacherName)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1e293b; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 28px 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    h3 { font-size: 13px; margin: 16px 0 8px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .meta div { margin: 2px 0; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .metric span { display: block; font-size: 11px; color: #94a3b8; }
    .metric strong { font-size: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
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
  <h1>Teacher Class Report</h1>
  <div class="meta">
    <div><strong>Teacher:</strong> ${escapeHtml(teacherName)}</div>
    <div><strong>School Year:</strong> ${escapeHtml(schoolYear)}</div>
    <div><strong>Term:</strong> ${escapeHtml(quarter)}</div>
    <div><strong>Date Generated:</strong> ${escapeHtml(dateGenerated)}</div>
  </div>

  <h2>Summary</h2>
  <div class="metrics">${summaryRows}</div>

  <h2>Class Reports</h2>
  <table>
    <thead>
      <tr>
        <th>Section</th>
        <th>Subject</th>
        <th>Students</th>
        <th>Average Grade</th>
        <th>ARAL Learners</th>
        <th>Classroom Remedial</th>
        <th>Monitoring Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="7">No class reports for the selected filters.</td></tr>`}
    </tbody>
  </table>

  <h2>Charts</h2>
  <div class="charts">
    ${chartListHtml("Student Performance Distribution", charts.performanceDistribution)}
    ${chartListHtml("ARAL Learners Distribution", charts.aralDistribution)}
    ${chartListHtml("Average Grade Per Subject", charts.averageGradePerSubject, "subject", "average")}
    ${chartListHtml("Monitoring Progress", charts.monitoringProgress)}
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=800");
  if (!printWindow) {
    throw new Error("Pop-up blocked. Allow pop-ups to export PDF.");
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    try {
      printWindow.print();
    } catch {
      /* user can print manually */
    }
  }, 350);
}

function quarterLabel(quarter) {
  if (!quarter) return TERM_ALL_LABEL;
  return termLabel(quarter);
}

function normalizeTeacherClassRow(row) {
  if (!row) return null;
  return {
    section: row.section ?? row.gradeSection,
    subject: row.subject,
    students: row.students,
    averageGrade: row.averageGrade,
    averageGradeValue:
      typeof row.averageGrade === "number"
        ? row.averageGrade
        : row.averageGradeValue ?? null,
    aralScreeningDisplay:
      row.aralScreeningDisplay ??
      (row.aralEligible === false ? "—" : row.aralScreening),
    classroomRemedial: row.classroomRemedial ?? "—",
    monitoringStatus: row.monitoringStatus ?? "—",
    schoolYear: row.schoolYear,
    quarter: row.quarter,
    teacherName: row.teacherName,
    aralEligible: row.aralEligible,
    aralScreening: row.aralScreening,
    classroomRemedialRecommended: Boolean(row.classroomRemedialRecommended),
  };
}

function buildTeacherChartSeries(charts = {}) {
  const series = [];

  if (charts.performanceDistribution?.length) {
    series.push({
      title: "Student Performance Distribution",
      chartType: "donut",
      categoryHeader: "Band",
      valueHeader: "Learners",
      rows: charts.performanceDistribution.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  if (charts.aralDistribution?.length) {
    series.push({
      title: "ARAL Learners Distribution",
      chartType: "donut",
      categoryHeader: "Category",
      valueHeader: "Count",
      rows: charts.aralDistribution.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  if (charts.averageGradePerSubject?.length) {
    series.push({
      title: "Average Grade Per Subject",
      chartType: "hbar",
      categoryHeader: "Subject",
      valueHeader: "Average",
      rows: charts.averageGradePerSubject.map((row) => ({
        category: row.subject ?? row.name,
        value: row.average ?? row.value,
      })),
    });
  }

  if (charts.monitoringProgress?.length) {
    series.push({
      title: "Monitoring Progress",
      chartType: "donut",
      categoryHeader: "Status",
      valueHeader: "Count",
      rows: charts.monitoringProgress.map((row) => ({
        category: row.name,
        value: row.value,
      })),
    });
  }

  return series;
}

function subjectAverageExtremes(rows = []) {
  const values = rows
    .map((row) => Number(row.average ?? row.value))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return { highest: null, lowest: null };
  return {
    highest: Math.max(...values),
    lowest: Math.min(...values),
  };
}

/**
 * Export class report rows to official CNHS Excel workbook.
 */
export async function exportTeacherReportsExcel({
  classReports = [],
  summary = {},
  charts = {},
  teacherName = "Teacher",
  schoolYear = "",
  quarter = "",
  filename = null,
} = {}) {
  const rows = classReports.map(normalizeTeacherClassRow).filter(Boolean);
  const qLabel = quarterLabel(quarter);
  const totalClasses = summary.totalClasses ?? rows.length;
  const totalStudents = summary.totalStudents ?? 0;
  const aralLearners = summary.aralScreeningCount ?? 0;
  const classroomRemedial = summary.classroomRemedialCount ?? 0;
  const averageGrade = summary.averageClassGrade ?? null;
  const monitoringRate = summary.monitoringCompletionRate ?? 0;
  const { highest, lowest } = subjectAverageExtremes(
    charts.averageGradePerSubject
  );

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "Teacher Class Performance Report",
      schoolYear: schoolYear || "—",
      quarter: qLabel,
      generatedBy: teacherName,
      totalRecords: rows.length,
    },
    metrics: [
      { label: "Total Classes", value: totalClasses, tone: "default" },
      { label: "Total Students", value: totalStudents, tone: "default" },
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
        label: "Monitoring Completion",
        value: `${monitoringRate}%`,
        tone: Number(monitoringRate) < 100 ? "amber" : "green",
      },
    ],
    chartSeries: buildTeacherChartSeries(charts),
    table: {
      sheetName: "Detailed Report",
      title: `Class Reports — ${teacherName} · ${schoolYear || "SY"} · ${qLabel}`,
      columns: [
        { key: "section", header: "Section", width: 18 },
        { key: "subject", header: "Subject", width: 16 },
        { key: "students", header: "Students", width: 11, numeric: true },
        {
          key: "averageGrade",
          header: "Avg Grade",
          width: 12,
          numeric: true,
          gradeRule: true,
        },
        { key: "aralScreeningDisplay", header: "ARAL Learners", width: 14 },
        { key: "classroomRemedial", header: "Classroom Remedial", width: 18 },
        {
          key: "monitoringStatus",
          header: "Monitoring Status",
          width: 18,
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
      atRisk: 0,
      aralLearners,
      classroomRemedial,
      monitoringRate,
    },
  });

  const safeName = String(teacherName || "Teacher")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 40);
  const resolvedFilename =
    filename ||
    `Teacher_Reports_${safeName}_${schoolYear || "SY"}_Q${
      String(quarter).replace(/\D/g, "") || "1"
    }.xlsx`;

  await downloadWorkbook(workbook, resolvedFilename);
}

/** Filename-safe token, e.g. "Grade 7 — Rizal" → "Grade-7-Rizal". */
function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

/**
 * Export a single opened class as its own workbook.
 * Reuses exportTeacherReportsExcel with a class-specific filename.
 */
export async function exportClassReportExcel(classReport, charts = {}) {
  if (!classReport) return;

  const quarterDigit = String(classReport.quarter ?? "").replace(/\D/g, "") || "1";
  const filename = `Class_Report_${safeToken(classReport.subject)}_${safeToken(
    classReport.gradeSection ?? classReport.section
  )}_Q${quarterDigit}.xlsx`;

  await exportTeacherReportsExcel({
    classReports: [classReport],
    summary: {
      totalClasses: 1,
      totalStudents: classReport.students,
      aralScreeningCount: classReport.aralEligible
        ? classReport.aralScreening
        : 0,
      classroomRemedialCount: classReport.classroomRemedialRecommended ? 1 : 0,
      averageClassGrade:
        classReport.averageGradeValue ?? classReport.averageGrade,
      monitoringCompletionRate: 0,
    },
    charts,
    teacherName: classReport.teacherName,
    schoolYear: classReport.schoolYear,
    quarter: classReport.quarter,
    filename,
  });
}

export async function exportSingleClassReportExcel(classReport, charts = {}) {
  if (!classReport) return;
  await exportTeacherReportsExcel({
    classReports: [classReport],
    summary: {
      totalClasses: 1,
      totalStudents: classReport.students,
      aralScreeningCount: classReport.aralEligible
        ? classReport.aralScreening
        : 0,
      classroomRemedialCount: classReport.classroomRemedialRecommended ? 1 : 0,
      averageClassGrade:
        classReport.averageGradeValue ?? classReport.averageGrade,
      monitoringCompletionRate: 0,
    },
    charts,
    teacherName: classReport.teacherName,
    schoolYear: classReport.schoolYear,
    quarter: classReport.quarter,
  });
}
