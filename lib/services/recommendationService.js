import {
  randomForestRecommendation,
  randomForestRecommendationBatch,
} from "@/lib/services/recommendation/randomForestEngine";
import { ruleBasedRecommendation } from "@/lib/services/recommendation/ruleBasedEngine";
import {
  getSubjectCapabilities,
  isAralEligibleSubject,
} from "@/lib/services/recommendation/subjectCapabilities";
import { applyInterventionEligibility } from "@/lib/services/recommendation/riskFromGrade";
import { deriveInterventionRecommendation } from "@/lib/services/recommendation/interventionPolicy";
import { RECOMMENDATION } from "@/lib/monitoring/recommendations";

/**
 * Academic Prediction Module — single entry point for risk + intervention.
 *
 * Flow:
 *   ECR grades → feature vector → trained Random Forest → risk level
 *   → separate intervention policy (ARAL / remediation / none)
 *
 * Attendance / SF2 is never used for academic risk.
 *
 * Production risk is owned by the trained RF (FastAPI). Rule-based engines
 * are emergency fallback only and must be labeled as such.
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

function toPublicResult(result, capabilities = null, payload = null) {
  const officialRisk =
    result.officialRiskLevel ||
    (result.classSubjectGrade !== null && result.classSubjectGrade !== undefined
      ? (Number(result.classSubjectGrade) < 75
          ? "High Risk"
          : Number(result.classSubjectGrade) <= 84
          ? "Moderate Risk"
          : "Low Risk")
      : result.riskLevel || "Low Risk");

  const publicResult = {
    recommendationType: result.recommendationType,
    riskLevel: result.riskLevel,
    officialRiskLevel: officialRisk,
    rfPredictedRisk: result.riskLevel,
    confidence: result.confidence,
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
    generatedAt: result.generatedAt || new Date().toISOString(),
    source: result.source || "random-forest",
    rfAnalysis: {
      predictedRisk: result.riskLevel,
      confidence: result.confidence,
      probabilities: result.probabilities || null,
      source: result.source || "random-forest",
      earlyWarningIndicator:
        result.riskLevel === "High Risk" ||
        (result.probabilities?.["High Risk"] ?? 0) >= 0.4,
    },
  };

  if (result.probabilities) {
    publicResult.probabilities = result.probabilities;
  }

  if (capabilities) {
    publicResult.subjectCapabilities = {
      aralEligible: capabilities.aralEligible,
      classroomRemedialEligible: capabilities.classroomRemedialEligible,
      subjectKey: capabilities.subjectKey,
    };
  }

  return publicResult;
}

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
 * Combine RF risk + intervention policy into a full result.
 */
function composeRecommendation(payload, riskResult) {
  const intervention = deriveInterventionRecommendation(
    payload,
    riskResult.riskLevel
  );

  const combined = {
    ...riskResult,
    recommendationType: intervention.recommendationType,
    reasons: [
      ...(Array.isArray(riskResult.reasons) ? riskResult.reasons : []),
      ...(Array.isArray(intervention.reasons) ? intervention.reasons : []),
    ].slice(0, 6),
  };

  const scoped = applySubjectScope(combined, payload.classSubject);
  return applyInterventionEligibility(scoped, payload);
}

/**
 * @param {object} student
 * @param {{ preferLocal?: boolean, forceRuleFallback?: boolean }=} options
 */
export async function generate(student = {}, options = {}) {
  const payload = normalizeStudentInput(student);
  const capabilities = payload.classSubject
    ? getSubjectCapabilities(payload.classSubject)
    : null;

  let riskResult;
  try {
    riskResult = await randomForestRecommendation(payload, options);
  } catch (error) {
    console.warn(
      "[recommendation] Random Forest engine failed; using rule-based fallback.",
      error?.message ?? error
    );
    const fallback = ruleBasedRecommendation(payload);
    riskResult = {
      ...fallback,
      source: "rule-based-fallback",
    };
  }

  const composed = composeRecommendation(payload, riskResult);
  return toPublicResult(composed, capabilities);
}

/**
 * Bulk generate for monitoring dashboards (uses /predict_batch).
 */
export async function generateBatch(students = [], options = {}) {
  const payloads = students.map(normalizeStudentInput);
  let riskResults;
  try {
    riskResults = await randomForestRecommendationBatch(payloads);
  } catch (error) {
    console.warn(
      "[recommendation] Batch RF failed; using rule-based fallback.",
      error?.message ?? error
    );
    riskResults = payloads.map((payload) => ({
      ...ruleBasedRecommendation(payload),
      source: "rule-based-fallback",
    }));
  }

  return payloads.map((payload, index) => {
    const capabilities = payload.classSubject
      ? getSubjectCapabilities(payload.classSubject)
      : null;
    const riskResult = riskResults[index] ?? {
      riskLevel: "Low Risk",
      confidence: 0.4,
      reasons: ["Missing batch prediction row"],
      source: "rule-based-fallback",
      generatedAt: new Date().toISOString(),
    };
    return toPublicResult(
      composeRecommendation(payload, riskResult),
      capabilities
    );
  });
}

export const recommendationService = {
  generate,
  generateBatch,
  isAralEligibleSubject,
  getSubjectCapabilities,
};

export default recommendationService;
