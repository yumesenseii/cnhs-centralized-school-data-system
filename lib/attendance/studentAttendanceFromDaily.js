/**
 * Build monthly attendance_records-shaped rows from SF2 attendance_daily marks.
 * Uses official AM/PM day rules (present day = both Present; absent day = both saved and not present).
 * Does not invent marks. Not used for academic risk / RF.
 */

import {
  countPresentAbsentDays,
  learnerDayHistory,
} from "@/lib/attendance/dailyAnalytics";
import { SF2_STATUS } from "@/lib/attendance/sf2Daily";

function monthFromIsoDate(iso) {
  const m = Number(String(iso ?? "").slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null;
}

/**
 * @param {Array<{ id?: string, student_id?: string, section_id?: string, school_year?: string, attendance_date?: string, session?: string, status?: string }>} marks
 * @returns {Array<{ id: string, student_id: string|null, section_id: string|null, school_year: string, month: number, present_days: number, absent_days: number, late_days: number, school_days: number, source: "daily" }>}
 */
export function monthlyRecordsFromDailyMarks(marks = []) {
  const groups = new Map();

  for (const mark of marks) {
    const date = String(mark.attendance_date ?? "");
    const month = monthFromIsoDate(date);
    const schoolYear = String(mark.school_year ?? "").trim();
    if (!date || !month || !schoolYear) continue;

    const sectionId = mark.section_id ?? "none";
    const key = `${schoolYear}|${month}|${sectionId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        schoolYear,
        month,
        sectionId: mark.section_id ?? null,
        studentId: mark.student_id ?? null,
        marks: [],
      });
    }
    groups.get(key).marks.push(mark);
  }

  const rows = [];
  for (const group of groups.values()) {
    const history = learnerDayHistory(group.marks);
    const { presentDays, absentDays } = countPresentAbsentDays(history);
    let lateDays = 0;
    for (const mark of group.marks) {
      if (mark.status === SF2_STATUS.LATE) lateDays += 1;
    }
    const schoolDays = presentDays + absentDays;
    rows.push({
      id: `daily-${group.schoolYear}-${group.month}-${group.sectionId ?? "x"}`,
      student_id: group.studentId,
      section_id: group.sectionId,
      school_year: group.schoolYear,
      month: group.month,
      present_days: presentDays,
      absent_days: absentDays,
      late_days: lateDays,
      school_days: schoolDays,
      source: "daily",
    });
  }

  rows.sort((a, b) => {
    if (a.school_year !== b.school_year) {
      return String(b.school_year).localeCompare(String(a.school_year));
    }
    return Number(b.month) - Number(a.month);
  });

  return rows;
}

/**
 * Prefer SF2 daily-derived months; fill gaps from legacy attendance_records.
 * @param {Array} legacyRecords
 * @param {Array} dailyMarks
 */
export function mergeAttendanceSources(legacyRecords = [], dailyMarks = []) {
  const fromDaily = monthlyRecordsFromDailyMarks(dailyMarks);
  const seen = new Set(
    fromDaily.map(
      (row) => `${row.school_year}|${row.month}|${row.section_id ?? ""}`
    )
  );

  const fromLegacy = (legacyRecords ?? [])
    .filter((row) => {
      const key = `${row.school_year}|${row.month}|${row.section_id ?? ""}`;
      return !seen.has(key);
    })
    .map((row) => ({ ...row, source: "monthly" }));

  return [...fromDaily, ...fromLegacy].sort((a, b) => {
    if (a.school_year !== b.school_year) {
      return String(b.school_year).localeCompare(String(a.school_year));
    }
    return Number(b.month) - Number(a.month);
  });
}
