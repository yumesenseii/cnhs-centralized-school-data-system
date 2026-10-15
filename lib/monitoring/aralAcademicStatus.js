/**
 * Canonical ARAL academic eligibility, referral lifecycle, and wording helpers.
 *
 * Enforces strict consistency across Teacher and Principal Academic Monitoring:
 * - ARAL referral information appears ONLY for valid English or Filipino reading cases.
 * - Non-language subjects (Science, Math, MAPEH, AP, TLE, etc.) NEVER show ARAL referrals.
 * - A low grade alone does not create an ARAL referral; teacher must explicitly confirm a reading concern.
 * - Standardized wording across both portals:
 *     1. "Pending Principal Review"
 *     2. "Approved for Assessment"
 *     3. "Returned for Teacher Review"
 *     4. "Under ARAL Support"
 */

import { normalizeSubjectName } from "@/lib/services/recommendation/subjectCapabilities";
import { ARAL_APPROVAL_DB } from "@/lib/monitoring/aralApproval";
import { submitAralRecommendationForReview } from "@/lib/supabase/queries/aralApprovals";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";

export const ARAL_WORDING = {
  PENDING: "Pending Principal Review",
  APPROVED: "Approved for Assessment",
  RETURNED: "Returned for Teacher Review",
  UNDER_SUPPORT: "Under ARAL Support",
  NOT_REFERRED: "Not yet referred",
};

/** Canonical reading subjects allowed for ARAL (English & Filipino only). */
const ARAL_LANGUAGE_SUBJECTS = new Set(["english", "filipino"]);

/**
 * Checks whether a subject name is an ARAL-eligible language subject (English or Filipino).
 * @param {string|null|undefined} subjectName
 * @returns {boolean}
 */
export function isAralLanguageSubject(subjectName) {
  if (!subjectName) return false;
  const key = normalizeSubjectName(subjectName);
  return ARAL_LANGUAGE_SUBJECTS.has(key);
}

/**
 * Normalizes DB or display status into standardized wording.
 * @param {string|null|undefined} status
 * @param {object} learner
 * @returns {string|null}
 */
export function normalizeAralStandardizedStatus(status, learner = {}) {
  const raw = String(status ?? "").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "suggested" || raw === "not referred") {
    return null;
  }

  // Active in ARAL intervention program only when intervention has started
  if (
    learner.inAralProgram === true ||
    raw.includes("under aral") ||
    raw.includes("intervention")
  ) {
    return ARAL_WORDING.UNDER_SUPPORT;
  }

  if (raw === "approved" || raw.includes("approved for assessment") || raw.includes("approved")) {
    return ARAL_WORDING.APPROVED;
  }

  if (raw === "returned" || raw.includes("returned")) {
    return ARAL_WORDING.RETURNED;
  }

  if (
    raw === "submitted" ||
    raw.includes("pending") ||
    raw.includes("for your review") ||
    raw.includes("waiting for principal") ||
    raw.includes("referred to aral")
  ) {
    return ARAL_WORDING.PENDING;
  }

  return null;
}

/**
 * Evaluates the full ARAL referral state for a learner.
 * Guaranteed to return null referral states for non-language subjects.
 *
 * @param {object} learner
 * @returns {object}
 */
export function getLearnerAralReferralState(learner = {}) {
  const subjectName =
    learner.subject ||
    learner.classSubject ||
    learner.subjectName ||
    (Array.isArray(learner.subjects) ? learner.subjects[0] : null) ||
    "";

  const isLanguage = isAralLanguageSubject(subjectName);

  if (!isLanguage) {
    return {
      isLanguageSubject: false,
      hasActiveReferral: false,
      canSubmitReferral: false,
      isPending: false,
      isApproved: false,
      isReturned: false,
      standardizedStatus: null,
      displayBadge: null,
      readingConcernStatus: null,
    };
  }

  const dbStatus = String(
    learner.aralApprovalDbStatus ||
    learner.aralApprovalStatus ||
    learner.candidateStatus ||
    ""
  ).toLowerCase();

  const standardizedStatus = normalizeAralStandardizedStatus(dbStatus, learner);

  const isPending = standardizedStatus === ARAL_WORDING.PENDING;
  const isApproved = standardizedStatus === ARAL_WORDING.APPROVED;
  const isReturned = standardizedStatus === ARAL_WORDING.RETURNED;
  const isUnderSupport = standardizedStatus === ARAL_WORDING.UNDER_SUPPORT;

  // Active duplicate: submitted (pending) or approved (or already under support)
  const hasActiveReferral = isPending || isApproved || isUnderSupport;

  // Grade check
  const rawGrade = learner.classSubjectGrade ?? learner.currentGrade ?? null;
  const gradeNum = parseRecordedGrade(rawGrade);
  const isBelowPassing = gradeNum !== null && gradeNum < 75;

  // Can submit: is language, not actively pending/approved (allows resubmission if returned or fresh)
  const canSubmitReferral = !hasActiveReferral && (isBelowPassing || isReturned);

  // Reading concern status (plain language)
  let readingConcernStatus = "Needs teacher review";
  if (isUnderSupport) {
    readingConcernStatus = "Reading intervention active";
  } else if (hasActiveReferral) {
    readingConcernStatus = "Reading concern referred";
  } else if (isReturned) {
    readingConcernStatus = "Returned for revision";
  } else if (isBelowPassing) {
    readingConcernStatus = "Academic concern in reading subject";
  }

  return {
    isLanguageSubject: true,
    hasActiveReferral,
    canSubmitReferral,
    isPending,
    isApproved,
    isReturned,
    isUnderSupport,
    standardizedStatus,
    displayBadge: standardizedStatus ? `ARAL Referral: ${standardizedStatus}` : null,
    readingConcernStatus,
    reviewNote: learner.aralApprovalNote || learner.reviewNote || null,
  };
}

/**
 * Produces a clear, plain-language explanation of why a learner needs attention.
 * Zero machine learning jargon, no probability dumps, no confusing formulas.
 *
 * @param {object} learner
 * @returns {string}
 */
export function getPlainLanguageAttentionReason(learner = {}) {
  const subjectName = learner.subject || "this subject";
  const rawGrade = learner.classSubjectGrade ?? learner.currentGrade ?? null;
  const gradeNum = parseRecordedGrade(rawGrade);
  const trend = learner.performanceTrend;
  const isLanguage = isAralLanguageSubject(subjectName);

  if (gradeNum !== null && gradeNum < 75) {
    if (isLanguage) {
      return `Current grade in ${subjectName} (${gradeNum}) is below the passing standard (75). Teacher review is recommended to determine if reading support is needed.`;
    }
    return `Current grade in ${subjectName} (${gradeNum}) is below the passing standard (75). Classroom remedial support is recommended.`;
  }

  if (trend === "Declining") {
    return `Recent performance in ${subjectName} has declined compared to previous terms. Continued teacher monitoring is recommended.`;
  }

  if (gradeNum !== null && gradeNum < 80) {
    return `Academic performance in ${subjectName} (${gradeNum}) is currently within the developing range. Regular classroom monitoring is recommended.`;
  }

  if (learner.riskLevel === "High Risk" || learner.riskPriority) {
    return `Learner is flagged for immediate teacher review based on academic standing in ${subjectName}.`;
  }

  return `Performance trend indicates the learner will benefit from regular monitoring in ${subjectName}.`;
}

/**
 * Resolves the role-appropriate Current Support label.
 *
 * @param {object} learner
 * @returns {string}
 */
export function getLearnerDisplaySupport(learner = {}) {
  const referralState = getLearnerAralReferralState(learner);

  if (referralState.isLanguageSubject) {
    if (referralState.isUnderSupport) return ARAL_WORDING.UNDER_SUPPORT;
    if (referralState.isApproved) return ARAL_WORDING.APPROVED;
    if (referralState.isPending) return ARAL_WORDING.PENDING;
    if (referralState.isReturned) return ARAL_WORDING.RETURNED;
  }

  const remedial = learner.remedialStatus || learner.interventionStatus;
  if (remedial && remedial !== "None" && remedial !== "Not Started") {
    return `Class Remedial (${remedial})`;
  }

  if (learner.classroomRemedialRecommended) {
    return "Class Remedial";
  }

  if (learner.monitoringStatus && learner.monitoringStatus !== "Not Started") {
    return learner.monitoringStatus;
  }

  return "Classroom Monitoring";
}

/**
 * Returns a historical term label if the learner record belongs to an earlier term.
 *
 * @param {object} learner
 * @param {number|string|null} currentQuarterNumber
 * @returns {string|null}
 */
export function getHistoricalTermLabel(learner = {}, currentQuarterNumber = null) {
  const learnerQuarter = Number(
    learner.quarterNumber ??
    learner.quarter ??
    learner.reportQuarterNumber ??
    0
  );
  const currentQ = Number(currentQuarterNumber ?? 0);

  if (currentQ > 0 && learnerQuarter > 0 && learnerQuarter < currentQ) {
    return `Historical Record · Term ${learnerQuarter}`;
  }
  return null;
}

/**
 * Canonical referral submission / resubmission handler.
 *
 * Duplicate guard:
 * - submitted: blocked
 * - approved: blocked
 * - returned: allowed (updates existing approval row; preserves review history)
 *
 * @param {object} params
 * @returns {Promise<{ success: boolean, error: object|null }>}
 */
export async function submitAralReferralCanonical({
  studentId,
  classId,
  schoolYear,
  quarter,
  notes = "",
  reviewConcern = "",
  profileId = null,
}) {
  if (!studentId || !classId || !schoolYear || !quarter) {
    return {
      success: false,
      error: { message: "Missing student, class, school year, or term." },
    };
  }

  // Submit or resubmit in canonical approval table (handles duplicates and resubmission after return)
  const approvalRes = await submitAralRecommendationForReview({
    studentId,
    classId,
    schoolYear,
    quarter,
    profileId,
  });

  if (approvalRes.error) {
    return { success: false, error: approvalRes.error };
  }

  return { success: true, error: null };
}
