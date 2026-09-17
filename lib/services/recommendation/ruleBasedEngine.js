/**
 * Rule-based emergency fallback — NOT the Random Forest model.
 * Risk from official grading-scale bands on computed GWA; intervention derived later.
 */

import { RISK_LEVEL } from "@/lib/monitoring/recommendations";
import { buildFeatureVector } from "@/lib/services/recommendation/features";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";

export function ruleBasedRecommendation(student = {}) {
  const features = buildFeatureVector(student);
  const gwa = features.generalAverage;
  const riskLevel = riskLevelFromGrade(gwa);
  const available = Number(features.featureVector?.available_grade_count || 0);

  return {
    recommendationType: null,
    riskLevel: riskLevel || RISK_LEVEL.LOW,
    confidence: available === 0 ? 0.4 : 0.55,
    reasons:
      available === 0 ? ["Not enough ECR grades to score risk yet."] : [],
    generatedAt: new Date().toISOString(),
    source: "rule-based-fallback",
  };
}
