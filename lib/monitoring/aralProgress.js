/**
 * ARAL Learners helpers.
 *
 * Identification (Eng/Fil → ARAL Learners) stays with subject teachers.
 * Weekly Summer ARAL Program progress is submitted only by assigned facilitators.
 */

import {
  RECOMMENDATION,
  normalizeRecommendationType,
} from "@/lib/monitoring/recommendations";

export const ARAL_WEEKLY_INTERVENTION = "ARAL Learners Weekly Session";

export const ARAL_PROGRESS_OPTIONS = [
  "No Improvement",
  "Minimal Improvement",
  "Improving",
  "Significant Improvement",
];

/** ARAL session mark only. Not official SF2. Never an RF / Academic Prediction input. */
export const ARAL_SESSION_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  EXCUSED: "excused",
};

export const ARAL_SESSION_LABELS = {
  present: "Present",
  absent: "Absent",
  excused: "Excused",
};

export const ARAL_SESSION_OPTIONS = [
  ARAL_SESSION_STATUS.PRESENT,
  ARAL_SESSION_STATUS.ABSENT,
  ARAL_SESSION_STATUS.EXCUSED,
];

export const ARAL_FOCUS_OPTIONS = [
  "Reading",
  "Writing",
  "Grammar",
  "Comprehension",
];

export const ARAL_REMARKS_MAX = 200;
export const ARAL_REMARKS_PLACEHOLDER =
  "Focus: reading fluency. Next: short oral reading.";

/** In-app weekly grid weeks (Summer ARAL). */
export const ARAL_WEEK_MAX = 6;
export const ARAL_WEEK_OPTIONS = [1, 2, 3, 4, 5, 6];

/**
 * Roster display: Last, First M.
 * Uses stored name parts only — does not invent a last name from a single string.
 */
export function formatAralRosterName(learner = {}) {
  const last = String(learner.lastName ?? learner.last_name ?? "").trim();
  const first = String(learner.firstName ?? learner.first_name ?? "").trim();
  const middle = String(learner.middleName ?? learner.middle_name ?? "").trim();
  const mi = middle ? ` ${middle[0]}.` : "";
  if (last && first) return `${last}, ${first}${mi}`;
  return String(learner.studentName ?? "").trim() || "—";
}

/** Session / observation date in Asia/Manila. Not an SF2 school day. */
export function aralObservationDateToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseAralProgress(value) {
  const s = String(value ?? "").trim();
  if (!s || s === "—") return null;
  return (
    ARAL_PROGRESS_OPTIONS.find((option) => option.toLowerCase() === s.toLowerCase()) ||
    null
  );
}

export function parseAralSessionStatus(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s || s === "—" || s === "not started") return null;
  if (s === "x") return ARAL_SESSION_STATUS.ABSENT;
  if (s.startsWith("present")) return ARAL_SESSION_STATUS.PRESENT;
  if (s.startsWith("absent")) return ARAL_SESSION_STATUS.ABSENT;
  if (s.startsWith("excused")) return ARAL_SESSION_STATUS.EXCUSED;
  return null;
}

export function parseAralFocus(value) {
  const s = String(value ?? "").trim();
  if (!s || s === "—") return null;
  return (
    ARAL_FOCUS_OPTIONS.find((option) => option.toLowerCase() === s.toLowerCase()) ||
    null
  );
}

export function clipAralRemarks(value) {
  return String(value ?? "").trim().slice(0, ARAL_REMARKS_MAX);
}

export function stripAralWeekPrefix(remarks = "") {
  return String(remarks || "")
    .replace(/^\[Week\s+\d+\]\s*/i, "")
    .trim();
}

export function resolveStoredWeekNumber(record = {}) {
  const stored = Number(record.week_number ?? record.weekNumber);
  if (Number.isFinite(stored) && stored >= 1) return stored;
  const match = String(record.teacher_remarks ?? record.teacherRemarks ?? "").match(
    /^\[Week\s+(\d+)\]/i
  );
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/**
 * Count structured weekly progress bands (not free-text essays).
 * Uses the latest week per learner when multiple weeks exist.
 */
export function countAralWeeklyProgressBands(records = []) {
  const counts = Object.fromEntries(ARAL_PROGRESS_OPTIONS.map((key) => [key, 0]));
  const latestByLearner = new Map();

  for (const record of records) {
    const studentId = record.student_id ?? record.studentId;
    if (!studentId) continue;
    const week = resolveStoredWeekNumber(record) ?? 0;
    const prev = latestByLearner.get(studentId);
    if (!prev || week >= (prev.week ?? 0)) {
      latestByLearner.set(studentId, { week, record });
    }
  }

  for (const { record } of latestByLearner.values()) {
    const band = parseAralProgress(
      record.student_progress ?? record.studentProgress
    );
    if (band) counts[band] += 1;
  }

  return {
    counts,
    filled: latestByLearner.size,
    bands: ARAL_PROGRESS_OPTIONS.map((label) => ({
      label,
      count: counts[label],
    })),
  };
}

/** Grades-based ARAL identification (English / Filipino). */
export function isAralRecommended(learner = {}) {
  const type = normalizeRecommendationType(
    learner.recommendationDisplay ?? learner.recommendation
  );
  if (type !== RECOMMENDATION.ARAL) return false;
  if (learner.aralEligible === false) return false;
  return true;
}

/**
 * Learner appears in Summer ARAL Program lists when recommended
 * and/or already assigned a facilitator.
 */
export function isAralProgramLearner(learner = {}) {
  return (
    isAralRecommended(learner) || Boolean(learner.aralFacilitatorAssigned)
  );
}

/**
 * Weekly ARAL form is for Summer Program facilitators only — not every
 * subject teacher who identified the learner.
 */
export function canSubmitAralWeeklyProgress(learner = {}, options = {}) {
  if (options.isFacilitator === true) return true;
  if (learner.isAralFacilitator === true) return true;
  if (learner.aralFacilitatorTeacherId && options.teacherId) {
    return learner.aralFacilitatorTeacherId === options.teacherId;
  }
  return false;
}

/**
 * Assign Week 1..N by chronological observation date (oldest first).
 * @param {Array<{ id: string, observationDateRaw?: string, observationDate?: string }>} records
 */
export function withWeekNumbers(records = []) {
  const sorted = [...records].sort((a, b) => {
    const da = a.observationDateRaw || a.observationDate || "";
    const db = b.observationDateRaw || b.observationDate || "";
    return String(da).localeCompare(String(db));
  });
  const weekById = new Map();
  sorted.forEach((row, index) => {
    weekById.set(row.id, index + 1);
  });
  return records.map((row) => ({
    ...row,
    weekNumber: weekById.get(row.id) ?? null,
    weekLabel: weekById.has(row.id) ? `Week ${weekById.get(row.id)}` : "—",
  }));
}

export function nextAralWeekNumber(records = []) {
  return records.length + 1;
}

/**
 * Ensure weekly ARAL remarks carry a Week N marker for admin readability.
 */
export function formatAralWeeklyRemarks(weekNumber, remarks = "") {
  const body = String(remarks || "").trim();
  const prefix = `[Week ${weekNumber}]`;
  if (!body) return prefix;
  if (body.startsWith("[Week ")) return body;
  return `${prefix} ${body}`;
}
