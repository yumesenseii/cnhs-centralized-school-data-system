/**
 * Official Academic Records Exporter (PDF & Excel)
 * Generates official DepEd Cambaog National High School quarterly grade summaries:
 * 1. PDF (.pdf) via jsPDF and jspdf-autotable (A4 portrait, DepEd letterhead, KPIs, grades table, signatories)
 * 2. Excel (.xlsx) via ExcelJS (Multi-tab official executive report)
 *
 * Guarantees:
 * - DepEd MATATAG / K-12 grading standards (Passed >= 75, Failed < 75)
 * - Official Cambaog NHS header with School ID 300793, Division of Bulacan, Bustos
 * - Zero fabricated signatories (authentic role titles with fallback signatures)
 * - Windows-safe filename generation
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import { SF9_SCHOOL_INFO } from "@/lib/reports/sf9DataService";
import { DEPED_SEAL_BASE64, CNHS_LOGO_BASE64 } from "@/lib/reports/sf9Logos";
import { windowsSafeFilename } from "@/lib/reports/exportFilenames";

const BRAND_GREEN = [36, 111, 84]; // #246f54
const BRAND_AMBER = [194, 65, 12];
const TEXT_DARK = [30, 41, 59];
const TEXT_MUTED = [100, 116, 139];
const BORDER_COLOR = [226, 232, 240];

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
 * Standardized Windows-safe filename builder for Academic Records exports
 */
export function buildAcademicRecordsFilename({
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  classTitle = "Class List",
  format = "pdf",
} = {}) {
  const cleanYear = String(schoolYear || "SY 2026-2027").replace(/\s+/g, "");
  const cleanQuarter = String(quarter || "Q1").replace(/\s+/g, "");
  const cleanClass = safeToken(classTitle || "Class_List");
  const ext = format === "excel" ? "xlsx" : "pdf";
  const raw = `CNHS_Academic_Records_${cleanClass}_${cleanYear}_${cleanQuarter}.${ext}`;
  return windowsSafeFilename(raw);
}

/**
 * Builds the official Academic Records PDF Document via jsPDF and jspdf-autotable.
 * Usable both in browser and automated testing environments.
 */
export function buildAcademicRecordsPdfDoc({
  students = [],
  classes = [],
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  periodLabel = "",
  classTitle = "",
  teacherName = "Subject Teacher",
  schoolHeadName = null,
  summaryCards = [],
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
  } catch {
    // Optional fallback
  }

  try {
    if (CNHS_LOGO_BASE64) {
      doc.addImage(CNHS_LOGO_BASE64, "PNG", pageWidth - marginX - 54, y, 48, 48);
    }
  } catch {
    // Optional fallback
  }

  // 2. Official DepEd Letterhead
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
  doc.text("ACADEMIC RECORDS & QUARTERLY GRADE SUMMARY", pageWidth / 2, y, { align: "center" });
  y += 14;

  const resolvedScope = classTitle || "School-Wide Academic Master List";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`${schoolYear} · ${quarter || periodLabel || "All Terms"} · Scope: ${resolvedScope}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 16;

  // 3. Metadata Grid Box
  doc.setDrawColor(...BORDER_COLOR);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, y, contentWidth, 34, 4, 4, "FD");

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("School Year:", marginX + 10, y + 13);
  doc.text("Academic Term:", marginX + 10, y + 25);
  doc.text("Class / Scope:", marginX + 180, y + 13);
  doc.text("Date Generated:", marginX + 180, y + 25);
  doc.text("Curriculum:", marginX + 410, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(`${schoolYear}`, marginX + 75, y + 13);
  doc.text(`${quarter || periodLabel || "All Terms"}`, marginX + 75, y + 25);
  doc.text(resolvedScope.slice(0, 38), marginX + 255, y + 13);
  doc.text(
    generatedAt.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    marginX + 255,
    y + 25
  );
  doc.text("DepEd Standards", marginX + 465, y + 13);

  y += 42;

  // 4. Normalize Rows & KPI Cards
  const rows =
    students.length > 0
      ? students
      : (classes ?? []).flatMap((cls) =>
          (cls.students ?? []).map((row) => ({
            ...row,
            classLabel: `${cls.subject} · ${cls.gradeSection} · ${cls.termLabel}`,
          }))
        );

  const total = rows.length;
  let passedCount = 0;
  let failedCount = 0;
  let gradeSum = 0;
  let gradeCount = 0;

  rows.forEach((r) => {
    const rawGrade = r.termGrade ?? r.final ?? r.term3 ?? r.term2 ?? r.term1;
    const g = Number(rawGrade);
    if (Number.isFinite(g) && g > 0) {
      gradeSum += g;
      gradeCount += 1;
      if (g >= 75) passedCount += 1;
      else failedCount += 1;
    }
  });

  const averageGrade = gradeCount > 0 ? (gradeSum / gradeCount).toFixed(1) : "—";
  const passingRate = gradeCount > 0 ? `${Math.round((passedCount / gradeCount) * 100)}%` : "—";

  const kpiCardWidth = (contentWidth - 18) / 4;
  const kpiData = [
    { label: "ENROLLED LEARNERS", value: String(total), color: BRAND_GREEN },
    { label: "PASSING RATE", value: passingRate, color: BRAND_GREEN },
    { label: "DEVELOPING (<75)", value: String(failedCount), color: failedCount > 0 ? BRAND_AMBER : BRAND_GREEN },
    { label: "CLASS AVERAGE", value: String(averageGrade), color: TEXT_DARK },
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

  // 5. Grading Policy Note
  doc.setFillColor(254, 252, 232); // light amber
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(marginX, y, contentWidth, 22, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 63, 18);
  const disclaimerText =
    "AUTHORITATIVE POLICY NOTE: Official DepEd Grading Descriptors: 90-100 Advancing, 80-89 Benchmarking, 75-79 Connecting (Passed); 65-74 Developing, 0-64 Emerging (Failed). Final ratings derived strictly from authorized electronic class records.";
  doc.text(disclaimerText, marginX + 8, y + 10, { maxWidth: contentWidth - 16 });

  y += 30;

  // 6. Quarterly Grades Table
  const tableHeaders = ["#", "Student No. / LRN", "Learner Name", "Sex", "Q1", "Q2", "Q3", "Final", "Class Grade", "Remarks"];

  const fmtGrade = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : "—";
  };

  const tableBody = rows.map((r, idx) => {
    const termGrade = r.termGrade ?? r.final ?? r.term3 ?? r.term2 ?? r.term1;
    const g = Number(termGrade);
    const remark = Number.isFinite(g) && g > 0 ? (g >= 75 ? "Passed" : "Failed") : "—";
    return [
      String(idx + 1),
      String(r.studentNumber || r.lrn || "—"),
      String(r.studentName || r.name || `Learner ${idx + 1}`),
      String(r.gender || r.sex || "—"),
      fmtGrade(r.term1),
      fmtGrade(r.term2),
      fmtGrade(r.term3),
      fmtGrade(r.final),
      fmtGrade(termGrade),
      remark,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableBody.length > 0 ? tableBody : [["—", "—", "No academic records match the selected scope.", "—", "—", "—", "—", "—", "—", "—"]],
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
      1: { cellWidth: 76 },
      2: { cellWidth: 136, fontStyle: "bold" },
      3: { cellWidth: 26, halign: "center" },
      4: { cellWidth: 35, halign: "center" },
      5: { cellWidth: 35, halign: "center" },
      6: { cellWidth: 35, halign: "center" },
      7: { cellWidth: 35, halign: "center" },
      8: { cellWidth: 56, halign: "center", fontStyle: "bold" },
      9: { cellWidth: 70, halign: "center" },
    },
    didDrawPage: () => {
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
  doc.text("Prepared by:", marginX + 20, signY);
  doc.text("Noted by:", pageWidth - marginX - 180, signY);

  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(1);
  doc.line(marginX + 20, signY + 36, marginX + 180, signY + 36);
  doc.line(pageWidth - marginX - 180, signY + 36, pageWidth - marginX - 20, signY + 36);

  const prepNameUpper =
    teacherName && teacherName !== "Subject Teacher" && !teacherName.toLowerCase().includes("maria santos")
      ? teacherName.toUpperCase()
      : "(Signature over Printed Name)";
  const headNameUpper =
    schoolHeadName && !schoolHeadName.toLowerCase().includes("maria santos")
      ? schoolHeadName.toUpperCase()
      : (SF9_SCHOOL_INFO.defaultSchoolHead || "(Signature over Printed Name)");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(prepNameUpper, marginX + 20, signY + 46);
  doc.text(headNameUpper, pageWidth - marginX - 180, signY + 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Subject Teacher / Class Adviser", marginX + 20, signY + 56);
  doc.text(SF9_SCHOOL_INFO.schoolHeadTitle || "School Head / Principal", pageWidth - marginX - 180, signY + 56);

  return doc;
}

/**
 * Executes PDF export with direct browser download
 */
export function exportAcademicRecordsPdf(params = {}) {
  const doc = buildAcademicRecordsPdfDoc(params);
  const filename = buildAcademicRecordsFilename({
    schoolYear: params.schoolYear,
    quarter: params.quarter,
    classTitle: params.classTitle,
    format: "pdf",
  });

  if (typeof window !== "undefined") {
    doc.save(filename);
  }

  return { success: true, filename, doc };
}

/**
 * Official Excel export via ExcelJS
 */
export async function exportAcademicRecordsExcel({
  students = [],
  classes = [],
  summaryCards = [],
  schoolYear = "",
  quarter = "",
  periodLabel = "",
  classTitle = "",
} = {}) {
  const metrics = (summaryCards ?? []).slice(0, 8).map((card) => ({
    label: card.label,
    value: card.value,
    tone:
      card.tone === "red"
        ? "red"
        : card.tone === "orange"
          ? "amber"
          : card.tone === "green"
            ? "green"
            : "default",
  }));

  const rows =
    students.length > 0
      ? students
      : (classes ?? []).flatMap((cls) =>
          (cls.students ?? []).map((row) => ({
            ...row,
            classLabel: `${cls.subject} · ${cls.gradeSection} · ${cls.termLabel}`,
          }))
        );

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: classTitle
        ? `Academic Records — ${classTitle}`
        : "Academic Records — Class lists",
      schoolYear: schoolYear || "—",
      quarter: quarter || periodLabel || "—",
      generatedBy: "Principal / Admin",
      totalRecords: rows.length,
    },
    metrics,
    chartSeries: [],
    table: {
      sheetName: "Class List",
      title: classTitle || `Class lists — ${periodLabel || schoolYear || "SY"}`,
      columns: [
        { key: "studentNumber", header: "Student Number", width: 16 },
        { key: "studentName", header: "Learner Name", width: 24 },
        { key: "gender", header: "Gender", width: 10 },
        { key: "term1", header: "Term 1", width: 10, numeric: true, gradeRule: true },
        { key: "term2", header: "Term 2", width: 10, numeric: true, gradeRule: true },
        { key: "term3", header: "Term 3", width: 10, numeric: true, gradeRule: true },
        { key: "final", header: "Final", width: 10, numeric: true, gradeRule: true },
        {
          key: "termGrade",
          header: "Class term grade",
          width: 14,
          numeric: true,
          gradeRule: true,
        },
      ],
      rows,
    },
    narrativeContext: {
      totalClasses: summaryCards.find((c) => c.id === "uploaded")?.value ?? 0,
      totalStudents: rows.length,
      averageGrade: null,
      atRisk: 0,
      aralLearners: 0,
      classroomRemedial: 0,
    },
  });

  const filename = buildAcademicRecordsFilename({
    schoolYear,
    quarter,
    classTitle,
    format: "excel",
  });

  await downloadWorkbook(workbook, filename);
  return { success: true, filename, workbook };
}
