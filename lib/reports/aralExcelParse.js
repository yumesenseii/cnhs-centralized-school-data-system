/**
 * Shared ARAL Excel table reader (header-row scan for simple + official sheets).
 */

import * as XLSX from "xlsx";

export function normalizeAralHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeStudentNumber(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function pickAralCell(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

export const ARAL_STUDENT_NUMBER_KEYS = [
  "student_number",
  "student_number_lrn",
  "student_no",
  "lrn",
  "learner_id",
  "id_number",
];

function isStudentNumberHeader(key) {
  return (
    ARAL_STUDENT_NUMBER_KEYS.includes(key) ||
    key.includes("student_number") ||
    key === "lrn"
  );
}

function isBlankCell(value) {
  const s = String(value ?? "").trim();
  return !s || s === "—";
}

/**
 * Read the first data table from an ARAL workbook.
 * Finds the header row that contains Student Number (row 1 or official row 3).
 */
export function readAralWorkbookTable(buffer, { preferredSheet = null } = {}) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  if (!workbook.SheetNames.length) {
    return { rows: [], headers: [], errors: ["Workbook has no sheets."] };
  }

  const preferred = preferredSheet
    ? workbook.SheetNames.find((name) =>
        new RegExp(preferredSheet, "i").test(name)
      )
    : null;
  const detailed = workbook.SheetNames.find((name) =>
    /detail|score/i.test(name)
  );
  const sheetName = preferred || detailed || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  let headerIndex = -1;
  for (let i = 0; i < Math.min(matrix.length, 20); i += 1) {
    const headers = (matrix[i] || []).map((cell) => normalizeAralHeader(cell));
    if (headers.some((key) => isStudentNumberHeader(key))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      rows: [],
      headers: [],
      errors: [
        "Workbook columns do not match this section. Missing Student Number. Use a sheet with Student Number and the required data columns.",
      ],
    };
  }

  const headers = (matrix[headerIndex] || []).map((cell) =>
    normalizeAralHeader(cell)
  );
  const rows = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const line = matrix[i] || [];
    if (line.every((cell) => isBlankCell(cell))) continue;
    const filled = line.filter((cell) => !isBlankCell(cell)).length;
    if (filled <= 1 && String(line[0] || "").length > 80) continue;
    const row = {};
    headers.forEach((key, idx) => {
      if (key) row[key] = line[idx];
    });
    rows.push(row);
  }

  return { rows, headers, errors: [] };
}
