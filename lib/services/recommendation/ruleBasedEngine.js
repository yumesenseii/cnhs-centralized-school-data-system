/**
 * Authoritative Rule-Based Academic Risk Engine.
 *
 * Computes official operational academic risk and risk-based support recommendations
 * based on finalized ECR grades.
 */

import { evaluateAcademicSupport } from "@/lib/services/recommendation/academicSupportEngine";

export function ruleBasedRecommendation(student = {}) {
  const support = evaluateAcademicSupport(student);

  return {
    recommendationType: null,
    riskLevel:
      support.currentAcademicRisk === "Pending"
        ? "Pending"
        : support.currentAcademicRisk,
    officialRiskLevel: support.officialRiskLevel,
    currentAcademicRisk: support.currentAcademicRisk,
    gwa: support.gwa,
    weakSubjects: support.weakSubjects,
    reinforcementSubjects: support.reinforcementSubjects,
    identifiedAcademicNeeds: support.identifiedAcademicNeeds,
    recommendedSupportLevel: support.recommendedSupportLevel,
    suggestedAcademicActivities: support.suggestedAcademicActivities,
    suggestedMonitoringIndicators: support.suggestedMonitoringIndicators,
    confidence: support.confidence ?? 0.5,
    reasons: support.recommendationReason ? [support.recommendationReason] : [],
    generatedAt: support.generatedAt,
    source: "authoritative-rule-based",
    academicSupport: support,
  };
}

export default ruleBasedRecommendation;
