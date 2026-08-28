/**
 * Formal PDF export — ARAL Recommended Learners (Head Teacher / Admin).
 * Landscape Legal, tabular layout, signatory block at the bottom.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SCHOOL_NAME, SYSTEM_NAME } from "@/lib/constants/brand";
import { filterAralRecommendedLearners } from "@/lib/reports/aralRecommendedExport";
import { normalizeRecommendationType } from "@/lib/monitoring/recommendations";

const BRAND_GREEN = [36, 111, 84];
const SLATE_DARK = [30, 41, 59];
const SLATE = [100, 116, 139];

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

function formatGeneratedAt(date = new Date()) {
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildTableRows(learners = [], { includeTeacherColumn = false } = {}) {
  return filterAralRecommendedLearners(learners).map((row, index) => {
    const base = [
      String(index + 1),
      row.name ?? row.studentName ?? "—",
      row.studentNumber ?? row.lrn ?? "—",
      row.gradeSection ||
        `${row.grade ?? ""} ${row.section ?? ""}`.trim() ||
        "—",
    ];
    if (includeTeacherColumn) {
      base.push(row.teacherName ?? row.teacher ?? row.adviserName ?? "—");
    }
    base.push(
      row.subject ?? "—",
      row.recommendationReason ||
        (Array.isArray(row.recommendationReasons)
          ? row.recommendationReasons.join("; ")
          : "") ||
        (Array.isArray(row.weakSubjects) ? row.weakSubjects.join(", ") : "") ||
        row.weakSubject ||
        "—",
      row.riskLevel ?? "—",
      normalizeRecommendationType(row.recommendation),
      row.aralApprovalStatus || "Suggested",
      row.quarter || "—"
    );
    return base;
  });
}

function paintSignatories(doc, startY, { preparedBy, notedBy }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const colWidth = (pageWidth - margin * 2 - 12) / 2;
  const leftX = margin;
  const rightX = margin + colWidth + 12;
  let y = startY + 8;

  if (y > doc.internal.pageSize.getHeight() - 42) {
    doc.addPage();
    y = 24;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_DARK);
  doc.text("Prepared by:", leftX, y);
  doc.text("Noted by:", rightX, y);

  y += 14;
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.3);
  doc.line(leftX, y, leftX + colWidth, y);
  doc.line(rightX, y, rightX + colWidth, y);

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(preparedBy || "________________________", leftX, y, {
    maxWidth: colWidth,
  });
  doc.text(notedBy || "________________________", rightX, y, {
    maxWidth: colWidth,
  });

  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text("Head Teacher / Administrator", leftX, y);
  doc.text("Principal / OIC", rightX, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text("Date: _________________________", leftX, y);
  doc.text("Date: _________________________", rightX, y);
}

/**
 * @param {object} options
 * @param {object[]} options.learners
 * @param {string} [options.schoolYear]
 * @param {string} [options.quarter]
 * @param {string} [options.scopeLabel]
 * @param {string} [options.preparedBy] — signatory name (Head Teacher)
 * @param {string} [options.notedBy] — second signatory line (optional)
 * @param {boolean} [options.includeTeacherColumn]
 */
export function exportAralRecommendedPdf({
  learners = [],
  schoolYear = "",
  quarter = "",
  scopeLabel = "School-wide",
  preparedBy = "",
  notedBy = "",
  includeTeacherColumn = true,
} = {}) {
  const tableRows = buildTableRows(learners, { includeTeacherColumn });
  const period = quarter || "All Terms";
  const generatedAt = formatGeneratedAt();

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "legal",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(SCHOOL_NAME.toUpperCase(), pageWidth / 2, y, { align: "center" });

  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(SYSTEM_NAME, pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setFontSize(13);
  doc.setTextColor(...SLATE_DARK);
  doc.text("ARAL Recommended Learners — For Review", pageWidth / 2, y, {
    align: "center",
  });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_DARK);
  const metaLines = [
    `School Year: ${schoolYear || "—"}`,
    `Term / Period: ${period}`,
    `Scope: ${scopeLabel}`,
    `Generated: ${generatedAt}`,
    `Total learners: ${tableRows.length}`,
  ];
  for (const line of metaLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }

  y += 2;
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(
    "System recommendation based on ECR grades (English/Filipino). For educator review before implementing ARAL interventions.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );

  const head = [
    "#",
    "Learner Name",
    "Student No. / LRN",
    "Grade & Section",
    ...(includeTeacherColumn ? ["Teacher"] : []),
    "Subject",
    "Subject Gaps / Reasons",
    "Risk Level",
    "Recommendation",
    "HT Approval",
    "Term",
  ];

  const emptyRow = Array(head.length).fill("—");
  if (!tableRows.length) {
    emptyRow[1] = "No ARAL-recommended learners under current filters.";
  }

  autoTable(doc, {
    startY: y + 4,
    head: [head],
    body: tableRows.length ? tableRows : [emptyRow],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: SLATE_DARK,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: "middle",
    },
    headStyles: {
      fillColor: BRAND_GREEN,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 32 },
      2: { cellWidth: 22 },
      3: { cellWidth: 24 },
      ...(includeTeacherColumn ? { 4: { cellWidth: 22 } } : {}),
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const footerY = doc.internal.pageSize.getHeight() - 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SLATE);
      doc.text(
        `${SYSTEM_NAME} · Academic Monitoring · Page ${data.pageNumber}`,
        pageWidth / 2,
        footerY,
        { align: "center" }
      );
    },
  });

  const finalY = doc.lastAutoTable?.finalY ?? y + 20;
  paintSignatories(doc, finalY, { preparedBy, notedBy });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `CNHS-ARAL-Recommended-${safeToken(scopeLabel)}-${safeToken(schoolYear || "SY")}-${dateStamp}.pdf`;
  doc.save(filename);

  return { count: tableRows.length, filename };
}
