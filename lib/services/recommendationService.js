import {
  randomForestRecommendation,
  randomForestRecommendationBatch,
} from "@/lib/services/recommendation/randomForestEngine";
import { ruleBasedRecommendation } from "@/lib/services/recommendation/ruleBasedEngine";
import { evaluateAcademicSupport } from "@/lib/services/recommendation/academicSupportEngine";
import {
  getSubjectCapabilities,
  isAralEligibleSubject,
} from "@/lib/services/recommendation/subjectCapabilities";
import { applyInterventionEligibility } from "@/lib/services/recommendation/riskFromGrade";
import { deriveInterventionRecommendation } from "@/lib/services/recommendation/interventionPolicy";
import { RECOMMENDATION } from "@/lib/monitoring/recommendations";

/**
 * Academic Prediction & Support Module — unified entry point for risk + intervention.
 *
 * Architecture (Phase 2):
 * - Current operational academic risk is authoritatively determined by the
 *   deterministic Rule-Based Engine using finalized ECR grades and DepEd thresholds.
 * - Random Forest provides longitudinal forecasting (Phase 5) and pattern analysis
 *   as supplementary decision-support, and does NOT override current operational risk.
 * - Risk-based academic support recommendations identify subject-level needs
 *   and structured activities for PLP generation (Phase 4).
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
    requiredSubjects:
      student.requiredSubjects ??
      student.curriculumSubjects ??
      student.sectionSubjects ??
      null,
    isCompleteTerm: student.isCompleteTerm ?? undefined,
    gwa: student.gwa ?? undefined,
    requireVerifiedConfig: student.requireVerifiedConfig ?? undefined,
  };
}

function toPublicResult(result, capabilities = null, payload = null, ruleResult = null, rfResult = null) {
  const authoritativeRisk =
    ruleResult?.currentAcademicRisk ||
    result.officialRiskLevel ||
    result.riskLevel ||
    "Pending";

  const officialRisk =
    authoritativeRisk === "Pending" ? "—" : authoritativeRisk;

  // Derive rfAnalysis strictly from RF engine output (never masquerade rule result)
  let rfAnalysis = null;
  const disclaimerText =
    "Random Forest provides experimental same-term pattern analysis for decision support and does not represent a validated next-term forecast or supersede official DepEd assessment rules.";

  if (rfResult && rfResult.status === "pending_evidence") {
    rfAnalysis = {
      status: "pending_evidence",
      predictedRisk: "—",
      confidence: null,
      probabilities: null,
      source: "pattern-analysis-experimental",
      modelDescription: "Pattern Analysis (Same-Term Model / Experimental)",
      disclaimer: disclaimerText,
      message:
        rfResult.message ||
        "Academic record is provisional or incomplete; pattern analysis requires verified, finalized quarterly grades across all required subjects.",
      earlyWarningIndicator: false,
    };
  } else if (
    rfResult &&
    (rfResult.status === "available" ||
      rfResult.source === "random-forest" ||
      (rfResult.probabilities && rfResult.source !== "rule-based-fallback"))
  ) {
    rfAnalysis = {
      status: "available",
      predictedRisk: rfResult.riskLevel,
      confidence: rfResult.confidence ?? null,
      probabilities: rfResult.probabilities || null,
      source: "pattern-analysis-experimental",
      modelDescription: "Pattern Analysis (Same-Term Model / Experimental)",
      disclaimer: disclaimerText,
      earlyWarningIndicator:
        rfResult.riskLevel === "High Risk" ||
        (rfResult.probabilities?.["High Risk"] ?? 0) >= 0.4,
    };
  } else {
    // ML service unavailable or offline fallback: never present fallback as an RF prediction
    rfAnalysis = {
      status: "unavailable",
      predictedRisk: "—",
      confidence: null,
      probabilities: null,
      source: "pattern-analysis-experimental",
      modelDescription: "Pattern Analysis (Same-Term Model / Experimental)",
      disclaimer: disclaimerText,
      message:
        "Random Forest ML prediction service is currently unavailable. Academic monitoring is operating on authoritative rule-based evaluation.",
      earlyWarningIndicator: false,
    };
  }

  const publicResult = {
    recommendationType: result.recommendationType,
    riskLevel: officialRisk === "—" ? "Pending" : officialRisk,
    officialRiskLevel: officialRisk,
    currentAcademicRisk: authoritativeRisk,
    rfPredictedRisk: rfAnalysis.predictedRisk,
    confidence: rfAnalysis.confidence,
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
    generatedAt: result.generatedAt || new Date().toISOString(),
    source: "authoritative-rule-based",
    academicSupport: ruleResult?.academicSupport || null,
    recommendedSupportLevel: ruleResult?.recommendedSupportLevel || null,
    weakSubjects: ruleResult?.weakSubjects || [],
    reinforcementSubjects: ruleResult?.reinforcementSubjects || [],
    identifiedAcademicNeeds: ruleResult?.identifiedAcademicNeeds || [],
    suggestedAcademicActivities: ruleResult?.suggestedAcademicActivities || [],
    suggestedMonitoringIndicators:
      ruleResult?.suggestedMonitoringIndicators || [],
    rfAnalysis,
  };

  if (rfAnalysis.probabilities) {
    publicResult.probabilities = rfAnalysis.probabilities;
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
 * Combine risk + intervention policy into a full result.
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

  // Authoritative rule-based operational risk & academic support
  const ruleResult = ruleBasedRecommendation(payload);

  let rfResult = null;
  const isComplete = ruleResult.academicSupport?.isCompleteTerm === true;

  if (!isComplete) {
    rfResult = {
      status: "pending_evidence",
      riskLevel: "—",
      confidence: null,
      probabilities: null,
      source: "pattern-analysis-experimental",
      message:
        ruleResult.academicSupport?.completenessLimitation ||
        "Academic record is provisional or incomplete; pattern analysis requires verified, finalized quarterly grades across all required subjects.",
    };
  } else {
    try {
      rfResult = await randomForestRecommendation(payload, options);
    } catch (error) {
      rfResult = null;
    }
  }

  // Operational intervention derived strictly from authoritative ruleResult
  const composed = composeRecommendation(payload, ruleResult);
  return toPublicResult(composed, capabilities, payload, ruleResult, rfResult);
}

/**
 * Bulk generate for monitoring dashboards.
 */
export async function generateBatch(students = [], options = {}) {
  const payloads = students.map(normalizeStudentInput);
  const ruleResults = payloads.map((payload) => ruleBasedRecommendation(payload));

  // Dynamic curriculum completeness validation
  const completePayloads = [];
  const completeIndices = [];
  const rfResults = new Array(payloads.length).fill(null);

  payloads.forEach((payload, index) => {
    if (ruleResults[index].academicSupport?.isCompleteTerm === true) {
      completePayloads.push(payload);
      completeIndices.push(index);
    } else {
      rfResults[index] = {
        status: "pending_evidence",
        riskLevel: "—",
        confidence: null,
        probabilities: null,
        source: "pattern-analysis-experimental",
        message:
          ruleResults[index].academicSupport?.completenessLimitation ||
          "Academic record is provisional or incomplete; pattern analysis requires verified, finalized quarterly grades across all required subjects.",
      };
    }
  });

  if (completePayloads.length > 0) {
    try {
      const batchRf = await randomForestRecommendationBatch(completePayloads);
      completeIndices.forEach((origIdx, batchIdx) => {
        rfResults[origIdx] = batchRf?.[batchIdx] ?? null;
      });
    } catch (error) {
      // Batch failure safely leaves complete items as null (which maps to unavailable)
    }
  }

  return payloads.map((payload, index) => {
    const capabilities = payload.classSubject
      ? getSubjectCapabilities(payload.classSubject)
      : null;
    const ruleResult = ruleResults[index];
    const rfResult = rfResults[index];

    // Operational intervention derived strictly from authoritative ruleResult
    return toPublicResult(
      composeRecommendation(payload, ruleResult),
      capabilities,
      payload,
      ruleResult,
      rfResult
    );
  });
}

export const recommendationService = {
  generate,
  generateBatch,
  isAralEligibleSubject,
  getSubjectCapabilities,
  evaluateAcademicSupport,
  ruleBasedRecommendation,
  normalizeStudentInput,
};

export { evaluateAcademicSupport, ruleBasedRecommendation, normalizeStudentInput };

export default recommendationService;
