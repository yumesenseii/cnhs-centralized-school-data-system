/**
 * Shared recommendation / monitoring label constants.
 *
 * Display layers may import these for badges and filters.
 * Recommendation *logic* must go through `lib/services/recommendationService.js`.
 *
 * Risk predictions are based on academic performance (ECR grades) only.
 * Attendance is a separate monitoring module and is never a prediction input.
 */

export const RECOMMENDATION = {
  NONE: "No Recommendation",
  /** Display label for ARAL-recommended learners (UI terminology). */
  ARAL: "ARAL Learners",
  REMEDIATION: "Classroom Remediation",
};

/** Legacy display strings still accepted in style maps / remote payloads. */
export const RECOMMENDATION_ARAL_ALIASES = [
  "ARAL Learners",
  "ARAL Screening",
  "Recommended for ARAL Screening",
  "Recommended for ARAL Learners",
  "Potential ARAL Screening",
  "Potential ARAL Learners",
];

export function normalizeRecommendationType(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return RECOMMENDATION.NONE;
  if (raw === RECOMMENDATION.ARAL || raw === RECOMMENDATION.REMEDIATION || raw === RECOMMENDATION.NONE) {
    return raw;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("aral")) return RECOMMENDATION.ARAL;
  if (lower.includes("remed")) return RECOMMENDATION.REMEDIATION;
  if (lower.includes("no recommendation") || lower === "none") return RECOMMENDATION.NONE;
  return raw;
}

/** Academic risk labels (grades-only). Official ML bands: <75 High, 75–84 Moderate, 85–100 Low. */
export const RISK_LEVEL = {
  HIGH: "High Risk",
  MODERATE: "Moderate Risk",
  LOW: "Low Risk",
};

/** @deprecated Use RISK_LEVEL.HIGH — kept for transitional imports. */
RISK_LEVEL.PRIORITY = RISK_LEVEL.HIGH;

export const MONITORING_STATUS = {
  NOT_STARTED: "Not Started",
  ONGOING: "Ongoing",
  IMPROVED: "Improved",
  NEEDS_FOLLOW_UP: "Needs Follow-up",
  COMPLETED: "Completed",
  NEEDS_FURTHER_SUPPORT: "Needs Further Support",
  FOR_FURTHER_MONITORING: "For Further Monitoring",
};

export function recommendationKeyFromType(recommendationType) {
  if (recommendationType === RECOMMENDATION.ARAL) return "aral";
  if (recommendationType === RECOMMENDATION.REMEDIATION) return "remediation";
  return "none";
}

export function isAtRisk(recommendationType) {
  return (
    recommendationType === RECOMMENDATION.ARAL ||
    recommendationType === RECOMMENDATION.REMEDIATION
  );
}

/**
 * Normalize legacy or remote risk strings to current RISK_LEVEL values.
 */
export function normalizeRiskLevel(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return RISK_LEVEL.LOW;
  if (raw.includes("high") || raw === "priority") return RISK_LEVEL.HIGH;
  if (raw.includes("moderate") || raw === "medium") return RISK_LEVEL.MODERATE;
  if (raw.includes("low")) return RISK_LEVEL.LOW;
  if (value === RISK_LEVEL.HIGH || value === RISK_LEVEL.MODERATE || value === RISK_LEVEL.LOW) {
    return value;
  }
  return RISK_LEVEL.LOW;
}

/**
 * Pure display helper — average of available numeric grades.
 * Not recommendation logic; used by Monitoring mappers for GWA display.
 */
export function averageFromSubjectGrades(subjectGrades = []) {
  const grades = [];
  for (const row of subjectGrades) {
    const value = row.finalGrade ?? row.grade ?? row.final_grade;
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) grades.push(n);
  }
  if (!grades.length) return null;
  return Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 10) / 10;
}

/**
 * Pure display helper — subjects with grade below 75.
 */
export function weakSubjectsFromGrades(subjectGrades = []) {
  const weak = [];
  for (const row of subjectGrades) {
    const subject = row.subjectName ?? row.subject ?? "Subject";
    const value = row.finalGrade ?? row.grade ?? row.final_grade;
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n) && n < 75) weak.push(subject);
  }
  return weak;
}
