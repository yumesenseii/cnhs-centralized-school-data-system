/**
 * Session totals from attendance_daily.
 * Not official ADA / PA / First Friday / End of month.
 * Not Academic Prediction / RF.
 */

import { MONTH_LABELS } from "@/lib/attendance/constants";
import {
  SF2_SESSION,
  SF2_STATUS,
  normalizeSf2Session,
} from "@/lib/attendance/sf2Daily";

export function sessionTotalsFromMarks(marks = []) {
  let present = 0;
  let absent = 0;
  let other = 0;
  for (const mark of marks) {
    if (mark.status === SF2_STATUS.PRESENT) present += 1;
    else if (mark.status === SF2_STATUS.ABSENT) absent += 1;
    else other += 1;
  }
  return { present, absent, other, saved: present + absent + other };
}

/** present ÷ (present + absent saved sessions). Late/Cutting excluded. */
export function sessionRatePercent(totals = {}) {
  const denom = Number(totals.present || 0) + Number(totals.absent || 0);
  if (!denom) return null;
  return Math.round((Number(totals.present || 0) / denom) * 1000) / 10;
}

export function formatSessionRate(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return "—";
  return `${Number(rate).toFixed(1)}%`;
}

/** Months that already have at least one saved AM/PM mark. */
export function monthsWithSavedSessions(trend = []) {
  return (trend ?? []).filter((row) => {
    const saved =
      Number(row.present || 0) +
      Number(row.absent || 0) +
      Number(row.other || 0);
    return saved > 0;
  });
}

export function marksByDate(marks = []) {
  const byDate = new Map();
  for (const mark of marks) {
    const date = String(mark.attendance_date);
    const session = normalizeSf2Session(mark.session);
    if (!session) continue;
    const current = byDate.get(date) ?? {};
    current[session] = mark.status;
    byDate.set(date, current);
  }
  return byDate;
}

export function otherSessionKey(session) {
  return normalizeSf2Session(session) === SF2_SESSION.AFTERNOON
    ? SF2_SESSION.MORNING
    : SF2_SESSION.AFTERNOON;
}

export function otherSessionStatus(marks = [], attendanceDate, session) {
  const other = otherSessionKey(session);
  const date = String(attendanceDate);
  for (const mark of marks) {
    if (
      String(mark.attendance_date) === date &&
      normalizeSf2Session(mark.session) === other
    ) {
      return mark.status;
    }
  }
  return null;
}

export function incompleteDatesFromMarks(marks = []) {
  const byDate = marksByDate(marks);
  return [...byDate.entries()]
    .filter(([, sessions]) => {
      const hasAm = Boolean(sessions[SF2_SESSION.MORNING]);
      const hasPm = Boolean(sessions[SF2_SESSION.AFTERNOON]);
      return hasAm !== hasPm;
    })
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Present day = AM Present AND PM Present.
 * Absent day = both sessions saved and not a present day (at least one Absent).
 * Incomplete = AM XOR PM — not present, not absent.
 */
export function classifyLearnerDay(day = {}) {
  const am = day.morning || null;
  const pm = day.afternoon || null;
  const bothSaved = Boolean(am) && Boolean(pm);
  const presentDay =
    am === SF2_STATUS.PRESENT && pm === SF2_STATUS.PRESENT;
  const absentDay = bothSaved && !presentDay;
  const incomplete = Boolean(am) !== Boolean(pm);
  return { bothSaved, presentDay, absentDay, incomplete };
}

export function learnerDayHistory(marks = []) {
  const byDate = marksByDate(marks);
  return [...byDate.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => {
      const sessions = byDate.get(date) ?? {};
      const am = sessions[SF2_SESSION.MORNING] || null;
      const pm = sessions[SF2_SESSION.AFTERNOON] || null;
      const classified = classifyLearnerDay({ morning: am, afternoon: pm });
      return {
        date,
        morning: am,
        afternoon: pm,
        ...classified,
      };
    });
}

export function countPresentAbsentDays(days = []) {
  let presentDays = 0;
  let absentDays = 0;
  for (const day of days) {
    const classified = classifyLearnerDay(day);
    if (classified.presentDay) presentDays += 1;
    else if (classified.absentDay) absentDays += 1;
  }
  return { presentDays, absentDays };
}

export function rosterSexCounts(learners = []) {
  let m = 0;
  let f = 0;
  let other = 0;
  for (const row of learners) {
    if (row.sex === "M") m += 1;
    else if (row.sex === "F") f += 1;
    else other += 1;
  }
  return { m, f, other, total: learners.length };
}

/** Mon–Fri dates in the month with no saved AM or PM. Hint only — not official school days. */
export function weekdayDatesWithNoSave({ year, month, savedDates = [] } = {}) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return [];
  const saved = new Set((savedDates ?? []).map(String));
  const last = new Date(y, m, 0).getDate();
  const out = [];
  for (let day = 1; day <= last; day += 1) {
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = new Date(`${iso}T12:00:00`).getDay();
    if (dow === 0 || dow === 6) continue;
    if (!saved.has(iso)) out.push(iso);
  }
  return out;
}

export function computeMonthCloseMetrics({
  presentDays = 0,
  schoolDays,
  eomM = 0,
  eomF = 0,
} = {}) {
  const days = Number(schoolDays);
  const eom = Number(eomM) + Number(eomF);
  const present = Number(presentDays) || 0;
  const ada = days > 0 ? Math.round((present / days) * 10) / 10 : null;
  const attendancePercent =
    eom > 0 && ada != null ? Math.round((ada / eom) * 1000) / 10 : null;
  return { ada, attendancePercent, eom };
}

export function monthNumberFromDate(isoDate) {
  return Number(String(isoDate).slice(5, 7));
}

export function monthNameFromNumber(month) {
  return MONTH_LABELS[Number(month) - 1] || "—";
}

export function summarizeLearnerMarks(marks = []) {
  const totals = sessionTotalsFromMarks(marks);
  return {
    ...totals,
    rate: sessionRatePercent(totals),
    incompleteDates: incompleteDatesFromMarks(marks),
    days: learnerDayHistory(marks),
  };
}

export function summarizeSectionLearners(roster = []) {
  const learners = roster
    .map((row) => {
      const summary = summarizeLearnerMarks(row.monthMarks ?? []);
      const dayCounts = countPresentAbsentDays(summary.days);
      return {
        ...row,
        presentSessions: summary.present,
        absentSessions: summary.absent,
        otherSessions: summary.other,
        sessionRate: summary.rate,
        incompleteDates: summary.incompleteDates,
        days: summary.days,
        presentDays: dayCounts.presentDays,
        absentDays: dayCounts.absentDays,
      };
    })
    .sort((a, b) => {
      const absCmp = b.absentSessions - a.absentSessions;
      if (absCmp !== 0) return absCmp;
      return String(a.name).localeCompare(String(b.name), "en");
    });

  const totals = learners.reduce(
    (acc, row) => {
      acc.present += row.presentSessions;
      acc.absent += row.absentSessions;
      acc.other += row.otherSessions;
      return acc;
    },
    { present: 0, absent: 0, other: 0 }
  );

  const sectionDates = new Map();
  for (const row of roster) {
    for (const mark of row.monthMarks ?? []) {
      const date = String(mark.attendance_date);
      const session = normalizeSf2Session(mark.session);
      if (!session) continue;
      const current = sectionDates.get(date) ?? {
        morning: false,
        afternoon: false,
      };
      if (session === SF2_SESSION.MORNING) current.morning = true;
      if (session === SF2_SESSION.AFTERNOON) current.afternoon = true;
      sectionDates.set(date, current);
    }
  }

  const incompleteDates = [...sectionDates.entries()]
    .filter(([, sessions]) => sessions.morning !== sessions.afternoon)
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b));

  const completeDates = [...sectionDates.entries()]
    .filter(([, sessions]) => sessions.morning && sessions.afternoon)
    .map(([date]) => date)
    .sort((a, b) => a.localeCompare(b));

  const presentDays = { m: 0, f: 0, other: 0, total: 0 };
  const absentDays = { m: 0, f: 0, other: 0, total: 0 };
  for (const row of learners) {
    const key = row.sex === "M" ? "m" : row.sex === "F" ? "f" : "other";
    presentDays[key] += row.presentDays || 0;
    presentDays.total += row.presentDays || 0;
    absentDays[key] += row.absentDays || 0;
    absentDays.total += row.absentDays || 0;
  }

  return {
    enrolled: roster.length,
    presentSessions: totals.present,
    absentSessions: totals.absent,
    otherSessions: totals.other,
    sessionRate: sessionRatePercent(totals),
    incompleteDates,
    completeDates,
    presentDays,
    absentDays,
    learners,
  };
}

export function monthTrendFromMarks(marks = []) {
  const byMonth = new Map();
  for (const mark of marks) {
    const month = monthNumberFromDate(mark.attendance_date);
    if (!month) continue;
    const list = byMonth.get(month) ?? [];
    list.push(mark);
    byMonth.set(month, list);
  }
  return [...byMonth.keys()]
    .sort((a, b) => a - b)
    .map((month) => {
      const totals = sessionTotalsFromMarks(byMonth.get(month));
      return {
        month,
        monthName: monthNameFromNumber(month),
        ...totals,
        sessionRate: sessionRatePercent(totals),
      };
    });
}

export function statusShort(status) {
  if (status === SF2_STATUS.PRESENT) return "P";
  if (status === SF2_STATUS.ABSENT) return "x";
  if (status === SF2_STATUS.LATE) return "L";
  if (status === SF2_STATUS.CUTTING) return "C";
  return "—";
}
