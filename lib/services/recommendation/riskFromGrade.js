/**
 * Official DepEd grading scale → academic risk labels.
 *
 * Official scale (documented basis — not arbitrary thresholds):
 *   90–100 Outstanding              → Low Risk
 *   85–89  Very Satisfactory        → Low Risk
 *   80–84  Satisfactory             → Moderate Risk
 *   75–79  Fairly Satisfactory      → Moderate Risk
 *   <75    Did Not Meet Expectations → High Risk
 *
 * Final 3-class mapping used for RF training labels and grade helpers:
 *   85–100 → Low Risk
 *   75–84  → Moderate Risk
 *   <75    → High Risk
 *
 * Production risk prediction is owned by the trained Random Forest.
 * These helpers are for:
 *   - documenting / creating training labels
 *   - UI grade-band summaries
 *   - emergency rule-based fallback risk when ML is unavailable
 *   - ARAL eligibility (passing threshold 75) — NOT for overwriting RF risk
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";
import { getSubjectCapabilities } from "@/lib/services/recommendation/subjectCapabilities";

/** Configurable official ML risk bands (GWA / grade → 3-class). */
export const GRADE_RISK_BANDS = {
  /** Grades strictly below this → High Risk */
  highBelow: 75,
  /** Inclusive upper bound of Moderate Risk (75–84) */
  moderateMax: 84,
  /** Grades at or above this → Low Risk (85–100) */
  lowMin: 85,
  /** ARAL / failing threshold (unchanged) */
  passingGrade: 75,
};

export const OFFICIAL_GRADING_SCALE = [
  { min: 90, max: 100, descriptor: "Outstanding", risk: RISK_LEVEL.LOW },
  { min: 85, max: 89, descriptor: "Very Satisfactory", risk: RISK_LEVEL.LOW },
  { min: 80, max: 84, descriptor: "Satisfactory", risk: RISK_LEVEL.MODERATE },
  {
    min: 75,
    max: 79,
    descriptor: "Fairly Satisfactory",
    risk: RISK_LEVEL.MODERATE,
  },
  {
    min: 0,
    max: 74,
    descriptor: "Did Not Meet Expectations",
    risk: RISK_LEVEL.HIGH,
  },
];

/**
 * Map a numeric grade (typically GWA) to official 3-class risk.
 * Missing grade → Low Risk (ungraded — not elevated).
 */
export function riskLevelFromGrade(grade) {
  const n = Number(grade);
  if (!Number.isFinite(n)) return RISK_LEVEL.LOW;
  if (n < GRADE_RISK_BANDS.highBelow) return RISK_LEVEL.HIGH;
  if (n <= GRADE_RISK_BANDS.moderateMax) return RISK_LEVEL.MODERATE;
  return RISK_LEVEL.LOW;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSubjectKey(name = "") {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function subjectsMatch(a, b) {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Grade used for ARAL eligibility: **class subject only**.
 */
export function resolveGradeForRisk(student = {}) {
  const rows = Array.isArray(student.subjectGrades)
    ? student.subjectGrades
    : [];
  const classSubject = student.classSubject ?? student.subject ?? null;
  if (!classSubject) return null;

  const key = getSubjectCapabilities(classSubject).subjectKey;
  if (!key) return null;

  for (const row of rows) {
    const subject = normalizeSubjectKey(row.subjectName ?? row.subject ?? "");
    if (!subjectsMatch(subject, key)) continue;
    const grade = toNumber(
      row.finalGrade ?? row.grade ?? row.final_grade ?? row.termGrade
    );
    if (grade !== null) return grade;
  }

  return null;
}

/**
 * Apply ARAL eligibility / intervention gating.
 *
 * Product rules:
 * - Ungraded (no class-subject grade) → Low Risk (never High/Moderate)
 * - ARAL Learners (Eng/Fil) only when class-subject grade is below 75
 *
 * @param {object} result — must already include engine riskLevel
 * @param {object} student
 * @returns {object}
 */
export function applyInterventionEligibility(result = {}, student = {}) {
  const grade = resolveGradeForRisk(student);
  const hasGrade = grade !== null;
  const passingGrade = GRADE_RISK_BANDS.passingGrade;

  const reasons = Array.isArray(result.reasons) ? [...result.reasons] : [];
  let recommendationType = result.recommendationType;
  let riskLevel = result.riskLevel;

  if (!hasGrade) {
    riskLevel = RISK_LEVEL.LOW;
    if (recommendationType === RECOMMENDATION.ARAL) {
      recommendationType = RECOMMENDATION.NONE;
    }
    if (!reasons.some((r) => String(r).includes("No class-subject grade"))) {
      reasons.push(
        "No class-subject grade yet; risk stays Low and ARAL is deferred until ECR grade is available."
      );
    }
  } else if (
    recommendationType === RECOMMENDATION.ARAL &&
    grade >= passingGrade
  ) {
    recommendationType = RECOMMENDATION.NONE;
    reasons.push(
      `ARAL Learners requires a class-subject grade below ${passingGrade}; grade ${grade} meets the passing threshold.`
    );
  }

  return {
    ...result,
    recommendationType,
    riskLevel,
    reasons: reasons.slice(0, 6),
    hasClassSubjectGrade: hasGrade,
    classSubjectGrade: grade,
  };
}

/**
 * @deprecated Use applyInterventionEligibility — kept for transitional imports.
 */
export function applyGradeBandRisk(result = {}, student = {}) {
  return applyInterventionEligibility(result, student);
}
