/**
 * Check-first Priority from RF High-class probability / confidence.
 * Does not change ARAL, Classroom Remedial, or risk labels.
 * Teacher copy: "Priority" / percent — never sklearn or per-class dumps.
 */

import { isRecommendationFallback } from "@/lib/monitoring/recommendationSource";
import { RISK_LEVEL, normalizeRiskLevel } from "@/lib/monitoring/recommendations";
import { compareLearnersBySurname } from "@/lib/ecr/gridLayout";

function toUnitInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.min(1, n / 100);
  if (n < 0) return null;
  return Math.min(1, n);
}

/** P(High Risk) from RF probability map, if present. */
export function highRiskProbability(probabilities) {
  if (!probabilities || typeof probabilities !== "object") return null;
  const keys = [
    "High Risk",
    "high risk",
    "High",
    "high",
    "high_risk",
    RISK_LEVEL.HIGH,
  ];
  for (const key of keys) {
    if (probabilities[key] == null) continue;
    const n = toUnitInterval(probabilities[key]);
    if (n !== null) return n;
  }
  return null;
}

function hasGradedRisk(learner = {}) {
  if (learner.hasClassSubjectGrade === false) return false;
  const risk = learner.riskLevel;
  if (risk === "—" || risk == null || risk === "") return false;
  const grade =
    learner.reportGrade ??
    learner.classSubjectGrade ??
    learner.grade ??
    null;
  if (grade === null || grade === undefined || grade === "" || grade === "—") {
    if (learner.hasClassSubjectGrade === true) return true;
    return false;
  }
  return true;
}

/**
 * Whether the Priority cue may appear.
 * Fallback / ungraded → false (show "—", no fake %).
 */
export function canShowPriority(learner = {}) {
  if (!hasGradedRisk(learner)) return false;
  if (isRecommendationFallback(learner.recommendationSource)) return false;
  const pHigh = highRiskProbability(learner.recommendationProbabilities);
  const confidence = toUnitInterval(learner.recommendationConfidence);
  return pHigh !== null || confidence !== null;
}

/** Sort key: larger = check sooner. Missing → -1. */
export function priorityScore(learner = {}) {
  if (!canShowPriority(learner)) return -1;
  const pHigh = highRiskProbability(learner.recommendationProbabilities);
  if (pHigh !== null) return pHigh;
  return toUnitInterval(learner.recommendationConfidence) ?? -1;
}

export function formatPriorityLabel(score) {
  if (score == null || score <= 0) return "—";
  const percent = Math.round(score * 100);
  if (percent <= 0) return "—";
  return `${percent}%`;
}

export function getPriorityCue(learner = {}) {
  if (!canShowPriority(learner)) {
    return { show: false, label: "—", hint: null, score: -1 };
  }
  const score = priorityScore(learner);
  const label = formatPriorityLabel(score);
  if (label === "—") {
    return { show: false, label: "—", hint: null, score: -1 };
  }
  return {
    show: true,
    label,
    hint: "Check first",
    score,
  };
}

function riskSortRank(learner = {}) {
  if (!hasGradedRisk(learner)) return 3;
  const risk = normalizeRiskLevel(learner.riskLevel);
  if (risk === RISK_LEVEL.HIGH) return 0;
  if (risk === RISK_LEVEL.MODERATE) return 1;
  if (risk === RISK_LEVEL.LOW) return 2;
  return 3;
}

/**
 * High Risk first, then higher P(High)/confidence, then surname.
 */
export function compareLearnersByCheckFirst(a, b) {
  const riskDiff = riskSortRank(a) - riskSortRank(b);
  if (riskDiff !== 0) return riskDiff;
  const scoreDiff = priorityScore(b) - priorityScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  return compareLearnersBySurname(
    {
      last_name: a.lastName ?? a.last_name,
      first_name: a.firstName ?? a.first_name,
      name: a.name,
    },
    {
      last_name: b.lastName ?? b.last_name,
      first_name: b.firstName ?? b.first_name,
      name: b.name,
    }
  );
}

export function sortLearnersByCheckFirst(learners = []) {
  return [...learners].sort(compareLearnersByCheckFirst);
}
