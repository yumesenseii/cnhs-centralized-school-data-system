/**
 * Student Academic Progress Report PDF export (standard A4 via jsPDF).
 * System-generated student copy for academic reference.
 * Unified with the CNHS LEARN design system.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { termLabel } from "@/lib/academic/termLabels";
import { SCHOOL_NAME } from "@/lib/constants/brand";
import { termGradeDescription } from "@/lib/ecr/computeGrades";

function safeFilenamePart(value) {
  return String(value || "CNHS")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * @param {object} input
 * @param {object} input.profile
 * @param {object} input.period
 * @param {object} input.summary
 * @param {Array} input.grades
 * @param {Array} [input.allGrades]
 * @param {string} [input.termFilter]
 * @param {Date} [input.generatedAt]
 */
export function exportStudentGradesPdf({
  profile = {},
  period = {},
  summary = {},
  grades = [],
  allGrades = [],
  termFilter = "all",
  generatedAt = new Date(),
} = {}) {
  if (typeof window === "undefined") {
    throw new Error("PDF download is only available in the browser.");
  }

  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const schoolYear =
    period.schoolYear || profile.schoolYear || "SY 2026–2027";
  const fullName = profile.fullName || profile.displayName || "Student";
  const gradeSection = profile.gradeSection || "—";
  const studentNumber = profile.studentNumber || "—";
  const gradeLevel = profile.gradeLevel || "—";
  const sectionName = profile.sectionName || "";

  // 1. Resolve Target Quarter for the Academic Progress Report
  let exportQuarter = 1;
  if (termFilter && termFilter !== "all" && Number.isFinite(Number(termFilter))) {
    exportQuarter = Number(termFilter);
  } else if (period.quarter != null && period.quarter !== "" && Number.isFinite(Number(period.quarter))) {
    exportQuarter = Number(period.quarter);
  } else if (grades.length && grades[0].quarter != null && Number.isFinite(Number(grades[0].quarter))) {
    exportQuarter = Number(grades[0].quarter);
  }

  const gradePeriodDisplay = termLabel(exportQuarter);

  // 2. Resolve rows for this specific term
  // Prefer rows matching this quarter from allGrades or grades
  const candidatePool = (allGrades && allGrades.length ? allGrades : grades) || [];
  let exportRows = candidatePool.filter((r) => Number(r.quarter) === exportQuarter);

  // If no quarter-scoped rows found, fall back to grades provided
  if (!exportRows.length) {
    exportRows = grades || [];
  }

  // 3. Calculate authoritative summary metrics from the exact rows displayed
  // Missing grades must never be counted as zero or factor into average / below 75
  const recordedRows = exportRows.filter(
    (r) =>
      r.finalGrade !== null &&
      r.finalGrade !== undefined &&
      r.finalGrade !== "" &&
      Number.isFinite(Number(r.finalGrade))
  );

  const totalSubjects = exportRows.length;
  const recordedCount = recordedRows.length;

  let averageDisplay = "";
  let below75Display = "";

  if (recordedCount > 0) {
    const sum = recordedRows.reduce((acc, r) => acc + Number(r.finalGrade), 0);
    const avg = Math.round((sum / recordedCount) * 100) / 100;
    // Format to 2 decimal places if not whole, or keep clean decimal
    averageDisplay = avg % 1 === 0 ? String(avg) : avg.toFixed(2);
    below75Display = String(
      recordedRows.filter((r) => Number(r.finalGrade) < 75).length
    );
  }

  // Standard A4 portrait: 595.28 pt x 841.89 pt
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const marginX = 40;
  const contentWidth = 515.28;
  const pageHeight = 841.89;
  let y = 36;

  // --------------------------------------------------
  // 1. INSTITUTION BRANDING & HEADER
  // --------------------------------------------------

  // CNHS LEARN Logo Emblem Badge
  doc.setFillColor(23, 77, 55); // #174D37
  doc.roundedRect(marginX, y, 34, 34, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("CNHS", marginX + 5, y + 21);

  // Institution Branding
  const textX = marginX + 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(23, 77, 55);
  doc.text("CNHS LEARN", textX, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text(
    String(SCHOOL_NAME || "Cambaog National High School"),
    textX,
    y + 26
  );

  y += 42;

  // Clean horizontal divider
  doc.setDrawColor(23, 77, 55);
  doc.setLineWidth(1.2);
  doc.line(marginX, y, marginX + contentWidth, y);

  y += 18;

  // --------------------------------------------------
  // 2. MAIN REPORT TITLE & SUBTITLE
  // --------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text("STUDENT ACADEMIC PROGRESS REPORT", marginX, y);

  y += 14;

  // Quick identification subtitle: [School Year] • [Grade Level] • [Section]
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Slate 500
  const headerMeta = [
    schoolYear,
    gradeLevel !== "—" ? gradeLevel : null,
    sectionName || null,
  ]
    .filter(Boolean)
    .join("  •  ") || [schoolYear, gradeSection].filter(Boolean).join("  •  ");
  doc.text(headerMeta, marginX, y);

  y += 16;

  // --------------------------------------------------
  // 3. STUDENT & SCHOOL INFORMATION (Balanced 2-Column Block)
  // Non-redundant: 3 rows left, 3 rows right
  // --------------------------------------------------
  const infoBoxHeight = 58;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.75);
  doc.roundedRect(marginX, y, contentWidth, infoBoxHeight, 4, 4, "FD");

  const col1LabelX = marginX + 12;
  const col1ValX = marginX + 104;
  const col2LabelX = marginX + 270;
  const col2ValX = marginX + 356;
  let infoY = y + 14;

  // Section Headers
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(23, 77, 55);
  doc.text("STUDENT INFORMATION", col1LabelX, infoY);
  doc.text("SCHOOL INFORMATION", col2LabelX, infoY);

  infoY += 13;

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Student Name:", col1LabelX, infoY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(String(fullName), col1ValX, infoY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("School Year:", col2LabelX, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(schoolYear), col2ValX, infoY);

  infoY += 13;

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Student Number:", col1LabelX, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(studentNumber), col1ValX, infoY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Grade Level:", col2LabelX, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(gradeLevel), col2ValX, infoY);

  infoY += 13;

  // Row 3
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Grade & Section:", col1LabelX, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(gradeSection), col1ValX, infoY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Grade Period:", col2LabelX, infoY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(String(gradePeriodDisplay), col2ValX, infoY);

  y += infoBoxHeight + 14;

  // --------------------------------------------------
  // 4. SUBJECT GRADES TABLE (Main Content)
  // Columns: SUBJECT | FINAL GRADE | DESCRIPTOR | STATUS
  // All subjects visible. No-grade subjects remain blank.
  // --------------------------------------------------
  const head = [["SUBJECT", "FINAL GRADE", "DESCRIPTOR", "STATUS"]];

  const tableRows = exportRows.map((row) => {
    const hasGrade =
      row.finalGrade !== null &&
      row.finalGrade !== undefined &&
      row.finalGrade !== "" &&
      Number.isFinite(Number(row.finalGrade));
    const numGrade = hasGrade ? Number(row.finalGrade) : null;

    const finalGradeStr = hasGrade ? String(numGrade) : "";
    const descriptor = hasGrade ? termGradeDescription(numGrade) : "";
    const status = hasGrade ? (numGrade < 75 ? "Below 75" : "Passing") : "";

    return [
      row.subject || "",
      finalGradeStr,
      descriptor,
      status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body: tableRows.length
      ? tableRows
      : [["No subjects assigned", "", "", ""]],
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [23, 77, 55], // CNHS Green (#174D37)
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 180.28 },
      1: { cellWidth: 75, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 155 },
      3: { cellWidth: 105 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: marginX, right: marginX },
  });

  y = (doc.lastAutoTable?.finalY ?? y + 100) + 16;

  // Check page overflow
  if (y + 160 > pageHeight - 36) {
    doc.addPage();
    y = 36;
  }

  // --------------------------------------------------
  // 5. ACADEMIC SUMMARY (Dynamic & Clean)
  // Overall Average, Recorded Subjects, Subjects Below 75
  // If no recorded grades: Overall Average blank, Recorded 0/N, Below 75 blank
  // --------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(23, 77, 55);
  doc.text("ACADEMIC SUMMARY", marginX, y);
  y += 8;

  const summaryBoxHeight = 52;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.75);
  doc.roundedRect(marginX, y, contentWidth, summaryBoxHeight, 4, 4, "FD");

  let sumLineY = y + 14;

  // Line 1: Overall Average
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Overall Average:", marginX + 14, sumLineY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(23, 77, 55);
  doc.text(averageDisplay || "", marginX + 130, sumLineY);

  sumLineY += 13;

  // Line 2: Recorded Subjects
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Recorded Subjects:", marginX + 14, sumLineY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(
    totalSubjects > 0 ? `${recordedCount} / ${totalSubjects}` : "0 / 0",
    marginX + 130,
    sumLineY
  );

  sumLineY += 13;

  // Line 3: Subjects Below 75
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Subjects Below 75:", marginX + 14, sumLineY);
  doc.setFont("helvetica", "bold");
  if (below75Display && Number(below75Display) > 0) {
    doc.setTextColor(220, 38, 38); // Red
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(below75Display || "", marginX + 130, sumLineY);

  y += summaryBoxHeight + 16;

  // --------------------------------------------------
  // 6. GENERAL REMARKS
  // --------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(23, 77, 55);
  doc.text("GENERAL REMARKS", marginX, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.text(
    "Academic records shown in this report are based on the available ECR records stored in CNHS LEARN.",
    marginX,
    y
  );
  y += 18;

  // --------------------------------------------------
  // 7. CERTIFICATION AREA (Signature Line)
  // --------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Certified True and Correct:", marginX, y);
  y += 24;

  doc.setDrawColor(148, 163, 184); // Slate 400
  doc.setLineWidth(0.75);
  doc.line(marginX, y, marginX + 180, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Teacher / Adviser", marginX, y);
  y += 20;

  // --------------------------------------------------
  // 8. FOOTER METADATA
  // --------------------------------------------------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated On: ${dateGenerated}`, marginX, y);

  y += 11;
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Generated from CNHS LEARN. For student reference only.",
    marginX,
    y
  );

  const filename = `Student-Academic-Progress-${safeFilenamePart(fullName)}.pdf`;
  doc.save(filename);
}
