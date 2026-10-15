/**
 * Attendance Monitoring Module — thresholds and status labels.
 * Independent from Academic Prediction (ECR grades / Random Forest).
 */

/** DepEd-aligned absence threshold (20% of school days). */
export const ABSENCE_THRESHOLD = 0.2;

/** Warn when absence rate reaches 75% of the critical threshold (15%). */
export const ABSENCE_WARNING_RATIO = 0.75;

export const ATTENDANCE_STATUS = {
  NORMAL: "Normal",
  WARNING: "Warning",
  CRITICAL: "Critical",
  UNKNOWN: "No data",
};

export const MONTH_LABELS = [
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

export function monthLabel(month) {
  const n = Number(month);
  if (!Number.isFinite(n) || n < 1 || n > 12) return "—";
  return MONTH_LABELS[n - 1];
}

/**
 * Derive the official DepEd academic calendar months dynamically for any school year.
 * Standard DepEd Junior High School calendar spans September (start year) through April (end year).
 */
export function deriveSchoolYearAttendanceMonths(schoolYear) {
  const match = String(schoolYear || "").match(/(\d{4})\s*[-–]\s*(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : new Date().getFullYear();
  const endYear = match ? parseInt(match[2], 10) : startYear + 1;

  const sequence = [
    { name: "September", num: 9, year: startYear },
    { name: "October", num: 10, year: startYear },
    { name: "November", num: 11, year: startYear },
    { name: "December", num: 12, year: startYear },
    { name: "January", num: 1, year: endYear },
    { name: "February", num: 2, year: endYear },
    { name: "March", num: 3, year: endYear },
    { name: "April", num: 4, year: endYear },
  ];

  return sequence.map((s) => ({
    month: `${s.name} ${s.year}`,
    monthNum: s.num,
    year: s.year,
    isRecorded: false,
  }));
}

/**
 * @param {{ present_days?: number, absent_days?: number, late_days?: number, school_days?: number }} record
 */
export function computeAttendanceMetrics(record = {}) {
  const present = Math.max(0, Number(record.present_days) || 0);
  const absent = Math.max(0, Number(record.absent_days) || 0);
  const late = Math.max(0, Number(record.late_days) || 0);
  let schoolDays = Math.max(0, Number(record.school_days) || 0);
  if (schoolDays <= 0) {
    schoolDays = present + absent;
  }

  const attendanceRate =
    schoolDays > 0 ? Math.round(((present / schoolDays) * 1000) / 10) : null;
  const absenceRate = schoolDays > 0 ? absent / schoolDays : null;

  let status = ATTENDANCE_STATUS.UNKNOWN;
  if (absenceRate !== null) {
    if (absenceRate >= ABSENCE_THRESHOLD) status = ATTENDANCE_STATUS.CRITICAL;
    else if (absenceRate >= ABSENCE_THRESHOLD * ABSENCE_WARNING_RATIO) {
      status = ATTENDANCE_STATUS.WARNING;
    } else status = ATTENDANCE_STATUS.NORMAL;
  }

  return {
    present,
    absent,
    late,
    schoolDays,
    attendanceRate,
    absenceRate,
    absencePercent:
      absenceRate === null ? null : Math.round(absenceRate * 1000) / 10,
    status,
    nearThreshold:
      status === ATTENDANCE_STATUS.WARNING ||
      status === ATTENDANCE_STATUS.CRITICAL,
  };
}

/**
 * Aggregate multiple monthly records for a student.
 */
export function aggregateAttendanceRecords(records = []) {
  if (!records.length) {
    return {
      present: 0,
      absent: 0,
      late: 0,
      schoolDays: 0,
      attendanceRate: null,
      absenceRate: null,
      absencePercent: null,
      status: ATTENDANCE_STATUS.UNKNOWN,
      nearThreshold: false,
      months: 0,
    };
  }

  const totals = records.reduce(
    (acc, row) => {
      acc.present += Number(row.present_days) || 0;
      acc.absent += Number(row.absent_days) || 0;
      acc.late += Number(row.late_days) || 0;
      const sd = Number(row.school_days) || 0;
      acc.schoolDays +=
        sd > 0
          ? sd
          : (Number(row.present_days) || 0) + (Number(row.absent_days) || 0);
      return acc;
    },
    { present: 0, absent: 0, late: 0, schoolDays: 0 }
  );

  return {
    ...computeAttendanceMetrics({
      present_days: totals.present,
      absent_days: totals.absent,
      late_days: totals.late,
      school_days: totals.schoolDays,
    }),
    months: records.length,
  };
}
