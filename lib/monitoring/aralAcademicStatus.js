/**
 * Canonical ARAL academic eligibility, referral lifecycle, and wording helpers.
 *
 * Implements Phase 3:
 * - ARAL referral information appears ONLY for valid English or Filipino reading cases.
 * - Non-language subjects (Science, Math, MAPEH, AP, TLE, etc.) NEVER show ARAL referrals.
 * - Decouples ARAL Reading from academic subject grades.
 * - Reading assessment progression is determined strictly by Phil-IRI GST and Form 3 IRA records.
 * - GST below 28 triggers Form 3 Individual Reading Assessment (IRA), not automatic referral or approval.
 * - Clearly distinguishes the operational reading assessment and referral states:
 *     1. Needs Individual Reading Assessment
 *     2. Reading Assessment Completed
 *     3. Eligible for Teacher Referral based on verified criteria (Form 3 Frustration/Instructional)
 *     4. Referral Submitted / Pending Principal Review
 *     5. Approved for Assessment
 *     6. Returned for Teacher Review
 *     7. Under ARAL Support
 * - Preserves historical Principal approval/return records.
 * - Preserves independent readers on the active grade-level monitoring masterlist without dropping them.
 */

import { normalizeSubjectName } from "@/lib/services/recommendation/subjectCapabilities";
import { submitAralRecommendationForReview } from "@/lib/supabase/queries/aralApprovals";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";

export const ARAL_WORDING = {
  PENDING: "Pending Principal Review",
  APPROVED: "Approved for Assessment",
  RETURNED: "Returned for Teacher Review",
  UNDER_SUPPORT: "Under ARAL Support",
  NOT_REFERRED: "Not yet referred",
};

export const READING_ASSESSMENT_STATE = {
  NOT_SCREENED: "Not Screened",
  SCREENING_AT_GRADE: "Screening Complete - At Grade Level",
  NEEDS_IRA: "Needs Individual Reading Assessment",
  ASSESSMENT_COMPLETED: "Reading Assessment Completed",
  ABSENT_RESCHEDULE: "Absent / For Reschedule",
};

export const ARAL_REFERRAL_STATE = {
  NOT_ELIGIBLE: "Not Eligible for Referral",
  ELIGIBLE_FOR_REFERRAL:
    "Eligible for Teacher Referral based on verified criteria",
  REFERRAL_SUBMITTED: "Referral Submitted / Pending Principal Review",
  APPROVED: "Approved for Assessment",
  RETURNED: "Returned for Teacher Review",
  UNDER_ARAL_SUPPORT: "Under ARAL Support",
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
  const key = normalizeSubjectName(subjectName).toLowerCase();
  if (ARAL_LANGUAGE_SUBJECTS.has(key)) return true;
  if (key.includes("english") || key.includes("filipino")) return true;
  if (key.startsWith("eng") || key.startsWith("fil")) return true;
  return false;
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

  // Active in ARAL intervention program ONLY when intervention has actually started or facilitator assigned
  if (
    learner.inAralProgram === true ||
    learner.aralFacilitatorAssigned === true ||
    raw.includes("under aral") ||
    raw.includes("intervention")
  ) {
    return ARAL_WORDING.UNDER_SUPPORT;
  }

  if (
    raw === "approved" ||
    raw.includes("approved for assessment") ||
    raw.includes("approved")
  ) {
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
      readingAssessmentState: READING_ASSESSMENT_STATE.NOT_SCREENED,
      aralReferralState: ARAL_REFERRAL_STATE.NOT_ELIGIBLE,
    };
  }

  // 1. Determine Reading Assessment State
  const isAbsent = Boolean(
    learner.isAbsent ||
      learner.candidateStatus === "Absent / For Reschedule" ||
      learner.screeningStatus === "Absent / For Reschedule" ||
      learner.rawPayload?.isAbsent
  );

  const numGst =
    learner.philIriScore != null && Number.isFinite(Number(learner.philIriScore))
      ? Number(learner.philIriScore)
      : null;

  const rawReadingLevel = String(
    learner.readingLevel || learner.screeningInterpretation || ""
  ).trim();

  const hasForm3 = Boolean(
    rawReadingLevel &&
      rawReadingLevel !== "Not Screened" &&
      rawReadingLevel !== "Not Assessed" &&
      rawReadingLevel !== "Not Set" &&
      rawReadingLevel !== "Pending Oral Profile" &&
      rawReadingLevel !== "Pending Individual Assessment" &&
      rawReadingLevel !== "At Grade Level"
  );

  let readingAssessmentState = READING_ASSESSMENT_STATE.NOT_SCREENED;
  if (isAbsent) {
    readingAssessmentState = READING_ASSESSMENT_STATE.ABSENT_RESCHEDULE;
  } else if (hasForm3 || rawReadingLevel === "Independent") {
    readingAssessmentState = READING_ASSESSMENT_STATE.ASSESSMENT_COMPLETED;
  } else if (numGst !== null) {
    if (numGst >= 28) {
      readingAssessmentState = READING_ASSESSMENT_STATE.SCREENING_AT_GRADE;
    } else {
      // GST below 28 requires Form 3 IRA
      readingAssessmentState = READING_ASSESSMENT_STATE.NEEDS_IRA;
    }
  }

  // 2. Determine Existing Historical / DB Referral Status
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

  const hasActiveReferral = isPending || isApproved || isUnderSupport;

  // 3. Determine Referral Eligibility (Phase 3 Safeguards 3 & 4)
  // Form 3 reading profile of Frustration or Instructional warrants referral.
  // GST < 28 alone requires Form 3 IRA and does NOT grant automatic referral eligibility.
  // Independent profile does NOT qualify for ARAL intervention, but learner remains monitored on masterlist.
  const hasVerifiedReadingNeed =
    rawReadingLevel === "Frustration" ||
    rawReadingLevel === "Instructional" ||
    Boolean(learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason);

  let aralReferralState;
  if (isUnderSupport) {
    aralReferralState = ARAL_REFERRAL_STATE.UNDER_ARAL_SUPPORT;
  } else if (isApproved) {
    aralReferralState = ARAL_REFERRAL_STATE.APPROVED;
  } else if (isPending) {
    aralReferralState = ARAL_REFERRAL_STATE.REFERRAL_SUBMITTED;
  } else if (isReturned) {
    aralReferralState = ARAL_REFERRAL_STATE.RETURNED;
  } else if (hasVerifiedReadingNeed) {
    aralReferralState = ARAL_REFERRAL_STATE.ELIGIBLE_FOR_REFERRAL;
  } else {
    aralReferralState = ARAL_REFERRAL_STATE.NOT_ELIGIBLE;
  }

  // Can submit: is language subject, verified eligible (or returned), not actively pending/approved
  const canSubmitReferral =
    !hasActiveReferral &&
    (aralReferralState === ARAL_REFERRAL_STATE.ELIGIBLE_FOR_REFERRAL || isReturned);

  // Reading concern status display
  let readingConcernStatus = "Screening pending";
  if (isUnderSupport) {
    readingConcernStatus = "Reading intervention active";
  } else if (isApproved) {
    readingConcernStatus = "Approved for assessment";
  } else if (hasActiveReferral) {
    readingConcernStatus = "Reading concern referred";
  } else if (isReturned) {
    readingConcernStatus = "Returned for revision";
  } else if (readingAssessmentState === READING_ASSESSMENT_STATE.NEEDS_IRA) {
    readingConcernStatus = "Form 3 assessment needed (GST < 28)";
  } else if (hasVerifiedReadingNeed) {
    readingConcernStatus = `Verified reading concern (${rawReadingLevel || "Review"})`;
  } else if (readingAssessmentState === READING_ASSESSMENT_STATE.SCREENING_AT_GRADE) {
    readingConcernStatus = "At grade level (GST 28–40)";
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
    readingAssessmentState,
    aralReferralState,
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
      return `Current grade in ${subjectName} (${gradeNum}) did not meet expectations (below 75). Classroom remediation for language learning area is recommended.`;
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
  profileId = null,
}) {
  if (!studentId || !classId || !schoolYear || !quarter) {
    return {
      success: false,
      error: { message: "Missing student, class, school year, or term." },
    };
  }

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

const aralAcademicStatus = {
  ARAL_WORDING,
  READING_ASSESSMENT_STATE,
  ARAL_REFERRAL_STATE,
  isAralLanguageSubject,
  normalizeAralStandardizedStatus,
  getLearnerAralReferralState,
  getPlainLanguageAttentionReason,
  getLearnerDisplaySupport,
  getHistoricalTermLabel,
  submitAralReferralCanonical,
};

export default aralAcademicStatus;

