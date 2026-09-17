/**
 * Student grades PDF download (real .pdf via jsPDF).
 * Stays on the grades page — no new tab / route change.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { termLabel } from "@/lib/academic/termLabels";
import { SCHOOL_NAME } from "@/lib/constants/brand";

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
 */
export function exportStudentGradesPdf({
  profile = {},
  period = {},
  summary = {},
  grades = [],
  generatedAt = new Date(),
} = {}) {
  if (typeof window === "undefined") {
    throw new Error("PDF download is only available in the browser.");
  }

  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const term =
    period.quarter != null && period.quarter !== ""
      ? termLabel(period.quarter)
      : "—";
  const schoolYear = period.schoolYear || profile.schoolYear || "—";
  const below75 = (summary.weakSubjects || []).length || 0;
  const fullName = profile.fullName || "Student";

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 48;
  let y = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(47, 125, 95);
  doc.text("CNHS Learn", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(String(SCHOOL_NAME || "Cambaog National High School"), marginX, y);
  y += 14;
  doc.setDrawColor(47, 125, 95);
  doc.setLineWidth(1);
  doc.line(marginX, y, 564, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("STUDENT GRADE SUMMARY", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`${fullName}  ·  ${profile.gradeSection || "—"}`, marginX, y);
  y += 20;

  const meta = [
    ["Student", fullName],
    ["Student number", profile.studentNumber || "—"],
    ["Grade & section", profile.gradeSection || "—"],
    ["School year", schoolYear],
    ["Term", term],
    ["Average", summary.average != null ? String(summary.average) : "—"],
    ["Risk level", summary.riskLevel || "—"],
    ["Subjects below 75", String(below75)],
    ["Date generated", dateGenerated],
  ];

  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`${label}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(String(value), marginX + 110, y);
    y += 13;
  }

  y += 8;

  const tableRows = (grades.length ? grades : []).map((row) => [
    row.subject || "—",
    row.schoolYear || "—",
    termLabel(row.quarter),
    row.finalGrade != null ? String(row.finalGrade) : "—",
    row.status || "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Subject", "School Year", "Term", "Final Grade", "Status"]],
    body: tableRows.length
      ? tableRows
      : [["No grades recorded.", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [47, 125, 95],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 248, 246] },
    margin: { left: marginX, right: marginX },
  });

  const endY = (doc.lastAutoTable?.finalY ?? y) + 24;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Generated from CNHS Learn. For school use only. View-only student copy.",
    marginX,
    endY
  );
  doc.setFont("helvetica", "normal");
  doc.text("Certified true and correct:", marginX, endY + 28);
  doc.line(marginX, endY + 56, marginX + 180, endY + 56);

  const filename = `Student-Grades-${safeFilenamePart(fullName)}.pdf`;
  doc.save(filename);
}
