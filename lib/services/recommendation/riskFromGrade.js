/**
 * Academic risk from ECR grade bands (independent of ARAL/Remediation labels).
 *
 * <75  → High Risk (failed / did not meet)
 * 75–80 → Moderate Risk (fairly passed / narrowly met)
 * >80  → Low Risk
 * no usable class-subject grade → Low Risk (ungraded — not High)
 *
 * Recommendation (ARAL for Eng/Fil, etc.) stays separate in the engines,
 * but risk must only use the assigned class subject grade.
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";
import { getSubjectCapabilities } from "@/lib/services/recommendation/subjectCapabilities";

export const GRADE_RISK_BANDS = {
  highBelow: 75,
  moderateMax: 80,
};

/**
 * @param {number|null|undefined} grade
 * @returns {string} RISK_LEVEL value; missing grade → LOW (ungraded)
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
 * Grade used for risk: **class subject only**.
 * Never falls back to another subject's grade.
 *
 * @param {object} student — subjectGrades + classSubject / subject
 * @returns {number|null}
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
 * Apply grade-band risk onto an engine result.
 * Without a class-subject grade: Low risk and no ARAL recommendation.
 *
 * @param {object} result
 * @param {object} student
 * @returns {object}
 */
export function applyGradeBandRisk(result = {}, student = {}) {
  const grade = resolveGradeForRisk(student);
  const hasGrade = grade !== null;
  const riskLevel = riskLevelFromGrade(grade);

  const reasons = Array.isArray(result.reasons) ? [...result.reasons] : [];
  let recommendationType = result.recommendationType;

  if (!hasGrade) {
    if (recommendationType === RECOMMENDATION.ARAL) {
      recommendationType = RECOMMENDATION.NONE;
    }
    if (!reasons.some((r) => String(r).includes("No class-subject grade"))) {
      reasons.push(
        "No class-subject grade yet; risk not elevated until ECR grade is available."
      );
    }
  } else {
    const bandNote =
      riskLevel === RISK_LEVEL.HIGH
        ? `Grade ${grade} is below 75 (High Risk band)`
        : riskLevel === RISK_LEVEL.MODERATE
          ? `Grade ${grade} is in 75–80 (Moderate Risk / fairly passed band)`
          : `Grade ${grade} is above 80 (Low Risk band)`;
    if (!reasons.some((r) => String(r).includes("Risk band"))) {
      reasons.push(bandNote);
    }
  }

  return {
    ...result,
    recommendationType,
    riskLevel,
    reasons: reasons.slice(0, 5),
    hasClassSubjectGrade: hasGrade,
    classSubjectGrade: grade,
  };
}
