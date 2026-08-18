/**
 * Student grades PDF export via printable HTML (browser Print → Save as PDF).
 * Matches the teacher reports export approach.
 */

import { termLabel } from "@/lib/academic/termLabels";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const rows = (grades.length ? grades : []).map(
    (row) => `<tr>
      <td>${escapeHtml(row.subject)}</td>
      <td>${escapeHtml(row.schoolYear)}</td>
      <td>${escapeHtml(termLabel(row.quarter))}</td>
      <td>${escapeHtml(row.finalGrade ?? "—")}</td>
      <td>${escapeHtml(row.status)}</td>
    </tr>`
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Student Grades — ${escapeHtml(profile.fullName || "Student")}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #1e293b; margin: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #173d2d; }
    h2 { font-size: 13px; margin: 24px 0 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .brand { font-size: 11px; color: #2f7d5f; font-weight: 600; letter-spacing: 0.04em; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .meta div { margin: 2px 0; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
    .metric { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .metric span { display: block; font-size: 11px; color: #94a3b8; }
    .metric strong { font-size: 16px; color: #173d2d; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; }
    @media print {
      body { margin: 16px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <button onclick="window.print()" style="margin-bottom:16px;padding:8px 12px;cursor:pointer;background:#2f7d5f;color:#fff;border:0;border-radius:6px;">Print / Save PDF</button>
  <div class="brand">CAMBAOG NATIONAL HIGH SCHOOL</div>
  <h1>Student Grade Summary</h1>
  <div class="meta">
    <div><strong>Student:</strong> ${escapeHtml(profile.fullName || "—")}</div>
    <div><strong>Student Number:</strong> ${escapeHtml(profile.studentNumber || "—")}</div>
    <div><strong>Grade &amp; Section:</strong> ${escapeHtml(profile.gradeSection || "—")}</div>
    <div><strong>School Year:</strong> ${escapeHtml(period.schoolYear || profile.schoolYear || "—")}</div>
    <div><strong>Term:</strong> ${escapeHtml(period.quarter != null && period.quarter !== "" ? termLabel(period.quarter) : "—")}</div>
    <div><strong>Date Generated:</strong> ${escapeHtml(dateGenerated)}</div>
  </div>

  <h2>Overview</h2>
  <div class="metrics">
    <div class="metric"><span>Average</span><strong>${escapeHtml(summary.average ?? "—")}</strong></div>
    <div class="metric"><span>Risk Level</span><strong>${escapeHtml(summary.riskLevel ?? "—")}</strong></div>
    <div class="metric"><span>Subjects Below 75</span><strong>${escapeHtml((summary.weakSubjects || []).length || 0)}</strong></div>
  </div>

  <h2>Grades</h2>
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>School Year</th>
        <th>Term</th>
        <th>Final Grade</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${
        rows.length
          ? rows.join("")
          : `<tr><td colspan="5">No grades recorded.</td></tr>`
      }
    </tbody>
  </table>

  <p class="footer">
    Generated from CNHS Learn. For school use only.
  </p>
</body>
</html>`;

  const printWindow = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=960,height=800"
  );
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
