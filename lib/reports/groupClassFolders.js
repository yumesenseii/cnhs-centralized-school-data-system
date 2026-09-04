/**
 * Collapse multi-term class report rows into one folder card (All Terms view).
 */

import { parseTermNumber, termShortLabel } from "@/lib/academic/termLabels";

function normalizeKeyPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Same grade/section + subject + teacher + school year = one class family.
 * @param {Record<string, unknown>} row
 */
export function classReportFolderKey(row = {}) {
  return [
    normalizeKeyPart(row.schoolYear),
    normalizeKeyPart(row.className || row.gradeSection),
    normalizeKeyPart(row.subject),
    normalizeKeyPart(row.teacherName || row.teacher),
  ].join("|");
}

function termNumberOf(row = {}) {
  return (
    parseTermNumber(row.quarterNumber) ??
    parseTermNumber(row.quarter) ??
    0
  );
}

/**
 * Prefer Final (4), else highest term number for preview/export.
 * @param {Array<Record<string, unknown>>} rows
 */
export function pickPrimaryClassReportRow(rows = []) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => termNumberOf(b) - termNumberOf(a));
  const finalRow = sorted.find((row) => termNumberOf(row) === 4);
  return finalRow || sorted[0];
}

function maxNum(rows, getter) {
  let max = 0;
  for (const row of rows) {
    const n = Number(getter(row) ?? 0);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * When All Terms is selected, group Term 1–3 siblings into one folder.
 * When a specific term is selected, returns rows unchanged.
 *
 * @param {Array<Record<string, unknown>>} reports
 * @param {{ groupMultiTerm?: boolean }} [options]
 */
export function groupClassReportsForFolderLibrary(
  reports = [],
  { groupMultiTerm = true } = {}
) {
  if (!groupMultiTerm || !reports.length) {
    return reports.map((row) => ({
      ...row,
      isTermGroup: false,
      termCount: 1,
      termLabels: [],
      primaryRow: row,
      termRows: [row],
    }));
  }

  const groups = new Map();
  for (const row of reports) {
    const key = classReportFolderKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const folders = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      const row = list[0];
      folders.push({
        ...row,
        isTermGroup: false,
        termCount: 1,
        termLabels: [],
        primaryRow: row,
        termRows: [row],
      });
      continue;
    }

    const sorted = [...list].sort((a, b) => termNumberOf(a) - termNumberOf(b));
    const primary = pickPrimaryClassReportRow(sorted);
    const termNumbers = [];
    const termLabels = [];
    for (const row of sorted) {
      const n = termNumberOf(row);
      if (n && !termNumbers.includes(n)) {
        termNumbers.push(n);
        termLabels.push(termShortLabel(n));
      }
    }

    folders.push({
      ...primary,
      id: primary.id,
      students: maxNum(sorted, (r) => r.students),
      highRisk: maxNum(sorted, (r) => r.highRisk),
      requiringIntervention: maxNum(sorted, (r) => r.requiringIntervention),
      aralScreening: maxNum(sorted, (r) =>
        r.aralEligible === false ? 0 : r.aralScreening
      ),
      aralEligible: sorted.some((r) => r.aralEligible === true),
      atRisk: maxNum(sorted, (r) => r.atRisk),
      averageGrade: primary.averageGrade,
      isTermGroup: true,
      termCount: sorted.length,
      termLabels,
      primaryRow: primary,
      termRows: sorted,
      relatedClassIds: sorted.map((r) => r.id),
    });
  }

  return folders.sort(
    (a, b) =>
      String(a.className).localeCompare(String(b.className)) ||
      String(a.subject).localeCompare(String(b.subject))
  );
}
