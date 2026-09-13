/** Official DepEd SF2 daily codes. Not used by Academic Prediction / RF. */

export const SF2_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  CUTTING: "cutting",
};

export const SF2_STATUS_LABEL = {
  present: "Present",
  absent: "Absent (x)",
  late: "Late",
  cutting: "Cutting",
};

export const SF2_SESSION = {
  MORNING: "morning",
  AFTERNOON: "afternoon",
};

export const SF2_SESSION_LABEL = {
  morning: "Morning",
  afternoon: "Afternoon",
};

export const SF2_SESSION_HINT = {
  morning: { startMinutes: 7 * 60, endMinutes: 7 * 60 + 30, label: "7:00–7:30" },
  afternoon: { startMinutes: 13 * 60, endMinutes: 13 * 60 + 30, label: "1:00–1:30" },
};

const MANILA_TZ = "Asia/Manila";

export function formatSf2LearnerName(student = {}) {
  const last = String(student.last_name ?? "").trim();
  const first = String(student.first_name ?? "").trim();
  const middle = String(student.middle_name ?? "").trim();
  const mi = middle ? ` ${middle[0]}.` : "";
  if (last && first) return `${last}, ${first}${mi}`;
  return [last, first, middle].filter(Boolean).join(" ") || "—";
}

export function sexLabel(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "m" || s === "male") return "M";
  if (s === "f" || s === "female") return "F";
  return "—";
}

export function normalizeSf2Session(value) {
  const session = String(value ?? "").trim().toLowerCase();
  if (session === SF2_SESSION.MORNING || session === SF2_SESSION.AFTERNOON) {
    return session;
  }
  return null;
}

export function monthTotalsFromMarks(marks = []) {
  const totals = { present: 0, absent: 0, late: 0, cutting: 0 };
  for (const mark of marks) {
    const key = mark.status;
    if (totals[key] != null) totals[key] += 1;
  }
  return totals;
}

export function manilaDateTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function todayIsoDateManila(now = new Date()) {
  const { year, month, day } = manilaDateTimeParts(now);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function suggestedSessionFromClock(now = new Date()) {
  const { hour, minute } = manilaDateTimeParts(now);
  return hour * 60 + minute >= 12 * 60
    ? SF2_SESSION.AFTERNOON
    : SF2_SESSION.MORNING;
}

export function sessionHintLabel(session) {
  const key = normalizeSf2Session(session);
  if (key === SF2_SESSION.AFTERNOON) {
    return "Afternoon roll call (1:00–1:30)";
  }
  return "Morning roll call (7:00–7:30)";
}

export function isWithinSuggestedWindow(session, now = new Date()) {
  const key = normalizeSf2Session(session);
  const window = key ? SF2_SESSION_HINT[key] : null;
  if (!window) return false;
  const { hour, minute } = manilaDateTimeParts(now);
  const mins = hour * 60 + minute;
  return mins >= window.startMinutes && mins <= window.endMinutes;
}

/** Hint only — never locks save. */
export function isLateSaveHint(session, now = new Date()) {
  return !isWithinSuggestedWindow(session, now);
}

export function withDraftDayMark(
  monthMarks = [],
  attendanceDate,
  session,
  status
) {
  const date = String(attendanceDate);
  const sess = normalizeSf2Session(session);
  const others = monthMarks.filter((mark) => {
    const sameDate = String(mark.attendance_date) === date;
    const sameSession = normalizeSf2Session(mark.session) === sess;
    return !(sameDate && sameSession);
  });
  return [...others, { attendance_date: date, session: sess, status }];
}

function parseDateOnly(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateOnly(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextSchoolDay(isoDate) {
  const date = parseDateOnly(isoDate);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return formatDateOnly(date);
}

function isFullDayAbsent(sessions = {}) {
  return (
    sessions[SF2_SESSION.MORNING] === SF2_STATUS.ABSENT &&
    sessions[SF2_SESSION.AFTERNOON] === SF2_STATUS.ABSENT
  );
}

/**
 * Flag learners with 5 consecutive school days where both AM and PM
 * are saved Absent. Follow-up only — not auto-drop. Does not invent
 * an unsaved session as Absent.
 */
export function learnersWithFiveConsecutiveAbsences(roster = []) {
  return roster.filter((row) => {
    const byDate = new Map();
    for (const mark of row.monthMarks ?? []) {
      const date = String(mark.attendance_date);
      const session = normalizeSf2Session(mark.session);
      if (!session) continue;
      const current = byDate.get(date) ?? {};
      current[session] = mark.status;
      byDate.set(date, current);
    }

    const fullAbsentDates = [...byDate.keys()]
      .filter((date) => isFullDayAbsent(byDate.get(date)))
      .sort((a, b) => a.localeCompare(b));

    let streak = 0;
    let previous = null;
    for (const date of fullAbsentDates) {
      if (previous && nextSchoolDay(previous) === date) {
        streak += 1;
      } else {
        streak = 1;
      }
      if (streak >= 5) return true;
      previous = date;
    }
    return false;
  });
}
