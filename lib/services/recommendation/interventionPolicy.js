/**
 * Intervention policy — separate from Random Forest risk prediction.
 *
 * RF predicts: Low / Moderate / High Risk (+ confidence).
 * This module decides ARAL / Classroom Remediation / None from:
 *   - predicted risk level
 *   - weak / failing subjects
 *   - subject scope (handled further in recommendationService)
 *
 * Attendance / SF2 is never used here.
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";
import { buildFeatureVector } from "@/lib/services/recommendation/features";
import { resolveGradeForRisk } from "@/lib/services/recommendation/riskFromGrade";

const PASSING = 75;

/**
 * Derive intervention recommendation after risk is known.
 *
 * @param {object} student
 * @param {string} riskLevel — from Random Forest (or rule-based fallback risk)
 * @returns {{ recommendationType: string, reasons: string[] }}
 */
export function deriveInterventionRecommendation(student = {}, riskLevel) {
  const features = buildFeatureVector(student);
  const v = features.featureVector || {};
  const failing = Array.isArray(features.failingSubjects)
    ? features.failingSubjects
    : [];
  const languageFails = Number(v.language_fail_count || 0);
  const nonLanguageFails = Number(v.non_language_fail_count || 0);
  const classSubjectGrade = resolveGradeForRisk(student);
  const reasons = [];

  // Low academic risk → no intervention by default
  if (riskLevel === RISK_LEVEL.LOW) {
    return {
      recommendationType: RECOMMENDATION.NONE,
      reasons: ["Academic risk is Low; no intervention recommended."],
    };
  }

  // Language fails → ARAL candidate (subject scope / eligibility applied later)
  if (languageFails > 0 || failing.includes("english") || failing.includes("filipino")) {
    const eng = v.english_grade;
    const fil = v.filipino_grade;
    if (eng !== null && eng !== undefined && Number(eng) < PASSING) {
      reasons.push(`English below 75 (${eng})`);
    }
    if (fil !== null && fil !== undefined && Number(fil) < PASSING) {
      reasons.push(`Filipino below 75 (${fil})`);
    }
    if (!reasons.length) {
      reasons.push("Language subject(s) below passing threshold");
    }
    return {
      recommendationType: RECOMMENDATION.ARAL,
      reasons,
    };
  }

  // Class subject failing on Eng/Fil context handled via languageFails above.
  // Non-language academic concerns → classroom remediation candidate.
  if (
    nonLanguageFails > 0 ||
    riskLevel === RISK_LEVEL.HIGH ||
    riskLevel === RISK_LEVEL.MODERATE
  ) {
    if (nonLanguageFails > 0) {
      reasons.push(`${nonLanguageFails} non-language subject(s) below 75`);
    } else if (
      classSubjectGrade !== null &&
      classSubjectGrade < PASSING
    ) {
      reasons.push(`Class subject grade below 75 (${classSubjectGrade})`);
    } else if (riskLevel === RISK_LEVEL.HIGH) {
      reasons.push("High academic risk with non-language performance concerns");
    } else {
      reasons.push("Moderate academic risk — review for classroom support");
    }

    // Moderate with no failing subjects → no student-level intervention
    if (
      riskLevel === RISK_LEVEL.MODERATE &&
      nonLanguageFails === 0 &&
      (classSubjectGrade === null || classSubjectGrade >= PASSING)
    ) {
      return {
        recommendationType: RECOMMENDATION.NONE,
        reasons: [
          "Moderate risk without failing subjects; monitor academically.",
        ],
      };
    }

    return {
      recommendationType: RECOMMENDATION.REMEDIATION,
      reasons,
    };
  }

  return {
    recommendationType: RECOMMENDATION.NONE,
    reasons: ["No intervention criteria matched."],
  };
}
