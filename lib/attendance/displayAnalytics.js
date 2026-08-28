import {
  aggregateAttendanceRecords,
  monthLabel,
} from "@/lib/attendance/constants";
import { filterAttendanceRecords } from "@/lib/attendance/groupAttendanceByGrade";

function learnerGroupKey(row) {
  return `${row.student_id}|${row.section_id}|${row.school_year}`;
}

/**
 * When viewing all months, merge monthly rows into one row per learner + section + SY.
 */
export function aggregateRecordsByLearner(records = []) {
  const groups = new Map();

  for (const row of records) {
    const key = learnerGroupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.values()].map((group) => {
    const sample = group[0];
    const metrics = aggregateAttendanceRecords(group);
    return {
      ...sample,
      id: `agg-${sample.student_id}-${sample.section_id}-${sample.school_year}`,
      present_days: metrics.present,
      absent_days: metrics.absent,
      late_days: metrics.late,
      school_days: metrics.schoolDays,
      present: metrics.present,
      absent: metrics.absent,
      late: metrics.late,
      schoolDays: metrics.schoolDays,
      attendanceRate: metrics.attendanceRate,
      absenceRate: metrics.absenceRate,
      absencePercent: metrics.absencePercent,
      status: metrics.status,
      nearThreshold: metrics.nearThreshold,
      monthsAggregated: metrics.months,
    };
  });
}

function buildTrendsFromRecords(records = []) {
  const byMonth = new Map();

  for (const row of records) {
    const key = `${row.school_year}|${row.month}`;
    const bucket = byMonth.get(key) || {
      schoolYear: row.school_year,
      month: row.month,
      monthName: monthLabel(row.month),
      present: 0,
      absent: 0,
      schoolDays: 0,
    };
    bucket.present += row.present ?? row.present_days ?? 0;
    bucket.absent += row.absent ?? row.absent_days ?? 0;
    bucket.schoolDays += row.schoolDays ?? row.school_days ?? 0;
    byMonth.set(key, bucket);
  }

  return [...byMonth.values()]
    .map((bucket) => ({
      ...bucket,
      rate:
        bucket.schoolDays > 0
          ? Math.round(((bucket.present / bucket.schoolDays) * 1000) / 10)
          : null,
    }))
    .sort((a, b) => {
      if (a.schoolYear !== b.schoolYear) {
        return String(a.schoolYear).localeCompare(String(b.schoolYear));
      }
      return a.month - b.month;
    });
}

/**
 * Normalize records for KPI cards + grade folders:
 * - optional section filter (immediate, client-side)
 * - dedupe across months when month filter is empty
 */
export function buildDisplayAnalytics(
  rawRecords = [],
  { month = "", sectionId = "" } = {}
) {
  const sectionFiltered = filterAttendanceRecords(rawRecords, { sectionId });
  const displayRecords = month
    ? sectionFiltered
    : aggregateRecordsByLearner(sectionFiltered);

  const nearThreshold = displayRecords.filter((row) => row.nearThreshold);
  const presentTotal = displayRecords.reduce(
    (sum, row) => sum + (row.present ?? 0),
    0
  );
  const absentTotal = displayRecords.reduce(
    (sum, row) => sum + (row.absent ?? 0),
    0
  );
  const schoolDaysTotal = displayRecords.reduce(
    (sum, row) => sum + (row.schoolDays ?? 0),
    0
  );
  const monthlyAttendanceRate =
    schoolDaysTotal > 0
      ? Math.round(((presentTotal / schoolDaysTotal) * 1000) / 10)
      : null;

  return {
    records: displayRecords,
    nearThresholdCount: nearThreshold.length,
    monthlyAttendanceRate,
    presentTotal,
    absentTotal,
    presentVsAbsent: [
      { name: "Present", value: presentTotal, color: "#52b788" },
      { name: "Absent", value: absentTotal, color: "#e76f51" },
    ],
    trends: buildTrendsFromRecords(sectionFiltered),
  };
}

export function uploadStatusTone(status) {
  if (status === "imported") return "success";
  if (status === "partial") return "warning";
  if (status === "failed") return "error";
  return "neutral";
}
