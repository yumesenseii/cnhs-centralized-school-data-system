/**
 * Official DepEd Phil-IRI & ARAL Reading Assessment Exporter
 * Generates official DepEd Cambaog National High School Reading & Intervention Reports:
 * 1. Printable PDF (.pdf via cnhsPrintShell / openPrintableHtml)
 * 2. Official Excel (.xlsx via ExcelJS / excelOfficialTemplate)
 *
 * Supported Report Types:
 * - "form2": DepEd Phil-IRI Form 2 (School / Class Reading Profile)
 * - "form5": DepEd Phil-IRI Form 5 (Phil-IRI School Summary on Learners' Reading Level)
 * - "caseload": ARAL Intervention Caseload (RA 12028 Support Roster)
 * - "assessment_summary": Class Reading Assessment & GST Summary
 *
 * Guarantees:
 * - DepEd Order No. 14, s. 2018 (Phil-IRI Policy) & RA 12028 (ARAL Program Act)
 * - Official Cambaog NHS header with School ID 300793, Division of Bulacan, Bustos
 * - Zero fabricated signatories (honest role lines and official school head DULCE VILMA R. GALANG)
 * - Windows-safe filename generation
 */

import { SYSTEM_NAME } from "@/lib/constants/brand";
import {
  escapeHtml,
  renderDataTableHtml,
  renderDualSignatureHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";
import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import { SF9_SCHOOL_INFO } from "@/lib/reports/sf9DataService";
import { windowsSafeFilename } from "@/lib/reports/exportFilenames";
import {
  getAuthoritativeReadingProfile,
} from "@/lib/reports/aralReportsAggregation";

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
 * Standardized Windows-safe filename builder for Phil-IRI & ARAL exports
 */
export function buildPhilIriReportFilename({
  schoolYear = "SY 2026-2027",
  period = "BOSY",
  scopeLabel = "School-wide",
  reportType = "form2",
  format = "pdf",
} = {}) {
  const cleanYear = String(schoolYear || "SY 2026-2027").replace(/\s+/g, "");
  const cleanPeriod = String(period || "BOSY").replace(/\s+/g, "");
  const cleanScope = safeToken(scopeLabel || "Scope");
  const typeMap = {
    form2: "PhilIRI_Form2_ReadingProfile",
    form5: "PhilIRI_Form5_ReadingSummary",
    caseload: "ARAL_Intervention_Caseload",
    assessment_summary: "Reading_Assessment_Summary",
  };
  const typeLabel = typeMap[reportType] || "Reading_Report";
  const ext = format === "excel" ? "xlsx" : "pdf";
  const raw = `CNHS_${typeLabel}_${cleanScope}_${cleanYear}_${cleanPeriod}.${ext}`;
  return windowsSafeFilename(raw);
}

/**
 * Builds and launches the official Phil-IRI / ARAL PDF document
 */
export function exportPhilIriReadingPdf({
  learners = [],
  form2Data = null,
  form5Data = null,
  schoolYear = "SY 2026-2027",
  period = "BOSY",
  language = "All Languages",
  scopeLabel = "School-wide",
  reportType = "form2",
  teacherName = "",
  schoolHeadName = null,
} = {}) {
  const filename = buildPhilIriReportFilename({
    schoolYear,
    period,
    scopeLabel,
    reportType,
    format: "pdf",
  });

  const generatedAt = new Date().toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let documentTitle = "Phil-IRI Reading Assessment Report";
  let reportHeading = "PHIL-IRI READING ASSESSMENT REPORT";
  let headers = [];
  let rowsHtml = "";
  let kpiList = [];
  let noteText = "";

  if (reportType === "form2" && form2Data?.rows) {
    documentTitle = "Phil-IRI Form 2 — School Reading Profile";
    reportHeading = "PHIL-IRI FORM 2: SCHOOL READING PROFILE";
    noteText =
      "Official DepEd Phil-IRI Form 2. Group Screening Test (GST) scores: >=28 At Grade Level, 16-27 Two Levels Down, <16 Three Levels Down. Form 3 profiles (Independent, Instructional, Frustration) established via Individual Reading Assessment.";

    kpiList = [
      ["Total Cases", form2Data.total.totalCases],
      ["GST Screened", form2Data.total.assessed],
      ["At Grade Level", form2Data.total.atGradeLevel],
      ["Form 3 Assessed", form2Data.total.form3Assessed],
    ];

    headers = [
      "Grade Level",
      "Total Cases",
      "GST Screened",
      "At Grade Level (>=28)",
      "2 Levels Down (16-27)",
      "3 Levels Down (<16)",
      "Form 3 Assessed",
      "Independent",
      "Instructional",
      "Frustration",
    ];

    const allRows = [...form2Data.rows, form2Data.total];
    rowsHtml = allRows
      .map(
        (r, idx) => `
        <tr style="${idx === allRows.length - 1 ? "font-weight:bold; background:#e8f5ef;" : ""}">
          <td>${escapeHtml(r.grade)}</td>
          <td>${r.totalCases}</td>
          <td>${r.assessed}</td>
          <td>${r.atGradeLevel}</td>
          <td>${r.twoLevelsDown}</td>
          <td>${r.threeLevelsDown}</td>
          <td>${r.form3Assessed}</td>
          <td>${r.form3Independent}</td>
          <td>${r.form3Instructional}</td>
          <td>${r.form3Frustration}</td>
        </tr>`
      )
      .join("");
  } else if (reportType === "form5" && form5Data?.rows) {
    documentTitle = "Phil-IRI Form 5 — School Reading Summary";
    reportHeading = "PHIL-IRI FORM 5: SUMMARY REPORT ON LEARNERS' READING LEVEL";
    noteText =
      "Official DepEd Phil-IRI Form 5. Summarizes learner distribution across Reading Profiles (Independent, Instructional, Frustration) and identifies learners requiring targeted reading intervention.";

    kpiList = [
      ["Total Screened", form5Data.total.totalScreened],
      ["At Grade Level", form5Data.total.atGradeLevel],
      ["Independent", form5Data.total.independent],
      ["Requiring Support", form5Data.total.requiringSupport],
    ];

    headers = [
      "Grade Level",
      "Total Screened",
      "At Grade Level",
      "Instructional",
      "Frustration",
      "Independent",
      "Requiring Support",
    ];

    const allRows = [...form5Data.rows, form5Data.total];
    rowsHtml = allRows
      .map(
        (r, idx) => `
        <tr style="${idx === allRows.length - 1 ? "font-weight:bold; background:#e8f5ef;" : ""}">
          <td>${escapeHtml(r.grade)}</td>
          <td>${r.totalScreened}</td>
          <td>${r.atGradeLevel}</td>
          <td>${r.instructional}</td>
          <td>${r.frustration}</td>
          <td>${r.independent}</td>
          <td style="${r.requiringSupport > 0 ? "color:#c2410c; font-weight:bold;" : ""}">${r.requiringSupport}</td>
        </tr>`
      )
      .join("");
  } else {
    // Caseload or Class Assessment Summary
    const isCaseload = reportType === "caseload";
    documentTitle = isCaseload
      ? "ARAL Program — Intervention Caseload"
      : "Reading Assessment & GST Class Summary";
    reportHeading = isCaseload
      ? "ARAL PROGRAM (RA 12028) INTERVENTION CASELOAD"
      : "PHIL-IRI READING ASSESSMENT CLASS SUMMARY";
    noteText = isCaseload
      ? "RA 12028 (ARAL Program Act). Official intervention support registry. Movement outcomes and evaluations are updated after standardized assessment milestones."
      : "DepEd Phil-IRI Classroom Assessment Summary. Individual Reading Assessment (Form 3) administered to learners scoring below 28 on GST.";

    const total = learners.length;
    const independentCount = learners.filter(
      (l) => getAuthoritativeReadingProfile(l) === "Independent"
    ).length;
    const instructionalCount = learners.filter(
      (l) => getAuthoritativeReadingProfile(l) === "Instructional"
    ).length;
    const frustrationCount = learners.filter(
      (l) => getAuthoritativeReadingProfile(l) === "Frustration"
    ).length;

    kpiList = [
      ["Enrolled Learners", total],
      ["Independent", independentCount],
      ["Instructional", instructionalCount],
      ["Frustration", frustrationCount],
    ];

    headers = [
      "#",
      "Learner Name",
      "Student No. / LRN",
      "Grade & Section",
      "Language",
      "GST Score",
      "Reading Profile",
      isCaseload ? "ARAL Status" : "Assessment Status",
      "Movement Outcome",
    ];

    rowsHtml = learners
      .map((l, idx) => {
        const profile = getAuthoritativeReadingProfile(l) || "Not Screened";
        const score = l.philIriScore != null ? String(l.philIriScore) : "—";
        const status =
          l.currentStepLabel || l.aralStatus || l.monitoringStatus || "Waiting";
        const outcome = l.outcome || l.movementOutcome || "In Progress";

        return `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight:600;">${escapeHtml(l.name || l.studentName || `Learner ${idx + 1}`)}</td>
          <td>${escapeHtml(l.studentNumber || l.lrn || "—")}</td>
          <td>${escapeHtml(l.gradeSectionDisplay || l.gradeSection || "—")}</td>
          <td>${escapeHtml(l.language || l.subject || "English")}</td>
          <td>${escapeHtml(score)}</td>
          <td style="font-weight:600; ${profile === "Frustration" ? "color:#c2410c;" : profile === "Independent" ? "color:#246f54;" : ""}">${escapeHtml(profile)}</td>
          <td>${escapeHtml(status)}</td>
          <td>${escapeHtml(outcome)}</td>
        </tr>`;
      })
      .join("");
  }

  const bodyHtml = `
    <p class="section-label">Summary Overview</p>
    ${renderKpiRowHtml(kpiList)}

    <p class="section-label" style="margin-top:14px;">Detailed Assessment & Support Roster</p>
    ${renderDataTableHtml({
      headers,
      rowsHtml,
      emptyText: "No reading assessment or intervention records found under current filters.",
      compact: true,
    })}
  `;

  // Honest signatories
  const prepNameUpper =
    teacherName && !teacherName.toLowerCase().includes("maria santos")
      ? teacherName.toUpperCase()
      : "(Signature over Printed Name)";
  const headNameUpper =
    schoolHeadName && !schoolHeadName.toLowerCase().includes("maria santos")
      ? schoolHeadName.toUpperCase()
      : (SF9_SCHOOL_INFO.defaultSchoolHead || "(Signature over Printed Name)");

  const html = wrapCnhsPrintDocument({
    documentTitle,
    letterheadSub: `${SF9_SCHOOL_INFO.region} · ${SF9_SCHOOL_INFO.division} · ${SF9_SCHOOL_INFO.municipality.toUpperCase()} · School ID: ${SF9_SCHOOL_INFO.schoolId}`,
    title: reportHeading,
    subtitle: `${schoolYear} · Assessment Period: ${period} · Language: ${language} · Scope: ${scopeLabel}`,
    metaRows: [
      ["School Year", schoolYear],
      ["Assessment Period", period],
      ["Language / Area", language],
      ["Scope / Class", scopeLabel],
      ["Date Generated", generatedAt],
    ],
    noteHtml: noteText,
    bodyHtml,
    showSignature: false,
    signatureHtml: renderDualSignatureHtml({
      preparedBy: prepNameUpper,
      preparedRole: "Reading Teacher / ARAL Coordinator",
      notedBy: headNameUpper,
      notedRole: SF9_SCHOOL_INFO.schoolHeadTitle || "School Head / Principal",
    }),
    orientation: "landscape",
  });

  if (typeof window !== "undefined") {
    openPrintableHtml(html, {
      title: filename.replace(/\.pdf$/i, ""),
      autoPrint: true,
    });
  }

  return { success: true, filename, html };
}

/**
 * Builds and downloads the official Phil-IRI / ARAL Excel report
 */
export async function exportPhilIriReadingExcel({
  learners = [],
  form2Data = null,
  form5Data = null,
  schoolYear = "SY 2026-2027",
  period = "BOSY",
  language = "All Languages",
  scopeLabel = "School-wide",
  reportType = "form2",
  generatedBy = "CNHS Staff",
} = {}) {
  const filename = buildPhilIriReportFilename({
    schoolYear,
    period,
    scopeLabel,
    reportType,
    format: "excel",
  });

  let reportTitle = "Phil-IRI Reading Assessment Report";
  let columns = [];
  let rows = [];
  let metrics = [];

  if (reportType === "form2" && form2Data?.rows) {
    reportTitle = `Phil-IRI Form 2 — School Reading Profile (${period})`;
    metrics = [
      { label: "Total Cases", value: form2Data.total.totalCases, tone: "default" },
      { label: "GST Screened", value: form2Data.total.assessed, tone: "green" },
      { label: "At Grade Level", value: form2Data.total.atGradeLevel, tone: "green" },
      { label: "Form 3 Frustration", value: form2Data.total.form3Frustration, tone: "amber" },
    ];
    columns = [
      { key: "grade", header: "Grade Level", width: 16 },
      { key: "totalCases", header: "Total Cases", width: 14, numeric: true },
      { key: "assessed", header: "GST Screened", width: 14, numeric: true },
      { key: "atGradeLevel", header: "At Grade Level (>=28)", width: 20, numeric: true },
      { key: "twoLevelsDown", header: "2 Levels Down (16-27)", width: 20, numeric: true },
      { key: "threeLevelsDown", header: "3 Levels Down (<16)", width: 20, numeric: true },
      { key: "form3Assessed", header: "Form 3 Assessed", width: 16, numeric: true },
      { key: "form3Independent", header: "Independent", width: 14, numeric: true },
      { key: "form3Instructional", header: "Instructional", width: 14, numeric: true },
      { key: "form3Frustration", header: "Frustration", width: 14, numeric: true },
    ];
    rows = [...form2Data.rows, form2Data.total];
  } else if (reportType === "form5" && form5Data?.rows) {
    reportTitle = `Phil-IRI Form 5 — School Reading Summary (${period})`;
    metrics = [
      { label: "Total Screened", value: form5Data.total.totalScreened, tone: "default" },
      { label: "At Grade Level", value: form5Data.total.atGradeLevel, tone: "green" },
      { label: "Independent", value: form5Data.total.independent, tone: "green" },
      { label: "Requiring Support", value: form5Data.total.requiringSupport, tone: "amber" },
    ];
    columns = [
      { key: "grade", header: "Grade Level", width: 16 },
      { key: "totalScreened", header: "Total Screened", width: 16, numeric: true },
      { key: "atGradeLevel", header: "At Grade Level", width: 16, numeric: true },
      { key: "instructional", header: "Instructional", width: 16, numeric: true },
      { key: "frustration", header: "Frustration", width: 16, numeric: true },
      { key: "independent", header: "Independent", width: 16, numeric: true },
      { key: "requiringSupport", header: "Requiring Support", width: 18, numeric: true },
    ];
    rows = [...form5Data.rows, form5Data.total];
  } else {
    // Caseload or Assessment summary
    const isCaseload = reportType === "caseload";
    reportTitle = isCaseload
      ? `ARAL Intervention Caseload — ${scopeLabel}`
      : `Reading Assessment Class Summary — ${scopeLabel}`;

    const total = learners.length;
    const frustrationCount = learners.filter(
      (l) => getAuthoritativeReadingProfile(l) === "Frustration"
    ).length;

    metrics = [
      { label: "Enrolled", value: total, tone: "default" },
      { label: "Period", value: period, tone: "green" },
      { label: "Frustration", value: frustrationCount, tone: "amber" },
      { label: "Language", value: language, tone: "default" },
    ];

    columns = [
      { key: "studentNumber", header: "Student Number / LRN", width: 18 },
      { key: "studentName", header: "Learner Name", width: 24 },
      { key: "gradeSection", header: "Grade & Section", width: 16 },
      { key: "language", header: "Language", width: 14 },
      { key: "philIriScore", header: "GST Score", width: 12, numeric: true },
      { key: "readingProfile", header: "Reading Profile", width: 18 },
      { key: "status", header: isCaseload ? "ARAL Status" : "Assessment Status", width: 20 },
      { key: "movementOutcome", header: "Movement Outcome", width: 18 },
    ];

    rows = learners.map((l, idx) => ({
      studentNumber: l.studentNumber || l.lrn || "—",
      studentName: l.name || l.studentName || `Learner ${idx + 1}`,
      gradeSection: l.gradeSectionDisplay || l.gradeSection || "—",
      language: l.language || l.subject || "English",
      philIriScore: l.philIriScore != null ? l.philIriScore : null,
      readingProfile: getAuthoritativeReadingProfile(l) || "Not Screened",
      status: l.currentStepLabel || l.aralStatus || l.monitoringStatus || "Waiting",
      movementOutcome: l.outcome || l.movementOutcome || "In Progress",
    }));
  }

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle,
      schoolYear: schoolYear || "—",
      quarter: period || "—",
      generatedBy,
      totalRecords: rows.length,
    },
    metrics,
    chartSeries: [],
    table: {
      sheetName: "Reading Report",
      title: reportTitle,
      columns,
      rows,
    },
    narrativeContext: {
      totalClasses: 1,
      totalStudents: rows.length,
      averageGrade: null,
      atRisk: 0,
      aralLearners: rows.length,
      classroomRemedial: 0,
    },
  });

  await downloadWorkbook(workbook, filename);
  return { success: true, filename, workbook };
}
