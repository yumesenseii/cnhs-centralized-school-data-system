/**
 * Parse CNHS SF2-COMP workbooks (class monthly M/F/Total summaries).
 * Layout: month blocks side-by-side; school days beside month name.
 * Recomputes Percentage, ADA, PA in code for consistency.
 * Attendance Monitoring only — never used by Academic Prediction / RF.
 */

import * as XLSX from "xlsx";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_NAME_TO_NUM = Object.fromEntries(
  MONTH_LABELS.map((label, index) => [label.toUpperCase(), index + 1])
);

const METRIC_KEYS = [
  ["total attendance of the month", "attendanceOfMonth"],
  ["no. of absences", "absences"],
  ["no of absences", "absences"],
  ["total attendance", "totalAttendance"],
  ["first friday", "firstFriday"],
  ["late", "late"],
  ["end of the month", "endOfMonth"],
  ["percentage", "percentage"],
  ["ada", "ada"],
  ["pa", "pa"],
  ["5 consecutive", "fiveConsecutive"],
  ["nls", "nls"],
  ["to", "transferredOut"],
  ["ti", "transferredIn"],
];

function normalizeLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toNum(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round1(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function sexTriple(m, f, total) {
  const male = toNum(m);
  const female = toNum(f);
  let tot = toNum(total, NaN);
  if (!Number.isFinite(tot)) tot = male + female;
  return { m: male, f: female, total: tot };
}

function metricKeyForLabel(label) {
  const norm = normalizeLabel(label);
  for (const [pattern, key] of METRIC_KEYS) {
    if (norm === pattern) return key;
  }
  // Prefer exact "total attendance" over "total attendance of the month"
  if (norm.startsWith("total attendance of the month")) return "attendanceOfMonth";
  if (norm === "total attendance") return "totalAttendance";
  return null;
}

function recomputeDerived(block) {
  const schoolDays = toNum(block.schoolDays);
  const attendanceOfMonth = block.attendanceOfMonth?.total ?? 0;
  const absences = block.absences?.total ?? 0;
  let totalAttendance = block.totalAttendance?.total;
  if (totalAttendance == null || totalAttendance === 0) {
    totalAttendance = Math.max(0, attendanceOfMonth - absences);
  }
  const firstFriday = block.firstFriday?.total ?? 0;
  const endOfMonth = block.endOfMonth?.total ?? 0;

  const percentage =
    firstFriday > 0 ? round1((endOfMonth / firstFriday) * 100) : null;
  const ada = schoolDays > 0 ? round1(totalAttendance / schoolDays) : null;
  const pa =
    firstFriday > 0 && ada != null ? round1((ada / firstFriday) * 100) : null;

  // Sex-split ADA when possible
  const adaM =
    schoolDays > 0 && block.totalAttendance
      ? round1(block.totalAttendance.m / schoolDays)
      : null;
  const adaF =
    schoolDays > 0 && block.totalAttendance
      ? round1(block.totalAttendance.f / schoolDays)
      : null;

  return {
    ...block,
    totalAttendance: block.totalAttendance || {
      m: 0,
      f: 0,
      total: totalAttendance,
    },
    percentage: {
      m:
        block.firstFriday?.m > 0
          ? round1((block.endOfMonth.m / block.firstFriday.m) * 100)
          : null,
      f:
        block.firstFriday?.f > 0
          ? round1((block.endOfMonth.f / block.firstFriday.f) * 100)
          : null,
      total: percentage,
    },
    ada: {
      m: adaM,
      f: adaF,
      total: ada,
    },
    pa: {
      m:
        block.firstFriday?.m > 0 && adaM != null
          ? round1((adaM / block.firstFriday.m) * 100)
          : null,
      f:
        block.firstFriday?.f > 0 && adaF != null
          ? round1((adaF / block.firstFriday.f) * 100)
          : null,
      total: pa,
    },
  };
}

function emptyBlock(month, schoolDays) {
  return {
    month,
    monthName: MONTH_LABELS[month - 1] || String(month),
    schoolDays: toNum(schoolDays),
    attendanceOfMonth: { m: 0, f: 0, total: 0 },
    absences: { m: 0, f: 0, total: 0 },
    totalAttendance: { m: 0, f: 0, total: 0 },
    firstFriday: { m: 0, f: 0, total: 0 },
    late: { m: 0, f: 0, total: 0 },
    endOfMonth: { m: 0, f: 0, total: 0 },
    percentage: { m: null, f: null, total: null },
    ada: { m: null, f: null, total: null },
    pa: { m: null, f: null, total: null },
    fiveConsecutive: { m: 0, f: 0, total: 0 },
    nls: { m: 0, f: 0, total: 0 },
    transferredOut: { m: 0, f: 0, total: 0 },
    transferredIn: { m: 0, f: 0, total: 0 },
  };
}

/**
 * Extract section hint from filename e.g. SF2-COMP-_20YAKAL.xlsx → YAKAL
 */
export function sectionHintFromFileName(fileName = "") {
  const base = String(fileName).replace(/\.[^.]+$/, "");
  const match = base.match(/(\d{1,2})?[_-]?([A-Za-z][A-Za-z\- ]+)$/);
  if (match?.[2]) return match[2].trim().replace(/[_-]+/g, " ");
  const parts = base.split(/[_-]+/).filter(Boolean);
  return parts[parts.length - 1] || "";
}

/**
 * @param {ArrayBuffer|Uint8Array|Buffer} buffer
 * @returns {{ months: object[], errors: string[], sectionHint: string }}
 */
export function parseSf2CompWorkbook(buffer, { fileName = "" } = {}) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      months: [],
      errors: ["Workbook has no sheets."],
      sectionHint: sectionHintFromFileName(fileName),
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const errors = [];
  const months = [];
  const blockStarts = [];

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "")
        .trim()
        .toUpperCase();
      const monthNum = MONTH_NAME_TO_NUM[cell];
      if (!monthNum) continue;
      // School days usually 3 cols to the right of month label in this layout
      let schoolDays = toNum(row[c + 3], NaN);
      if (!Number.isFinite(schoolDays)) {
        schoolDays = toNum(row[c + 1], NaN);
      }
      if (!Number.isFinite(schoolDays)) schoolDays = 0;
      blockStarts.push({ row: r, col: c, month: monthNum, schoolDays });
    }
  }

  if (!blockStarts.length) {
    return {
      months: [],
      errors: [
        "No month headers found (expected JUNE, JULY, … in SF2-COMP layout).",
      ],
      sectionHint: sectionHintFromFileName(fileName),
    };
  }

  for (const start of blockStarts) {
    const block = emptyBlock(start.month, start.schoolDays);
    const labelCol = start.col;
    const mCol = start.col + 1;
    const fCol = start.col + 2;
    const tCol = start.col + 3;

    // Scan following rows until blank metric stretch or next month header zone
    for (let r = start.row + 1; r < Math.min(aoa.length, start.row + 20); r++) {
      const row = aoa[r] || [];
      const label = row[labelCol];
      const key = metricKeyForLabel(label);
      if (!key) continue;
      // Skip header row "M F Total"
      if (normalizeLabel(label) === "m") continue;

      const triple = sexTriple(row[mCol], row[fCol], row[tCol]);
      if (key === "attendanceOfMonth") block.attendanceOfMonth = triple;
      else if (key === "absences") block.absences = triple;
      else if (key === "totalAttendance") block.totalAttendance = triple;
      else if (key === "firstFriday") block.firstFriday = triple;
      else if (key === "late") block.late = triple;
      else if (key === "endOfMonth") block.endOfMonth = triple;
      else if (key === "fiveConsecutive") block.fiveConsecutive = triple;
      else if (key === "nls") block.nls = triple;
      else if (key === "transferredOut") block.transferredOut = triple;
      else if (key === "transferredIn") block.transferredIn = triple;
      // percentage / ada / pa overwritten by recomputeDerived
    }

    // Ensure totalAttendance from formula if missing
    if (
      !block.totalAttendance?.total &&
      (block.attendanceOfMonth?.total || block.absences?.total)
    ) {
      block.totalAttendance = {
        m: Math.max(
          0,
          (block.attendanceOfMonth?.m || 0) - (block.absences?.m || 0)
        ),
        f: Math.max(
          0,
          (block.attendanceOfMonth?.f || 0) - (block.absences?.f || 0)
        ),
        total: Math.max(
          0,
          (block.attendanceOfMonth?.total || 0) - (block.absences?.total || 0)
        ),
      };
    }

    months.push(recomputeDerived(block));
  }

  // Dedupe by month (keep last)
  const byMonth = new Map();
  for (const m of months) byMonth.set(m.month, m);

  return {
    months: [...byMonth.values()].sort((a, b) => a.month - b.month),
    errors,
    sectionHint: sectionHintFromFileName(fileName),
  };
}

/** Map parsed month block → DB row fields (totals + breakdown jsonb). */
export function monthBlockToDbFields(block) {
  return {
    month: block.month,
    school_days: toNum(block.schoolDays),
    attendance_of_month: toNum(block.attendanceOfMonth?.total),
    absences: toNum(block.absences?.total),
    total_attendance: toNum(block.totalAttendance?.total),
    first_friday: toNum(block.firstFriday?.total),
    late: toNum(block.late?.total),
    end_of_month: toNum(block.endOfMonth?.total),
    percentage: block.percentage?.total ?? null,
    ada: block.ada?.total ?? null,
    pa: block.pa?.total ?? null,
    five_consecutive: toNum(block.fiveConsecutive?.total),
    nls: toNum(block.nls?.total),
    transferred_out: toNum(block.transferredOut?.total),
    transferred_in: toNum(block.transferredIn?.total),
    breakdown: {
      attendanceOfMonth: block.attendanceOfMonth,
      absences: block.absences,
      totalAttendance: block.totalAttendance,
      firstFriday: block.firstFriday,
      late: block.late,
      endOfMonth: block.endOfMonth,
      percentage: block.percentage,
      ada: block.ada,
      pa: block.pa,
      fiveConsecutive: block.fiveConsecutive,
      nls: block.nls,
      transferredOut: block.transferredOut,
      transferredIn: block.transferredIn,
    },
  };
}
