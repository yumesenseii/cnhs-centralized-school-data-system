/**
 * Intervention policy — separate from Random Forest risk prediction.
 *
 * RF predicts: Low / Moderate / High Risk (+ confidence).
 * This module derives the appropriate Intervention Pathway:
 *   - Pathway 1: ARAL Program (Reading/English, Filipino, Math, Science per RA 12028)
 *     * Qualification requires diagnostic assessment (e.g. Phil-IRI reading level / RMA) & school head endorsement.
 *   - Pathway 2: Classroom Remediation (Subject-specific learning area support)
 *   - None: No intervention needed (satisfactory academic performance)
 *
 * Academic Risk Level ≠ ARAL Qualification ≠ Intervention Recommendation.
 */

import {
  INTERVENTION_PATHWAY,
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
 * @returns {{ recommendationType: string, pathway: string, reasons: string[] }}
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
      pathway: INTERVENTION_PATHWAY.NONE,
      reasons: ["Academic performance is satisfactory; no intervention recommended."],
    };
  }

  // Language / Reading deficiencies (English / Filipino) → ARAL Reading candidate
  if (languageFails > 0 || failing.includes("english") || failing.includes("filipino")) {
    const eng = v.english_grade;
    const fil = v.filipino_grade;
    if (eng !== null && eng !== undefined && Number(eng) < PASSING) {
      reasons.push(`English subject grade below 75 (${eng})`);
    }
    if (fil !== null && fil !== undefined && Number(fil) < PASSING) {
      reasons.push(`Filipino subject grade below 75 (${fil})`);
    }
    if (!reasons.length) {
      reasons.push("Reading/language subject performance indicates need for academic support");
    }
    reasons.push("Candidate for ARAL (English/Filipino). Requires CRLA/Phil-IRI reading assessment and teacher endorsement.");

    return {
      recommendationType: RECOMMENDATION.ARAL,
      pathway: INTERVENTION_PATHWAY.ARAL,
      reasons,
    };
  }

  // Mathematics, Science, and other subject deficiencies → Classroom Remediation (Teacher-led)
  const mathGrade = v.mathematics_grade;
  const sciGrade = v.science_grade;
  const mathFailing = mathGrade !== null && mathGrade !== undefined && Number(mathGrade) < PASSING;
  const sciFailing = sciGrade !== null && sciGrade !== undefined && Number(sciGrade) < PASSING;

  if (mathFailing || sciFailing) {
    if (mathFailing) reasons.push(`Mathematics grade below 75 (${mathGrade})`);
    if (sciFailing) reasons.push(`Science grade below 75 (${sciGrade})`);
    reasons.push("Recommended for teacher-led Classroom Remediation for subject-specific support.");

    return {
      recommendationType: RECOMMENDATION.REMEDIATION,
      pathway: INTERVENTION_PATHWAY.REMEDIATION,
      reasons,
    };
  }

  // Non-language academic concerns (AP, TLE, MAPEH, Values Ed) or Moderate risk → Classroom Remediation
  if (
    nonLanguageFails > 0 ||
    riskLevel === RISK_LEVEL.HIGH ||
    riskLevel === RISK_LEVEL.MODERATE
  ) {
    if (nonLanguageFails > 0) {
      reasons.push(`${nonLanguageFails} subject(s) below passing threshold`);
    } else if (
      classSubjectGrade !== null &&
      classSubjectGrade < PASSING
    ) {
      reasons.push(`Subject grade below 75 (${classSubjectGrade})`);
    } else if (riskLevel === RISK_LEVEL.HIGH) {
      reasons.push("High academic risk — recommended for classroom remedial support");
    } else {
      reasons.push("Moderate academic risk — teacher review recommended");
    }

    // Moderate with no failing subjects → monitor only
    if (
      riskLevel === RISK_LEVEL.MODERATE &&
      nonLanguageFails === 0 &&
      (classSubjectGrade === null || classSubjectGrade >= PASSING)
    ) {
      return {
        recommendationType: RECOMMENDATION.NONE,
        pathway: INTERVENTION_PATHWAY.NONE,
        reasons: [
          "Moderate academic risk without failing subjects; monitor performance.",
        ],
      };
    }

    return {
      recommendationType: RECOMMENDATION.REMEDIATION,
      pathway: INTERVENTION_PATHWAY.REMEDIATION,
      reasons,
    };
  }

  return {
    recommendationType: RECOMMENDATION.NONE,
    pathway: INTERVENTION_PATHWAY.NONE,
    reasons: ["No intervention criteria matched."],
  };
}
