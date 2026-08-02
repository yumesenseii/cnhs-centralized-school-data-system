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
