/**
 * Rule-based emergency fallback — NOT the Random Forest model.
 *
 * Risk uses official grading-scale bands on computed GWA (from subject grades).
 * GWA is NOT taken from the RF feature vector (Model B excludes it).
 */

import { RISK_LEVEL } from "@/lib/monitoring/recommendations";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";

function gradeOf(features, key) {
  const value = features.featureVector?.[key];
  return value === null || value === undefined ? null : Number(value);
}

function resolveGwaForFallback(features) {
  if (
    features.generalAverage !== null &&
    features.generalAverage !== undefined &&
    Number.isFinite(Number(features.generalAverage))
  ) {
    return Number(features.generalAverage);
  }
  // Reconstruct from subject grades only (not from RF feature list GWA key).
  const subjects = [
    "english_grade",
    "filipino_grade",
    "mathematics_grade",
    "science_grade",
    "mapeh_grade",
    "araling_panlipunan_grade",
    "tle_grade",
    "values_education_grade",
  ];
  const values = subjects
    .map((k) => gradeOf(features, k))
    .filter((n) => n !== null && Number.isFinite(n));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * @param {ReturnType<import('./features').buildFeatureVector>} features
 */
export function predictViaLocalEnsemble(features) {
  const gwa = resolveGwaForFallback(features);
  const available = Number(features.featureVector?.available_grade_count || 0);
  const riskLevel = riskLevelFromGrade(gwa);

  const reasons = [];
  if (gwa === null || available === 0) {
    reasons.push(
      "Rule-based fallback: insufficient ECR grades; defaulting risk using official bands."
    );
  } else {
    reasons.push(
      `Rule-based fallback risk from GWA ${gwa.toFixed(1)} using official grading-scale bands (ML service unavailable).`
    );
  }

  return {
    recommendationType: null,
    riskLevel: riskLevel || RISK_LEVEL.LOW,
    confidence: available === 0 ? 0.4 : 0.55,
    probabilities: null,
    reasons,
    generatedAt: new Date().toISOString(),
    source: "rule-based-fallback",
  };
}
