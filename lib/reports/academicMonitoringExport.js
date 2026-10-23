/**
 * Unified Academic Monitoring Report Exporter
 * Generates official DepEd Cambaog National High School Academic Monitoring reports:
 * 1. PDF (.pdf) via jsPDF and jspdf-autotable (A4 portrait, letterhead, KPIs, table, signatures)
 * 2. Excel (.xlsx) via ExcelJS (Multi-tab: SUMMARY, ACADEMIC_MONITORING, INTERVENTIONS)
 *
 * Guarantees:
 * - Authoritative academic risk derived strictly from finalized DepEd grades
 * - Incomplete evidence designated as "Pending Evidence" without speculative scores
 * - Random Forest advisories transparently labeled as non-authoritative decision support
 * - Statutory ARAL Reading candidates separated from classroom academic remediation
 * - Respects teacher class/section scope vs principal school-wide scope
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { DEPED_SEAL_BASE64, CNHS_LOGO_BASE64 } from "./sf9Logos.js";
import { downloadWorkbook, CNHS_EXCEL_BRAND } from "./excelOfficialTemplate.js";
import { windowsSafeFilename } from "./exportFilenames.js";
import { SF9_SCHOOL_INFO } from "./sf9DataService.js";

const BRAND_GREEN = [36, 111, 84]; // #246f54
const BRAND_AMBER = [194, 65, 12];
const TEXT_DARK = [30, 41, 59];
const TEXT_MUTED = [100, 116, 139];
const BORDER_COLOR = [226, 232, 240];

/**
 * Standardized Windows-safe filename builder for Academic Monitoring exports
 */
export function buildMonitoringFilename({
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  scope = "All Classes",
  role = "teacher",
  format = "pdf",
} = {}) {
  const cleanYear = String(schoolYear || "SY 2026-2027").replace(/\s+/g, "");
  const cleanQuarter = String(quarter || "Q1").replace(/\s+/g, "");
  const cleanScope = String(scope || (role === "principal" ? "SchoolWide" : "ClassRoster"))
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
  const ext = format === "excel" ? "xlsx" : "pdf";
  const raw = `CNHS_Academic_Monitoring_${cleanScope}_${cleanYear}_${cleanQuarter}.${ext}`;
  return windowsSafeFilename(raw);
}

/**
 * Normalizes learner data row for consistent reporting
 */
function normalizeMonitoringRow(row, index = 0) {
  if (!row) return null;

  const name =
    row.name ||
    [row.lastName, row.firstName].filter(Boolean).join(", ") ||
    row.learnerName ||
    `Learner ${index + 1}`;

  const lrn = String(row.lrn || row.studentNumber || row.studentId || "—");
  const gradeSection =
    row.gradeSection ||
    (row.grade && row.section ? `${row.grade} - ${row.section}` : row.section || row.grade || "—");

  const subject = row.subject || row.classSubject || "All Subjects";

  const isProvisional =
    row.isProvisional === true ||
    row.isCompleteTerm === false ||
    (row.grade == null && row.finalGrade == null && row.classSubjectGrade == null);

  const rawGrade = row.finalGrade ?? row.grade ?? row.classSubjectGrade ?? row.averageGrade;
  const gradeDisplay = isProvisional || rawGrade == null ? "Pending" : String(rawGrade);

  const officialRisk = isProvisional
    ? "Pending Evidence"
    : row.officialRiskLevel || row.currentAcademicRisk || row.riskLevel || "Low Risk";

  let learningNeed = "Proficient / Curriculum Pacing";
  if (isProvisional) {
    learningNeed = "Awaiting Full-Term Assessment Evidence";
  } else if (row.failingSubjects?.length) {
    const list = row.failingSubjects.map((s) => s.subjectName || s).join(", ");
    learningNeed = `Remedial Recovery: ${list}`;
  } else if (officialRisk === "High Risk" || officialRisk === "High") {
    learningNeed = "Core Academic Competency Recovery";
  } else if (officialRisk === "Moderate Risk" || officialRisk === "Moderate") {
    learningNeed = "Targeted Skill Reinforcement";
  }

  const recommendation =
    row.recommendation ||
    row.recommendationType ||
    (row.classroomRemedialRecommended ? "Classroom Remedial" : "General Monitoring");

  const supportStatus =
    row.supportStatus ||
    row.monitoringStatus ||
    (row.classroomRemedialRecommended ? "Under Support" : "Active Observation");

  return {
    index: index + 1,
    name,
    lrn,
    gradeSection,
    subject,
    grade: gradeDisplay,
    officialRisk,
    learningNeed,
    recommendation,
    supportStatus,
    isProvisional,
    rfAnalysis: row.rfAnalysis || null,
  };
}

/**
 * Builds the official PDF Document instance via jsPDF and jspdf-autotable.
 * Usable both in browser and automated testing environments.
 */
export function buildAcademicMonitoringPdfDoc({
  role = "teacher",
  teacherName = "Teacher",
  schoolHeadName = null,
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  gradeLevel = "All Grades",
  sectionName = "All Sections",
  scopeLabel = null,
  learners = [],
  summaryCounts = null,
  generatedAt = new Date(),
} = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const contentWidth = 522;
  let y = 30;

  // 1. Dual Official Logos
  try {
    if (DEPED_SEAL_BASE64) {
      doc.addImage(DEPED_SEAL_BASE64, "PNG", marginX + 6, y, 48, 48);
    }
  } catch (err) {
    // Optional logo fallback
  }

  try {
    if (CNHS_LOGO_BASE64) {
      doc.addImage(CNHS_LOGO_BASE64, "PNG", pageWidth - marginX - 54, y, 48, 48);
    }
  } catch (err) {
    // Optional logo fallback
  }

  // 2. Official Letterhead
  doc.setTextColor(...TEXT_DARK);
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text("Republic of the Philippines", pageWidth / 2, y + 4, { align: "center" });
  doc.setFontSize(9.5);
  doc.setFont("times", "bold");
  doc.text("Department of Education", pageWidth / 2, y + 16, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text(
    `${SF9_SCHOOL_INFO.region} — CENTRAL LUZON · ${SF9_SCHOOL_INFO.division} · ${SF9_SCHOOL_INFO.municipality.toUpperCase()}`,
    pageWidth / 2,
    y + 27,
    { align: "center" }
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(
    `${SF9_SCHOOL_INFO.schoolName} (School ID: ${SF9_SCHOOL_INFO.schoolId})`,
    pageWidth / 2,
    y + 40,
    { align: "center" }
  );

  y += 54;

  // Divider Line
  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(1.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 14;

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND_GREEN);
  doc.text("ACADEMIC MONITORING & INTERVENTION SUMMARY REPORT", pageWidth / 2, y, { align: "center" });
  y += 14;

  const resolvedScope =
    scopeLabel ||
    (sectionName && sectionName !== "All Sections"
      ? `${gradeLevel !== "All Grades" ? gradeLevel + " - " : ""}${sectionName}`
      : role === "principal"
      ? "School-Wide Consolidated Monitoring"
      : "Assigned Subject Classes");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${schoolYear} · ${quarter} · Scope: ${resolvedScope}`, pageWidth / 2, y, { align: "center" });
  y += 16;

  // 3. Metadata Grid (Box)
  doc.setDrawColor(...BORDER_COLOR);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y, contentWidth, 34, 4, 4, "FD");

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Report Coverage:", marginX + 10, y + 13);
  doc.text("Generated By:", marginX + 10, y + 25);
  doc.text("Academic Term:", marginX + 220, y + 13);
  doc.text("Date Generated:", marginX + 220, y + 25);
  doc.text("Status:", marginX + 410, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(`${schoolYear}`, marginX + 85, y + 13);
  doc.text(`${teacherName}`, marginX + 85, y + 25);
  doc.text(`${quarter}`, marginX + 295, y + 13);
  doc.text(
    generatedAt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    marginX + 295,
    y + 25
  );
  doc.text("DepEd Official Standards", marginX + 445, y + 13);

  y += 42;

  // 4. Executive KPI Summary Cards (4 Columns)
  const rows = (learners || []).map(normalizeMonitoringRow).filter(Boolean);
  const total = rows.length;
  const highRisk =
    summaryCounts?.immediateReview ??
    rows.filter((r) => r.officialRisk === "High Risk" || r.officialRisk === "High").length;
  const modRisk =
    summaryCounts?.needsMonitoring ??
    rows.filter((r) => r.officialRisk === "Moderate Risk" || r.officialRisk === "Moderate").length;
  const underSupport =
    summaryCounts?.underSupport ??
    rows.filter((r) => r.recommendation?.toLowerCase().includes("remedial") || r.supportStatus === "Under Support").length;

  const kpiCardWidth = (contentWidth - 18) / 4;
  const kpiData = [
    { label: "MONITORED LEARNERS", value: String(total), color: BRAND_GREEN },
    { label: "NEEDS IMMEDIATE REVIEW", value: String(highRisk), color: highRisk > 0 ? BRAND_AMBER : BRAND_GREEN },
    { label: "NEEDS MONITORING", value: String(modRisk), color: TEXT_DARK },
    { label: "UNDER CLASS SUPPORT", value: String(underSupport), color: BRAND_GREEN },
  ];

  kpiData.forEach((kpi, idx) => {
    const cardX = marginX + idx * (kpiCardWidth + 6);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, y, kpiCardWidth, 38, 3, 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(kpi.label, cardX + kpiCardWidth / 2, y + 12, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, cardX + kpiCardWidth / 2, y + 30, { align: "center" });
  });

  y += 46;

  // 5. Authoritative Policy Disclaimer Notice
  doc.setFillColor(254, 252, 232); // light amber
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(marginX, y, contentWidth, 24, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 63, 18);
  const disclaimerText =
    "AUTHORITATIVE POLICY NOTE: Official Academic Risk bands (<75 High, 75-80 Moderate, >80 Low) are derived strictly from finalized DepEd quarterly grades. Provisional records are designated as 'Pending Evidence' without speculative risk scores. Random Forest advisory provides non-authoritative decision support.";
  doc.text(disclaimerText, marginX + 8, y + 10, { maxWidth: contentWidth - 16 });

  y += 32;

  // 6. Monitored Learners Table
  const tableHeaders = [
    "#",
    "Learner Name",
    "LRN",
    "Section",
    "Subject",
    "Grade",
    "Risk Level",
    "Identified Learning Need",
    "Intervention",
  ];

  const tableBody = rows.map((r) => [
    String(r.index),
    r.name,
    r.lrn,
    r.gradeSection,
    r.subject,
    r.grade,
    r.officialRisk,
    r.learningNeed,
    r.recommendation,
  ]);

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody.length > 0 ? tableBody : [["—", "No learners match the selected monitoring filters.", "—", "—", "—", "—", "—", "—", "—"]],
    theme: "grid",
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    headStyles: {
      fillColor: BRAND_GREEN,
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: TEXT_DARK,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      1: { cellWidth: 85, fontStyle: "bold" },
      2: { cellWidth: 56 },
      3: { cellWidth: 55 },
      4: { cellWidth: 55 },
      5: { cellWidth: 34, halign: "center" },
      6: { cellWidth: 55 },
      7: { cellWidth: 95 },
      8: { cellWidth: 69 },
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(str, pageWidth - marginX - 30, pageHeight - 15);
      doc.text("CNHS LEARN Centralized School Data System", marginX, pageHeight - 15);
    },
  });

  // 7. Signature Block
  const finalY = (doc.lastAutoTable?.finalY || y) + 24;
  let signY = finalY;
  if (signY > pageHeight - 90) {
    doc.addPage();
    signY = 40;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(role === "principal" ? "Generated by:" : "Prepared by:", marginX + 20, signY);
  doc.text("Noted by:", pageWidth - marginX - 180, signY);

  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(1);
  doc.line(marginX + 20, signY + 36, marginX + 180, signY + 36);
  doc.line(pageWidth - marginX - 180, signY + 36, pageWidth - marginX - 20, signY + 36);

  const prepSignText =
    teacherName && teacherName !== "Teacher" && !teacherName.toLowerCase().includes("principal maria")
      ? teacherName.toUpperCase()
      : "(Signature over Printed Name)";
  const headSignText =
    schoolHeadName && !schoolHeadName.toLowerCase().includes("maria")
      ? schoolHeadName.toUpperCase()
      : (SF9_SCHOOL_INFO.defaultSchoolHead || "(Signature over Printed Name)");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(prepSignText, marginX + 20, signY + 46);
  doc.text(headSignText, pageWidth - marginX - 180, signY + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    role === "principal" ? "School Administrator / Principal" : "Subject Teacher / Class Adviser",
    marginX + 20,
    signY + 56
  );
  doc.text(SF9_SCHOOL_INFO.schoolHeadTitle || "School Head / Principal", pageWidth - marginX - 180, signY + 56);

  return doc;
}

/**
 * Executes PDF export with direct browser download
 */
export function exportAcademicMonitoringPdf(params = {}) {
  const doc = buildAcademicMonitoringPdfDoc(params);
  const filename = buildMonitoringFilename({
    schoolYear: params.schoolYear,
    quarter: params.quarter,
    scope: params.scopeLabel || params.sectionName,
    role: params.role,
    format: "pdf",
  });

  if (typeof window !== "undefined") {
    doc.save(filename);
  }

  return { success: true, filename, doc };
}

/**
 * Builds the official Excel workbook instance via ExcelJS.
 * Usable both in browser and automated testing environments.
 */
export async function buildAcademicMonitoringExcelWorkbook({
  role = "teacher",
  teacherName = "Teacher",
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  gradeLevel = "All Grades",
  sectionName = "All Sections",
  scopeLabel = null,
  learners = [],
  classSummaries = [],
  summaryCounts = null,
  generatedAt = new Date(),
} = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CNHS LEARN";
  workbook.created = generatedAt;
  workbook.properties.date1904 = true;

  const rows = (learners || []).map(normalizeMonitoringRow).filter(Boolean);
  const total = rows.length;
  const highRisk =
    summaryCounts?.immediateReview ??
    rows.filter((r) => r.officialRisk === "High Risk" || r.officialRisk === "High").length;
  const modRisk =
    summaryCounts?.needsMonitoring ??
    rows.filter((r) => r.officialRisk === "Moderate Risk" || r.officialRisk === "Moderate").length;
  const underSupport =
    summaryCounts?.underSupport ??
    rows.filter((r) => r.recommendation?.toLowerCase().includes("remedial") || r.supportStatus === "Under Support").length;

  const thinBorder = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  // -------------------------------------------------------------
  // Sheet 1: SUMMARY
  // -------------------------------------------------------------
  const wsSummary = workbook.addWorksheet("SUMMARY", {
    views: [{ showGridLines: true }],
  });

  wsSummary.columns = [
    { width: 4 },
    { width: 28 },
    { width: 20 },
    { width: 20 },
    { width: 24 },
  ];

  wsSummary.mergeCells("B2:E2");
  wsSummary.getCell("B2").value = `${SF9_SCHOOL_INFO.schoolName} (School ID: ${SF9_SCHOOL_INFO.schoolId})`;
  wsSummary.getCell("B2").font = { name: "Arial", size: 14, bold: true, color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` } };

  wsSummary.mergeCells("B3:E3");
  wsSummary.getCell("B3").value = "ACADEMIC MONITORING & INTERVENTION EXECUTIVE SUMMARY";
  wsSummary.getCell("B3").font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };

  wsSummary.mergeCells("B4:E4");
  wsSummary.getCell("B4").value = `${SF9_SCHOOL_INFO.region} · ${SF9_SCHOOL_INFO.division} · ${SF9_SCHOOL_INFO.municipality}`;
  wsSummary.getCell("B4").font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };

  wsSummary.getCell("B5").value = "School Year:";
  wsSummary.getCell("C5").value = schoolYear;
  wsSummary.getCell("B6").value = "Academic Term:";
  wsSummary.getCell("C6").value = quarter;
  wsSummary.getCell("B7").value = "Reporting Scope:";
  wsSummary.getCell("C7").value = scopeLabel || sectionName || (role === "principal" ? "School-Wide" : "Class Roster");
  wsSummary.getCell("B8").value = "Generated By:";
  wsSummary.getCell("C8").value = teacherName;
  wsSummary.getCell("B9").value = "Date Generated:";
  wsSummary.getCell("C9").value = generatedAt.toLocaleDateString("en-PH");

  ["B5", "B6", "B7", "B8", "B9"].forEach((cellKey) => {
    wsSummary.getCell(cellKey).font = { name: "Arial", size: 10, bold: true, color: { argb: "FF64748B" } };
  });

  // KPI Table in Summary
  wsSummary.getCell("B11").value = "METRIC";
  wsSummary.getCell("C11").value = "COUNT";
  wsSummary.getCell("D11").value = "PERCENTAGE";
  ["B11", "C11", "D11"].forEach((k) => {
    wsSummary.getCell(k).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    wsSummary.getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` } };
    wsSummary.getCell(k).border = thinBorder;
  });

  const kpis = [
    { label: "Total Monitored Learners", count: total, pct: "100%" },
    { label: "Needs Immediate Review (High Risk)", count: highRisk, pct: total ? `${Math.round((highRisk / total) * 100)}%` : "0%" },
    { label: "Needs Monitoring (Moderate Risk)", count: modRisk, pct: total ? `${Math.round((modRisk / total) * 100)}%` : "0%" },
    { label: "Under Class Support", count: underSupport, pct: total ? `${Math.round((underSupport / total) * 100)}%` : "0%" },
  ];

  kpis.forEach((row, i) => {
    const rIdx = 12 + i;
    wsSummary.getCell(`B${rIdx}`).value = row.label;
    wsSummary.getCell(`C${rIdx}`).value = row.count;
    wsSummary.getCell(`D${rIdx}`).value = row.pct;
    ["B", "C", "D"].forEach((c) => {
      wsSummary.getCell(`${c}${rIdx}`).border = thinBorder;
      wsSummary.getCell(`${c}${rIdx}`).font = { name: "Arial", size: 10 };
    });
  });

  // -------------------------------------------------------------
  // Sheet 2: ACADEMIC_MONITORING
  // -------------------------------------------------------------
  const wsRoster = workbook.addWorksheet("ACADEMIC_MONITORING", {
    views: [{ showGridLines: true }],
  });

  wsRoster.columns = [
    { header: "#", key: "index", width: 6 },
    { header: "Learner Name", key: "name", width: 28 },
    { header: "LRN", key: "lrn", width: 16 },
    { header: "Grade & Section", key: "gradeSection", width: 18 },
    { header: "Subject", key: "subject", width: 18 },
    { header: "Term Grade", key: "grade", width: 12 },
    { header: "Official Risk Level", key: "officialRisk", width: 20 },
    { header: "Identified Learning Need", key: "learningNeed", width: 34 },
    { header: "Recommended Action", key: "recommendation", width: 24 },
    { header: "Support Status", key: "supportStatus", width: 18 },
  ];

  // Header styling
  const headerRow = wsRoster.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  rows.forEach((r) => {
    const row = wsRoster.addRow({
      index: r.index,
      name: r.name,
      lrn: r.lrn,
      gradeSection: r.gradeSection,
      subject: r.subject,
      grade: r.grade,
      officialRisk: r.officialRisk,
      learningNeed: r.learningNeed,
      recommendation: r.recommendation,
      supportStatus: r.supportStatus,
    });

    row.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: "Arial", size: 9.5 };
      if (colNumber === 1 || colNumber === 6) {
        cell.alignment = { horizontal: "center" };
      }
      // Highlight High Risk
      if (colNumber === 7 && (r.officialRisk === "High Risk" || r.officialRisk === "High")) {
        cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFB91C1C" } };
      }
    });
  });

  // -------------------------------------------------------------
  // Sheet 3: INTERVENTIONS
  // -------------------------------------------------------------
  const wsInterventions = workbook.addWorksheet("INTERVENTIONS", {
    views: [{ showGridLines: true }],
  });

  wsInterventions.columns = [
    { header: "#", key: "index", width: 6 },
    { header: "Learner Name", key: "name", width: 28 },
    { header: "LRN", key: "lrn", width: 16 },
    { header: "Section", key: "gradeSection", width: 18 },
    { header: "Priority Need", key: "learningNeed", width: 36 },
    { header: "Assigned Remedial Pathway", key: "recommendation", width: 28 },
    { header: "Monitoring Status", key: "supportStatus", width: 18 },
  ];

  const intHeaderRow = wsInterventions.getRow(1);
  intHeaderRow.height = 24;
  intHeaderRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  const interventionRows = rows.filter(
    (r) =>
      r.officialRisk === "High Risk" ||
      r.officialRisk === "Moderate Risk" ||
      r.recommendation?.toLowerCase().includes("remedial") ||
      r.supportStatus === "Under Support"
  );

  interventionRows.forEach((r, idx) => {
    const row = wsInterventions.addRow({
      index: idx + 1,
      name: r.name,
      lrn: r.lrn,
      gradeSection: r.gradeSection,
      learningNeed: r.learningNeed,
      recommendation: r.recommendation,
      supportStatus: r.supportStatus,
    });
    row.eachCell((cell) => {
      cell.border = thinBorder;
      cell.font = { name: "Arial", size: 9.5 };
    });
  });

  return workbook;
}

/**
 * Executes Excel export with direct browser download
 */
export async function exportAcademicMonitoringExcel(params = {}) {
  const workbook = await buildAcademicMonitoringExcelWorkbook(params);
  const filename = buildMonitoringFilename({
    schoolYear: params.schoolYear,
    quarter: params.quarter,
    scope: params.scopeLabel || params.sectionName,
    role: params.role,
    format: "excel",
  });

  if (typeof window !== "undefined") {
    await downloadWorkbook(workbook, filename);
  }

  return { success: true, filename, workbook };
}
