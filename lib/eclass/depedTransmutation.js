/**
 * DepEd Initial Grade → Term Grade transmutation.
 * Prefer the table embedded in the ECR (Helper / DO NOT DELETE).
 * Fallbacks: Adjusted (SY 2026–2027 / Class-Record Helper) then DO 8 s.2015.
 */

import { cellText, normalizeKey } from "@/lib/eclass/normalize";
import { getSheetCell, getSheetRange } from "@/lib/eclass/xlsxRead";

/** @typedef {{ min: number, max: number, grade: number }} TransmuteBand */

/**
 * Class-Record Helper table (matches GRADE7_ENGLISH sample TERM GRADE).
 * min–max Initial Grade → Term Grade.
 */
export const DEPED_ADJUSTED_TRANSMUTATION = [
  { min: 0, max: 39.99, grade: 60 },
  { min: 40, max: 42.99, grade: 61 },
  { min: 43, max: 45.99, grade: 62 },
  { min: 46, max: 47.99, grade: 63 },
  { min: 48, max: 49.99, grade: 64 },
  { min: 50, max: 51.99, grade: 65 },
  { min: 52, max: 53.99, grade: 66 },
  { min: 54, max: 55.99, grade: 67 },
  { min: 56, max: 57.99, grade: 68 },
  { min: 58, max: 59.99, grade: 69 },
  { min: 60, max: 61.99, grade: 70 },
  { min: 62, max: 63.99, grade: 71 },
  { min: 64, max: 65.99, grade: 72 },
  { min: 66, max: 67.99, grade: 73 },
  { min: 68, max: 69.99, grade: 74 },
  { min: 70, max: 72.99, grade: 75 },
  { min: 73, max: 74.99, grade: 76 },
  { min: 75, max: 75.99, grade: 77 },
  { min: 76, max: 76.99, grade: 78 },
  { min: 77, max: 77.99, grade: 79 },
  { min: 78, max: 78.99, grade: 80 },
  { min: 79, max: 79.99, grade: 81 },
  { min: 80, max: 80.99, grade: 82 },
  { min: 81, max: 81.99, grade: 83 },
  { min: 82, max: 82.99, grade: 84 },
  { min: 83, max: 83.99, grade: 85 },
  { min: 84, max: 84.99, grade: 86 },
  { min: 85, max: 85.99, grade: 87 },
  { min: 86, max: 86.99, grade: 88 },
  { min: 87, max: 87.99, grade: 89 },
  { min: 88, max: 88.99, grade: 90 },
  { min: 89, max: 89.99, grade: 91 },
  { min: 90, max: 90.99, grade: 92 },
  { min: 91, max: 91.99, grade: 93 },
  { min: 92, max: 92.99, grade: 94 },
  { min: 93, max: 93.99, grade: 95 },
  { min: 94, max: 94.99, grade: 96 },
  { min: 95, max: 95.99, grade: 97 },
  { min: 96, max: 97.49, grade: 98 },
  { min: 97.5, max: 99.49, grade: 99 },
  { min: 99.5, max: 100, grade: 100 },
];

/** Legacy DO 8, s. 2015 (older AVE / ECR templates). */
export const DEPED_DO8_TRANSMUTATION = [
  { min: 0, max: 3.99, grade: 60 },
  { min: 4, max: 7.99, grade: 61 },
  { min: 8, max: 11.99, grade: 62 },
  { min: 12, max: 15.99, grade: 63 },
  { min: 16, max: 19.99, grade: 64 },
  { min: 20, max: 23.99, grade: 65 },
  { min: 24, max: 27.99, grade: 66 },
  { min: 28, max: 31.99, grade: 67 },
  { min: 32, max: 35.99, grade: 68 },
  { min: 36, max: 39.99, grade: 69 },
  { min: 40, max: 43.99, grade: 70 },
  { min: 44, max: 47.99, grade: 71 },
  { min: 48, max: 51.99, grade: 72 },
  { min: 52, max: 55.99, grade: 73 },
  { min: 56, max: 59.99, grade: 74 },
  { min: 60, max: 61.59, grade: 75 },
  { min: 61.6, max: 63.19, grade: 76 },
  { min: 63.2, max: 64.79, grade: 77 },
  { min: 64.8, max: 66.39, grade: 78 },
  { min: 66.4, max: 67.99, grade: 79 },
  { min: 68, max: 69.59, grade: 80 },
  { min: 69.6, max: 71.19, grade: 81 },
  { min: 71.2, max: 72.79, grade: 82 },
  { min: 72.8, max: 74.39, grade: 83 },
  { min: 74.4, max: 75.99, grade: 84 },
  { min: 76, max: 77.59, grade: 85 },
  { min: 77.6, max: 79.19, grade: 86 },
  { min: 79.2, max: 80.79, grade: 87 },
  { min: 80.8, max: 82.39, grade: 88 },
  { min: 82.4, max: 83.99, grade: 89 },
  { min: 84, max: 85.59, grade: 90 },
  { min: 85.6, max: 87.19, grade: 91 },
  { min: 87.2, max: 88.79, grade: 92 },
  { min: 88.8, max: 90.39, grade: 93 },
  { min: 90.4, max: 91.99, grade: 94 },
  { min: 92, max: 93.59, grade: 95 },
  { min: 93.6, max: 95.19, grade: 96 },
  { min: 95.2, max: 96.79, grade: 97 },
  { min: 96.8, max: 98.39, grade: 98 },
  { min: 98.4, max: 99.99, grade: 99 },
  { min: 100, max: 100, grade: 100 },
];

function asNumber(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "")
    .replace(/,/g, "")
    .trim();
  if (!text || text === "-") return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

/**
 * Convert Initial Grade → Term Grade using a band table.
 * Never returns Initial Grade itself.
 */
export function transmuteInitialGrade(
  initial,
  table = DEPED_ADJUSTED_TRANSMUTATION
) {
  const ig = Number(initial);
  if (!Number.isFinite(ig)) return null;
  const clamped = Math.min(100, Math.max(0, ig));
  const bands = table?.length ? table : DEPED_ADJUSTED_TRANSMUTATION;

  for (const band of bands) {
    if (clamped >= band.min && clamped <= band.max) return band.grade;
  }

  // Edge: floating point just above a max
  for (let i = bands.length - 1; i >= 0; i -= 1) {
    if (clamped >= bands[i].min) return bands[i].grade;
  }
  return bands[0]?.grade ?? 60;
}

/**
 * Parse a transmute table from a Helper / DO NOT DELETE sheet.
 * Supports:
 * - Class-Record Helper: min | … | max | termGrade
 * - Legacy DO NOT DELETE: min | … | max (grade implied by row order from 60)
 */
export function parseTransmutationFromSheet(sheet) {
  if (!sheet) return null;
  const range = getSheetRange(sheet);
  let headerRow = -1;
  let minCol = null;
  let maxCol = null;
  let gradeCol = null;

  const headerEnd = Math.min(range.e.r, 15);
  for (let r = range.s.r; r <= headerEnd; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const key = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (!key.includes("transmutation")) continue;
      headerRow = r;
      // Scan nearby columns for numeric bands under/ beside the title.
      minCol = c;
      break;
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0 || minCol === null) return null;

  // Detect layout from the first data row under the title.
  const dataStart = headerRow + 1;
  const firstMin = asNumber(getSheetCell(sheet, dataStart, minCol));
  if (firstMin === null) return null;

  // Helper layout: minCol, maxCol = minCol+2, gradeCol = minCol+3
  const helperMax = asNumber(getSheetCell(sheet, dataStart, minCol + 2));
  const helperGrade = asNumber(getSheetCell(sheet, dataStart, minCol + 3));
  if (helperMax !== null && helperGrade !== null) {
    maxCol = minCol + 2;
    gradeCol = minCol + 3;
  } else {
    // DO NOT DELETE: min | dash | max — grade = 60 + rowIndex
    const legacyMax = asNumber(getSheetCell(sheet, dataStart, minCol + 2));
    if (legacyMax !== null) {
      maxCol = minCol + 2;
      gradeCol = null; // derived
    } else {
      return null;
    }
  }

  /** @type {TransmuteBand[]} */
  const bands = [];
  for (let r = dataStart; r <= Math.min(range.e.r, dataStart + 80); r += 1) {
    const min = asNumber(getSheetCell(sheet, r, minCol));
    const max = asNumber(getSheetCell(sheet, r, maxCol));
    if (min === null || max === null) {
      if (bands.length) break;
      continue;
    }
    let grade =
      gradeCol !== null ? asNumber(getSheetCell(sheet, r, gradeCol)) : null;
    if (grade === null) {
      // Legacy: first band → 60, then +1 per row
      grade = 60 + bands.length;
    }
    if (grade < 60 || grade > 100) continue;
    bands.push({ min, max, grade });
  }

  return bands.length >= 10 ? bands : null;
}

/**
 * Find the best transmute table in an already-opened workbook Sheets map.
 */
export function findTransmutationTable(sheets = {}, sheetNames = []) {
  const prefer = [
    ...sheetNames.filter((n) => /helper/i.test(n)),
    ...sheetNames.filter((n) => /do not delete/i.test(n)),
    ...sheetNames,
  ];
  const seen = new Set();
  for (const name of prefer) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const table = parseTransmutationFromSheet(sheets[name]);
    if (table) return { table, sheetName: name };
  }
  return { table: DEPED_ADJUSTED_TRANSMUTATION, sheetName: null };
}
