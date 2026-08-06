import { randomForestRecommendation } from "@/lib/services/recommendation/randomForestEngine";
import { ruleBasedRecommendation } from "@/lib/services/recommendation/ruleBasedEngine";
import {
  getSubjectCapabilities,
  isAralEligibleSubject,
} from "@/lib/services/recommendation/subjectCapabilities";
import { applyGradeBandRisk } from "@/lib/services/recommendation/riskFromGrade";
import {
  RECOMMENDATION,
} from "@/lib/monitoring/recommendations";

/**
 * Academic Prediction Module — single entry point for risk + intervention labels.
 *
 * Risk predictions are based on academic performance (ECR grades) only.
 * Attendance / SF2 is handled by the separate Attendance Monitoring module and
 * must never be passed into the Random Forest feature pipeline.
 *
 * Risk levels use grade bands (independent of ARAL label):
 *   <75 High · 75–80 Moderate · >80 Low
 * Recommendation (ARAL for Eng/Fil, etc.) comes from the RF / ensemble engines.
 *
 * Monitoring pages / mappers must call `recommendationService.generate(student)`
 * and must never contain recommendation / prediction logic themselves.
 *
 * Active engine: Random Forest (`randomForestRecommendation`).
 * Last-resort fallback: rule-based engine if RF throws unexpectedly.
 *
 * Subject scope:
 * - English / Filipino → ARAL Learners or No Recommendation.
 * - Other subjects → never ARAL; student-level Classroom Remediation suppressed
 *   (Classroom Remedial remains class-level via reports/calculations).
 */

/**
 * @typedef {object} RecommendationResult
 * @property {string} recommendationType
 * @property {string} riskLevel
 * @property {number} confidence
 * @property {string[]} reasons
 * @property {string} generatedAt
 * @property {{ aralEligible: boolean, classroomRemedialEligible: boolean, subjectKey: string }=} subjectCapabilities
 */

/**
 * Normalize whatever the monitoring layer has into a student payload
 * the engines understand.
 *
 * @param {object} student
 * @returns {object}
 */
function normalizeStudentInput(student = {}) {
  const classSubject =
    student.classSubject ??
    student.subject ??
    student.subjectName ??
    student.class_subject ??
    null;

  return {
    id: student.id ?? student.studentId ?? null,
    subjectGrades: Array.isArray(student.subjectGrades)
      ? student.subjectGrades
      : [],
    schoolYear: student.schoolYear ?? null,
    quarter: student.quarter ?? null,
    classId: student.classId ?? null,
    classSubject,
  };
}

/**
 * Strip engine-only metadata before returning to Monitoring mappers/UI.
 */
function toPublicResult(result, capabilities = null) {
  const publicResult = {
    recommendationType: result.recommendationType,
    riskLevel: result.riskLevel,
    confidence: result.confidence,
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
    generatedAt: result.generatedAt || new Date().toISOString(),
  };

  if (capabilities) {
    publicResult.subjectCapabilities = {
      aralEligible: capabilities.aralEligible,
      classroomRemedialEligible: capabilities.classroomRemedialEligible,
      subjectKey: capabilities.subjectKey,
    };
  }

  return publicResult;
}

/**
 * Enforce subject-aware student recommendation policy after the engine runs.
 *
 * @param {object} result
 * @param {string|null} classSubject
 * @returns {object}
 */
function applySubjectScope(result, classSubject) {
  if (!classSubject) {
    return {
      ...result,
      reasons: [
        ...(Array.isArray(result.reasons) ? result.reasons : []),
        "Class subject context was not provided; subject gating was skipped.",
      ],
    };
  }

  const capabilities = getSubjectCapabilities(classSubject);
  const type = result.recommendationType;
  const reasons = Array.isArray(result.reasons) ? [...result.reasons] : [];

  // Language classes: student outcomes are ARAL or None only.
  // Classroom Remedial stays class-level (not a student RF label).
  // Risk level is applied later via grade bands (not tied to recommendation).
  if (capabilities.aralEligible) {
    if (type === RECOMMENDATION.REMEDIATION) {
      return {
        ...result,
        recommendationType: RECOMMENDATION.NONE,
        reasons: [
          ...reasons,
          `Student-level Classroom Remediation is not used for ${classSubject}; use class-level Classroom Remedial instead.`,
        ],
        generatedAt: result.generatedAt || new Date().toISOString(),
      };
    }
    return result;
  }

  // Non-ARAL subjects: never ARAL; never student-level Classroom Remediation.
  if (type === RECOMMENDATION.ARAL) {
    return {
      ...result,
      recommendationType: RECOMMENDATION.NONE,
      reasons: [
        ...reasons,
        `ARAL Learners is not available for ${classSubject}; ARAL applies to English and Filipino only.`,
      ],
      generatedAt: result.generatedAt || new Date().toISOString(),
    };
  }

  if (type === RECOMMENDATION.REMEDIATION) {
    return {
      ...result,
      recommendationType: RECOMMENDATION.NONE,
      reasons: [
        ...reasons,
        `Student-level Classroom Remediation is not used for ${classSubject}; evaluate Classroom Remedial at class level.`,
      ],
      generatedAt: result.generatedAt || new Date().toISOString(),
    };
  }

  return result;
}

/**
 * Generate a standardized recommendation for a student in a class context.
 *
 * @param {object} student — include `classSubject` (or `subject`) from the assigned class
 * @param {{ preferLocal?: boolean }=} options — preferLocal skips per-row HTTP in bulk UIs
 * @returns {Promise<RecommendationResult>}
 */
export async function generate(student = {}, options = {}) {
  const payload = normalizeStudentInput(student);
  const capabilities = payload.classSubject
    ? getSubjectCapabilities(payload.classSubject)
    : null;

  let raw;
  try {
    raw = await randomForestRecommendation(payload, options);
  } catch (error) {
    console.warn(
      "[recommendation] Random Forest engine failed; falling back to rules.",
      error?.message ?? error
    );
    raw = ruleBasedRecommendation(payload);
  }

  const scoped = applySubjectScope(raw, payload.classSubject);
  const withGradeRisk = applyGradeBandRisk(scoped, payload);
  return toPublicResult(withGradeRisk, capabilities);
}

export const recommendationService = {
  generate,
  isAralEligibleSubject,
  getSubjectCapabilities,
};

export default recommendationService;
