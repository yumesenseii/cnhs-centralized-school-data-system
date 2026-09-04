/**
 * Student grades PDF export via printable HTML (browser Print → Save as PDF).
 * CNHS target layout (letterhead, KPI row, grade table, signature).
 */

import { termLabel } from "@/lib/academic/termLabels";
import {
  escapeHtml,
  renderDataTableHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";

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

  const rowsHtml = (grades.length ? grades : [])
    .map(
      (row) => `<tr>
      <td>${escapeHtml(row.subject)}</td>
      <td>${escapeHtml(row.schoolYear)}</td>
      <td>${escapeHtml(termLabel(row.quarter))}</td>
      <td>${escapeHtml(row.finalGrade ?? "—")}</td>
      <td>${escapeHtml(row.status)}</td>
    </tr>`
    )
    .join("");

  const bodyHtml = `
    <p class="section-label">Overview</p>
    ${renderKpiRowHtml([
      ["Average", summary.average ?? "—"],
      ["Risk level", summary.riskLevel ?? "—"],
      ["Subjects below 75", below75],
      ["Subjects listed", grades.length || 0],
    ])}

    <p class="section-label">Grades</p>
    ${renderDataTableHtml({
      headers: ["Subject", "School Year", "Term", "Final Grade", "Status"],
      rowsHtml,
      emptyText: "No grades recorded.",
    })}
  `;

  const html = wrapCnhsPrintDocument({
    documentTitle: `Student Grades — ${profile.fullName || "Student"}`,
    letterheadSub: "CNHS Learn · Student Grade Summary",
    title: "STUDENT GRADE SUMMARY",
    subtitle: `${profile.fullName || "—"} · ${profile.gradeSection || "—"}`,
    metaRows: [
      ["Student", profile.fullName || "—"],
      ["Student number", profile.studentNumber || "—"],
      ["Grade & section", profile.gradeSection || "—"],
      ["School year", schoolYear],
      ["Term", term],
      ["Date generated", dateGenerated],
    ],
    noteHtml: "Generated from CNHS Learn. For school use only.",
    bodyHtml,
    signatureLabel: "Certified true and correct:",
  });

  openPrintableHtml(html, {
    title: `Student-Grades-${profile.fullName || "CNHS"}`,
    autoPrint: true,
  });
}
