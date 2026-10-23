/**
 * Authoritative Rule-Based Academic Support Engine.
 *
 * Implements Phase 2 & Phase 3:
 * 1. Authoritative evaluation of actual current academic risk bands:
 *    - High Risk: GWA < 75
 *    - Moderate Risk: 75 <= GWA <= 80
 *    - Low Risk: GWA > 80
 *    - Pending: No finalized ECR grades entered -> neutral "Pending" / "—"
 *
 * 2. Dynamic Academic Completeness Validation (Phase 3 Safeguard):
 *    - Required learning areas are determined dynamically from actual curriculum, enrollment, and class records.
 *    - Does NOT hardcode a universal subject count.
 *    - If required learning area configuration cannot be verified, evaluation is retained as Provisional.
 *    - A complete evaluation requires finalized published grades for all verified required learning areas.
 *
 * 3. Provisional Risk Handling (Phase 3 Safeguard):
 *    - Partially finalized grades produce evaluationStatus = 'provisional'.
 *    - Authoritative overall academic risk is NOT presented (displays "Pending Full-Term Evaluation").
 *    - Authoritative term GWA is NOT computed from an incomplete subset (gwa: null).
 *    - Finalized failing subjects (< 75) immediately receive Subject-Specific Remediation & Monitoring.
 *
 * 4. Risk-Based Academic Support & Intervention Recommendations:
 *    - Monitoring priority is governed by full-term GWA risk band when complete.
 *    - Specific support recommendations are governed by identified subject-level learning needs.
 *    - Evidence-based only: Does NOT infer specific learning competencies from subject grades alone.
 *      Teachers determine specific competency gaps.
 *
 * Single source of truth:
 * - Reuses GRADE_RISK_BANDS from '@/lib/services/recommendation/riskFromGrade'.
 * - Reuses RISK_LEVEL from '@/lib/monitoring/recommendations'.
 */

import { GRADE_RISK_BANDS } from "@/lib/services/recommendation/riskFromGrade";
import { RISK_LEVEL } from "@/lib/monitoring/recommendations";

export const ACADEMIC_SUPPORT_LEVEL = {
  PRIORITY_REMEDIATION: "Priority Academic Remediation",
  SUBJECT_REMEDIATION: "Subject-Specific Remediation & Monitoring",
  TARGETED_REINFORCEMENT: "Targeted Reinforcement",
  REGULAR_MONITORING: "Regular Monitoring & Enrichment",
  PROVISIONAL_PENDING: "Provisional - Pending Full-Term Evaluation",
  PENDING_DATA: "Pending Data",
};

export const EVALUATION_STATUS = {
  COMPLETE: "complete",
  PROVISIONAL: "provisional",
  INSUFFICIENT_DATA: "insufficient_data",
};

/** Upper grade boundary for targeted reinforcement candidates (inclusive: 75–80). */
export const REINFORCEMENT_MAX_GRADE = 80;

function normalizeSubjectKey(name = "") {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeSubjectList(input) {
  if (!input) return null;
  if (Array.isArray(input)) {
    const list = input
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") return item.trim();
        return (
          item.subjectName ??
          item.subject_name ??
          item.subject ??
          item.name ??
          null
        );
      })
      .filter(Boolean);
    return list.length ? list : null;
  }
  return null;
}

/**
 * Normalizes input grades into a consistent Array<{ subject: string, grade: number }>.
 * Ignores null, undefined, empty, or non-finite grades.
 */
function normalizeSubjectGrades(input) {
  const result = [];
  if (!input) return result;

  // Case A: Map / Object with { English: 84, Math: 80 }
  if (typeof input === "object" && !Array.isArray(input)) {
    for (const [key, val] of Object.entries(input)) {
      if (val === null || val === undefined || val === "") continue;
      const n = Number(val);
      if (Number.isFinite(n)) {
        result.push({ subject: String(key).trim(), grade: n });
      }
    }
    return result;
  }

  // Case B: Array of grade objects
  if (Array.isArray(input)) {
    for (const row of input) {
      if (!row) continue;
      // Skip draft / unpublished ECR records
      if (row.isFinalized === false || row.is_finalized === false) continue;
      const subject =
        row.subjectName ??
        row.subject_name ??
        row.subject ??
        row.name ??
        row.classSubject ??
        "Subject";
      const raw =
        row.finalGrade ??
        row.final_grade ??
        row.grade ??
        row.termGrade ??
        row.term_grade;
      if (raw === null || raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) {
        result.push({ subject: String(subject).trim(), grade: n });
      }
    }
  }

  return result;
}

/**
 * Pure evaluation function for authoritative current academic risk and
 * risk-based academic support recommendations.
 *
 * @param {object} params
 * @param {number|null} [params.gwa] - Explicit GWA if pre-calculated
 * @param {Array|object} [params.subjectGrades] - Array of subject grade objects or subject-grade map
 * @param {object} [params.subjects] - Alias for subject-grade map (e.g. { Math: 80, English: 84 })
 * @param {Array<string>} [params.requiredSubjects] - Verified required curriculum/enrolled learning areas
 * @param {boolean} [params.isCompleteTerm] - Explicit completeness flag from verified curriculum
 * @param {boolean} [params.requireVerifiedConfig] - Demand verified required configuration to consider complete
 * @param {object} [params.student] - Full learner/student record
 * @returns {object} Structured academic support and risk assessment
 */
export function evaluateAcademicSupport(params = {}) {
  const input = params.student ? { ...params.student, ...params } : params;

  const rawGrades =
    input.subjectGrades ??
    input.subjects ??
    input.grades ??
    (input.classSubjectGrade !== undefined && input.classSubjectGrade !== null
      ? [
          {
            subject: input.classSubject || input.subject || "Subject",
            grade: input.classSubjectGrade,
          },
        ]
      : []);

  const normalizedGrades = normalizeSubjectGrades(rawGrades);

  // 1. DYNAMIC ACADEMIC COMPLETENESS VALIDATION (Phase 3 Safeguard 1)
  const requiredSubjects = normalizeSubjectList(
    input.requiredSubjects ??
      input.curriculumSubjects ??
      input.sectionSubjects ??
      null
  );

  const hasVerifiedRequiredConfig =
    Array.isArray(requiredSubjects) && requiredSubjects.length > 0;

  let isCompleteTerm = false;
  let completenessLimitation = null;
  const missingRequiredSubjects = [];

  if (hasVerifiedRequiredConfig) {
    // Check every verified required subject against available normalized grades
    const availableKeyMap = new Map();
    for (const g of normalizedGrades) {
      availableKeyMap.set(normalizeSubjectKey(g.subject), g);
    }

    for (const req of requiredSubjects) {
      const reqKey = normalizeSubjectKey(req);
      if (!availableKeyMap.has(reqKey)) {
        missingRequiredSubjects.push(req);
      }
    }

    isCompleteTerm = missingRequiredSubjects.length === 0;
    if (!isCompleteTerm) {
      completenessLimitation = `Missing finalized grades for verified required subject(s): ${missingRequiredSubjects.join(", ")}.`;
    }
  } else if (input.isCompleteTerm !== undefined) {
    isCompleteTerm = Boolean(input.isCompleteTerm);
    if (!isCompleteTerm) {
      completenessLimitation =
        "Evaluation marked as provisional by curriculum validation.";
    }
  } else if (input.requireVerifiedConfig === false) {
    // Explicit opt-out for isolated math calculation tests
    isCompleteTerm = normalizedGrades.length > 0 || input.gwa !== undefined;
  } else if (input.gwa !== undefined && input.gwa !== null && input.gwa !== "") {
    // Authoritative GWA was directly supplied from official finalized school records
    isCompleteTerm = true;
  } else {
    // Phase 3 Safeguard 1 & 5: If complete required-subject configuration cannot be verified
    // and isCompleteTerm is not explicitly true, safely retain Provisional status.
    isCompleteTerm = false;
    completenessLimitation =
      "Required learning area configuration cannot be verified from active enrollment or curriculum records; safely retaining provisional status.";
  }

  // Determine Evaluation Status
  let evaluationStatus;
  if (
    normalizedGrades.length === 0 &&
    (input.gwa === undefined || input.gwa === null)
  ) {
    evaluationStatus = EVALUATION_STATUS.INSUFFICIENT_DATA;
  } else if (!isCompleteTerm) {
    evaluationStatus = EVALUATION_STATUS.PROVISIONAL;
  } else {
    evaluationStatus = EVALUATION_STATUS.COMPLETE;
  }

  // Interim numerical average (for teacher advisory view only)
  let interimAverage = null;
  if (input.gwa !== undefined && input.gwa !== null && input.gwa !== "") {
    const num = Number(input.gwa);
    if (Number.isFinite(num)) {
      interimAverage = Math.round(num * 100) / 100;
    }
  } else if (normalizedGrades.length > 0) {
    const sum = normalizedGrades.reduce((acc, curr) => acc + curr.grade, 0);
    interimAverage = Math.round((sum / normalizedGrades.length) * 100) / 100;
  }

  // Authoritative GWA is ONLY published when evaluation is complete (Phase 3 Safeguard 2 & 5)
  const finalGwa = isCompleteTerm ? interimAverage : null;

  // 2. Identify Subject-Level Academic Needs (Evidence-Based: No Competency Inferences)
  const weakSubjects = [];
  const reinforcementSubjects = [];
  const identifiedAcademicNeeds = [];

  for (const { subject, grade } of normalizedGrades) {
    if (grade < GRADE_RISK_BANDS.passingGrade) {
      weakSubjects.push(subject);
      identifiedAcademicNeeds.push({
        subject,
        grade,
        type: "remediation",
        rationale: `${subject} subject-level remedial support recommended; final grade (${grade}) is below DepEd passing threshold (${GRADE_RISK_BANDS.passingGrade}). Subject teacher to assess specific competency gaps.`,
      });
    } else if (grade <= REINFORCEMENT_MAX_GRADE) {
      reinforcementSubjects.push(subject);
      identifiedAcademicNeeds.push({
        subject,
        grade,
        type: "reinforcement",
        rationale: `${subject} subject-level reinforcement recommended; performance (${grade}) is fairly satisfactory (75–${REINFORCEMENT_MAX_GRADE}). Subject teacher to provide targeted practice to prevent decline.`,
      });
    } else if (grade > REINFORCEMENT_MAX_GRADE) {
      identifiedAcademicNeeds.push({
        subject,
        grade,
        type: "enrichment",
        rationale: `${subject} performance (${grade}) meets or exceeds standards. Enrichment activities or peer assistance recommended.`,
      });
    }
  }

  // 3. Determine Risk Classification & Support Level
  let currentAcademicRisk;
  let officialRiskLevel;
  let recommendedSupportLevel;
  let recommendationReason;
  let suggestedAcademicActivities = [];
  let suggestedMonitoringIndicators = [];

  if (evaluationStatus === EVALUATION_STATUS.INSUFFICIENT_DATA) {
    currentAcademicRisk = "Pending";
    officialRiskLevel = "—";
    recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.PENDING_DATA;
    recommendationReason =
      "No finalized ECR grades available for this academic term.";
    suggestedAcademicActivities = [];
    suggestedMonitoringIndicators = [
      "Awaiting finalized ECR grades for the academic term",
    ];
  } else if (evaluationStatus === EVALUATION_STATUS.PROVISIONAL) {
    // PROVISIONAL RISK HANDLING (Safeguard 2 & 5)
    currentAcademicRisk = "Provisional";
    officialRiskLevel = "Pending Full-Term Evaluation";

    if (weakSubjects.length > 0) {
      // Finalized failing subjects receive immediate subject-specific remediation
      recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.SUBJECT_REMEDIATION;
      recommendationReason = `Academic evaluation is provisional pending full-term completion. Subject-specific remediation is recommended for finalized failing subject(s): ${weakSubjects.join(", ")}.`;
      suggestedAcademicActivities = [
        `Subject-specific remedial sessions in ${weakSubjects.join(", ")}`,
        `Targeted remedial exercises for identified low-performing subject(s): ${weakSubjects.join(", ")}`,
        "Periodic teacher consultation and formative progress checks",
      ];
      suggestedMonitoringIndicators = [
        `Formative check scores and remedial quiz results in ${weakSubjects.join(", ")}`,
        "Task completion rate in remedial practice modules",
        "Awaiting completion of remaining required learning area grades",
      ];
    } else {
      recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.PROVISIONAL_PENDING;
      recommendationReason =
        completenessLimitation ||
        "Academic evaluation is provisional. Full-term academic risk and GWA remain pending until grades are finalized for all required learning areas.";
      suggestedAcademicActivities = [
        "Continue regular classroom instruction while awaiting full-term grade completion",
      ];
      suggestedMonitoringIndicators = [
        "Completion and publishing of remaining required learning area grades",
      ];
    }
  } else {
    // COMPLETE EVALUATION
    if (finalGwa < GRADE_RISK_BANDS.highBelow) {
      currentAcademicRisk = RISK_LEVEL.HIGH;
    } else if (finalGwa <= GRADE_RISK_BANDS.moderateMax) {
      currentAcademicRisk = RISK_LEVEL.MODERATE;
    } else {
      currentAcademicRisk = RISK_LEVEL.LOW;
    }
    officialRiskLevel = currentAcademicRisk;

    if (weakSubjects.length > 0) {
      if (currentAcademicRisk === RISK_LEVEL.HIGH) {
        recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.PRIORITY_REMEDIATION;
        recommendationReason = `Learner is at High Risk (GWA ${finalGwa}) with failing grade(s) in ${weakSubjects.join(", ")}. Priority academic remediation is recommended.`;
        suggestedAcademicActivities = [
          "Guided instructional sessions with subject teachers",
          `Remedial practice worksheets focusing on foundational concepts in ${weakSubjects.join(", ")}`,
          "One-on-one or small-group teacher-led review",
          "Formative assessment checks before summative re-evaluation",
        ];
        suggestedMonitoringIndicators = [
          "Weekly/bi-weekly remedial formative assessment scores",
          "Completion and mastery rate of remedial learning tasks",
          `Re-assessment results in ${weakSubjects.join(", ")}`,
        ];
      } else {
        recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.SUBJECT_REMEDIATION;
        recommendationReason = `Learner demonstrates overall ${currentAcademicRisk} priority (GWA ${finalGwa}), but requires subject-specific remediation in ${weakSubjects.join(", ")} (grade(s) below ${GRADE_RISK_BANDS.passingGrade}).`;
        suggestedAcademicActivities = [
          `Subject-specific remedial sessions in ${weakSubjects.join(", ")}`,
          `Targeted remedial exercises for identified low-performing subject(s): ${weakSubjects.join(", ")}`,
          "Periodic teacher consultation and formative progress checks",
        ];
        suggestedMonitoringIndicators = [
          `Formative check scores and remedial quiz results in ${weakSubjects.join(", ")}`,
          "Task completion rate in remedial practice modules",
          "Teacher observation of subject-level concept recovery",
        ];
      }
    } else if (
      currentAcademicRisk === RISK_LEVEL.MODERATE ||
      reinforcementSubjects.length > 0
    ) {
      recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.TARGETED_REINFORCEMENT;
      const refSubjectsDisplay =
        reinforcementSubjects.length > 0
          ? ` (${reinforcementSubjects.join(", ")})`
          : "";
      recommendationReason = `Learner demonstrates Moderate Risk monitoring priority (GWA ${finalGwa}). Targeted reinforcement and preventive support${refSubjectsDisplay} are recommended to prevent academic decline.`;
      suggestedAcademicActivities = [
        "Targeted practice exercises on challenging subject topics",
        "Peer-assisted study or structured collaborative learning",
        "Regular teacher monitoring during standard classroom instruction",
      ];
      suggestedMonitoringIndicators = [
        `Formative check scores in ${reinforcementSubjects.join(", ") || "target subjects"}`,
        "Classroom participation and task completion rates",
        "Mid-term academic progress check",
      ];
    } else {
      recommendedSupportLevel = ACADEMIC_SUPPORT_LEVEL.REGULAR_MONITORING;
      recommendationReason = `Learner demonstrates Low Risk academic standing (GWA ${finalGwa}) with satisfactory performance across all evaluated subjects. Regular monitoring and enrichment are recommended.`;
      suggestedAcademicActivities = [
        "Standard classroom learning activities and independent study",
        "Enrichment and extension tasks for advanced concepts",
        "Periodic quarterly monitoring to maintain high academic standing",
      ];
      suggestedMonitoringIndicators = [
        "Quarterly summative examination results",
        "Consistent academic performance maintenance",
      ];
    }
  }

  return {
    evaluationStatus,
    isCompleteTerm,
    currentAcademicRisk,
    officialRiskLevel,
    gwa: finalGwa,
    provisionalAverage: !isCompleteTerm ? interimAverage : null,
    requiredSubjects: hasVerifiedRequiredConfig ? requiredSubjects : null,
    missingRequiredSubjects,
    completenessLimitation,
    weakSubjects,
    hasFailingSubject: weakSubjects.length > 0,
    failingSubjectCount: weakSubjects.length,
    lowestSubjectGrade:
      normalizedGrades.length > 0
        ? Math.min(...normalizedGrades.map((g) => g.grade))
        : null,
    reinforcementSubjects,
    identifiedAcademicNeeds,
    recommendedSupportLevel,
    suggestedAcademicActivities,
    suggestedMonitoringIndicators,
    recommendationReason,
    confidence:
      isCompleteTerm && finalGwa !== null
        ? 1.0
        : evaluationStatus === EVALUATION_STATUS.PROVISIONAL
        ? 0.6
        : null,
    source: "authoritative-rule-based",
    generatedAt: new Date().toISOString(),
  };
}

export default evaluateAcademicSupport;
