/**
 * Parse SF2 / attendance spreadsheet rows into normalized learner attendance.
 * Expected columns (flexible headers):
 *   student_number | lrn | learner id
 *   present | present_days
 *   absent | absent_days
 *   late | late_days
 *   school_days | days
 *
 * Attendance Monitoring only — never used by Academic Prediction / RF.
 */

import * as XLSX from "xlsx";

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

/**
 * @param {ArrayBuffer|Uint8Array|Buffer} buffer
 * @returns {{ rows: Array<object>, errors: string[] }}
 */
export function parseSf2Workbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["Workbook has no sheets."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rawRows.length) {
    return { rows: [], errors: ["No data rows found in the first sheet."] };
  }

  const rows = [];
  const errors = [];

  rawRows.forEach((raw, index) => {
    const normalized = {};
    for (const [key, value] of Object.entries(raw)) {
      normalized[normalizeHeader(key)] = value;
    }

    const studentNumber = String(
      pick(normalized, [
        "student_number",
        "lrn",
        "learner_id",
        "learner_reference_number",
        "id_number",
      ]) ?? ""
    ).trim();

    if (!studentNumber) {
      errors.push(`Row ${index + 2}: missing student number / LRN.`);
      return;
    }

    const present = toInt(
      pick(normalized, ["present", "present_days", "days_present"]),
      0
    );
    const absent = toInt(
      pick(normalized, ["absent", "absent_days", "days_absent"]),
      0
    );
    const late = toInt(
      pick(normalized, ["late", "late_days", "days_late", "tardy"]),
      0
    );
    let schoolDays = toInt(
      pick(normalized, ["school_days", "days", "total_days", "class_days"]),
      0
    );
    if (schoolDays <= 0) schoolDays = present + absent;

    rows.push({
      studentNumber,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      schoolDays,
    });
  });

  return { rows, errors };
}
