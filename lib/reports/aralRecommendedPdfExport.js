/**
 * Formal PDF export — ARAL Recommended Learners (Head Teacher / Admin).
 * CNHS target layout via printable HTML (browser Print → Save as PDF).
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
import { filterAralRecommendedLearners } from "@/lib/reports/aralRecommendedExport";
import { normalizeRecommendationType } from "@/lib/monitoring/recommendations";

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
    const cells = [
      String(index + 1),
      row.name ?? row.studentName ?? "—",
      row.studentNumber ?? row.lrn ?? "—",
      row.gradeSection ||
        `${row.grade ?? ""} ${row.section ?? ""}`.trim() ||
        "—",
    ];
    if (includeTeacherColumn) {
      cells.push(row.teacherName ?? row.teacher ?? row.adviserName ?? "—");
    }
    cells.push(
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
    return cells;
  });
}

/**
 * @param {object} options
 * @param {object[]} options.learners
 * @param {string} [options.schoolYear]
 * @param {string} [options.quarter]
 * @param {string} [options.scopeLabel]
 * @param {string} [options.preparedBy]
 * @param {string} [options.notedBy]
 * @param {boolean} [options.includeTeacherColumn]
 * @returns {{ count: number, filename: string }}
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
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `CNHS-ARAL-Recommended-${safeToken(scopeLabel)}-${safeToken(schoolYear || "SY")}-${dateStamp}.pdf`;

  const headers = [
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

  const rowsHtml = tableRows
    .map(
      (cells) =>
        `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
    )
    .join("");

  const bodyHtml = `
    <p class="section-label">Summary</p>
    ${renderKpiRowHtml([
      ["Learners listed", tableRows.length],
      ["Scope", scopeLabel],
      ["Term", period],
      ["School year", schoolYear || "—"],
    ])}

    <p class="section-label">ARAL recommended learners</p>
    ${renderDataTableHtml({
      headers,
      rowsHtml,
      emptyText: "No ARAL-recommended learners under current filters.",
      compact: true,
    })}
  `;

  const html = wrapCnhsPrintDocument({
    documentTitle: `ARAL Recommended — ${scopeLabel}`,
    letterheadSub: `${SYSTEM_NAME} · ARAL Recommended Learners`,
    title: "ARAL RECOMMENDED LEARNERS — FOR REVIEW",
    subtitle: `${schoolYear || "—"} · ${period} · ${scopeLabel}`,
    metaRows: [
      ["School year", schoolYear || "—"],
      ["Term / period", period],
      ["Scope", scopeLabel],
      ["Date generated", generatedAt],
    ],
    noteHtml:
      "System recommendation based on ECR grades (English/Filipino). For educator review before implementing ARAL interventions.",
    bodyHtml,
    showSignature: false,
    signatureHtml: renderDualSignatureHtml({
      preparedBy,
      notedBy,
    }),
    orientation: "landscape",
  });

  openPrintableHtml(html, {
    title: filename.replace(/\.pdf$/i, ""),
    autoPrint: true,
  });

  return { count: tableRows.length, filename };
}
