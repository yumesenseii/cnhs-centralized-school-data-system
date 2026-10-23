/**
 * Canonical derived-state engine for Teacher → Academic Monitoring.
 *
 * Centralizes existing CNHS rules without inventing new thresholds:
 * 1. Academic Risk: Derived from finalized grades via official riskLevelFromGrade / engine results.
 * 2. Academic Progress: Derived solely by comparing same learner, same subject current vs valid previous grade.
 * 3. Priority: Derived strictly from existing riskPriority.js logic.
 * 4. Current Support: Derived from actual workflow records (Needs Review, Monitoring, Under Class Support, Under ARAL Support).
 *
 * Guaranteed consistency across summary cards, table rows, filters, and learner detail modal.
 */

import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";
import { RISK_LEVEL, normalizeRiskLevel } from "@/lib/monitoring/recommendations";
import { isAralLanguageSubject } from "@/lib/monitoring/aralAcademicStatus";
import {
  isHighPriority as checkHighPriority,
  resolveLearnerPriority as getResolvedPriority,
  getPriorityCue,
} from "@/lib/monitoring/riskPriority";
import { learnerIdentityKey } from "@/lib/monitoring/academicLearnerAggregation";

/**
 * 1. ACADEMIC RISK
 * Reuses existing confirmed CNHS academic-risk configuration.
 * Missing / ungraded records return neutral "—" rather than forcing "Low Risk".
 */
export function deriveAcademicRisk(learner = {}, grade = null) {
  const curGrade = parseRecordedGrade(
    grade ?? learner.classSubjectGrade ?? learner.currentGrade ?? learner.reportGrade
  );

  // If learner already has authoritative risk from engine or roster, preserve it
  const existingRisk = learner.riskLevel || learner.academicRisk;

  if (
    existingRisk === "Provisional" ||
    existingRisk === "Pending Full-Term Evaluation" ||
    learner.evaluationStatus === "provisional"
  ) {
    return "Pending Full-Term Evaluation";
  }

  if (
    existingRisk &&
    existingRisk !== "—" &&
    existingRisk !== "Ungraded" &&
    existingRisk !== "Pending"
  ) {
    // If ungraded and existing risk is misleadingly set, keep neutral
    if (curGrade === null && !learner.hasClassSubjectGrade) {
      return "—";
    }
    return normalizeRiskLevel(existingRisk) || existingRisk;
  }

  if (curGrade === null) {
    return "—";
  }

  return riskLevelFromGrade(curGrade);
}

/**
 * 2. ACADEMIC PROGRESS (formerly Trend)
 * Strictly compares finalized grades for same learner and subject.
 * If no valid previous grade exists, returns null ("—"). Never fabricates "Stable".
 */
export function deriveAcademicProgress(currentGrade, previousGrade) {
  const cur = parseRecordedGrade(currentGrade);
  const prev = parseRecordedGrade(previousGrade);

  if (cur === null || prev === null) {
    return {
      progress: null,
      label: "—",
      hasPreviousGrade: false,
      curGrade: cur,
      prevGrade: prev,
    };
  }

  if (cur > prev) {
    return {
      progress: "Improving",
      label: "Improving",
      hasPreviousGrade: true,
      curGrade: cur,
      prevGrade: prev,
      diff: cur - prev,
    };
  }

  if (cur < prev) {
    return {
      progress: "Declining",
      label: "Declining",
      hasPreviousGrade: true,
      curGrade: cur,
      prevGrade: prev,
      diff: cur - prev,
    };
  }

  return {
    progress: "No clear change",
    label: "No clear change",
    hasPreviousGrade: true,
    curGrade: cur,
    prevGrade: prev,
    diff: 0,
  };
}

/**
 * 3. PRIORITY
 * Reuses existing authoritative riskPriority.js logic without arbitrary cutoffs.
 */
export function resolveLearnerPriority(learner = {}) {
  return getResolvedPriority(learner);
}

export function isHighPriority(learner = {}) {
  return checkHighPriority(learner);
}

/**
 * 4. CURRENT SUPPORT / WORKFLOW STATUS
 * Derived from actual workflow and monitoring records, NOT directly from grade.
 *
 * Conceptual states:
 * - "Under Class Support": actual classroom remedial intervention is Active/Started (Recommended ≠ Active)
 * - "Under ARAL Support": actual active ARAL state for a valid English/Filipino reading concern
 * - "Needs Review": concern identified and current-term teacher review has not yet been completed
 * - "Monitoring": teacher reviewed learner and selected continued monitoring, OR remedial is merely Recommended
 */
export function deriveCurrentSupport(learner = {}) {
  const subjectName =
    learner.subject ||
    learner.classSubject ||
    (Array.isArray(learner.subjects) ? learner.subjects[0] : null) ||
    "";

  const isLanguage = isAralLanguageSubject(subjectName);

  // A. Active ARAL Support (language subjects only)
  const isAralActive =
    isLanguage &&
    (learner.inAralProgram === true ||
      learner.aralFacilitatorAssigned === true ||
      String(learner.aralApprovalStatus || "").toLowerCase().includes("under aral"));

  if (isAralActive) {
    return {
      key: "under_aral_support",
      label: "Under ARAL Support",
      isUnderSupport: true,
      badgeStyle: "border-blue-200 bg-blue-50 text-blue-800",
    };
  }

  // B. Active Classroom Remedial (Active / Progressing only — Recommended is NOT active)
  const remStatus = String(
    learner.remedialStatus ||
    learner.interventionStatus ||
    ""
  ).trim();

  const isRemedialActive =
    remStatus === "Active" ||
    remStatus === "Progressing" ||
    remStatus === "Under Class Support" ||
    learner.currentSupport === "Under Class Support" ||
    learner.monitoringStatus === "Active" ||
    learner.monitoring_status === "Active" ||
    ((learner.intervention_given === "Class Remedial" ||
      learner.interventionGiven === "Class Remedial") &&
      (learner.monitoringStatus === "Ongoing" ||
        learner.monitoringStatus === "Active" ||
        learner.monitoring_status === "Ongoing")) ||
    (learner.monitoringStatus === "Ongoing" &&
      String(learner.latestProgress || "").toLowerCase().includes("remedial"));

  if (isRemedialActive) {
    return {
      key: "under_class_support",
      label: "Under Class Support",
      isUnderSupport: true,
      badgeStyle: "border-blue-200 bg-blue-50 text-blue-800",
    };
  }

  // C. Needs Review: Concern identified BUT teacher has not completed review in the current term
  const curGrade = parseRecordedGrade(
    learner.classSubjectGrade ?? learner.currentGrade ?? learner.reportGrade
  );
  const isHighRisk =
    deriveAcademicRisk(learner, curGrade) === RISK_LEVEL.HIGH ||
    (curGrade !== null && curGrade < 75);

  const isReadingConcernCandidate =
    isLanguage && Boolean(learner.readingReview?.candidate);

  const hasConcern = isHighRisk || isReadingConcernCandidate;

  const rawMonitoringStatus = String(learner.monitoringStatus || "").trim();
  const hasTeacherReviewed =
    remStatus === "Monitoring" ||
    learner.currentSupport === "Monitoring" ||
    (rawMonitoringStatus &&
      rawMonitoringStatus !== "Not Started" &&
      rawMonitoringStatus !== "Needs Review" &&
      rawMonitoringStatus !== "For Review") ||
    Boolean(learner.latestObservationDate && learner.latestObservationDate !== "—") ||
    Boolean(learner.reviewedAt) ||
    Boolean(learner.teacherRemarks);

  if (hasConcern && !hasTeacherReviewed) {
    return {
      key: "needs_review",
      label: "Needs Review",
      isNeedsReview: true,
      isUnderSupport: false,
      badgeStyle: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  // D. Monitoring: Teacher reviewed and confirmed monitoring, OR support is merely Recommended
  return {
    key: "monitoring",
    label: "Monitoring",
    isUnderSupport: false,
    badgeStyle: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

/**
 * 5. COMPREHENSIVE DERIVED STATE BUNDLE FOR A LEARNER
 */
export function deriveLearnerMonitoringState(learner = {}) {
  const currentGrade = parseRecordedGrade(
    learner.classSubjectGrade ?? learner.currentGrade ?? learner.reportGrade
  );
  const previousGrade = parseRecordedGrade(learner.previousGrade);

  const academicRisk = deriveAcademicRisk(learner, currentGrade);
  const progressInfo = deriveAcademicProgress(currentGrade, previousGrade);
  const priorityInfo = resolveLearnerPriority(learner);
  const currentSupport = deriveCurrentSupport(learner);

  return {
    currentGrade,
    previousGrade,
    academicRisk,
    progress: progressInfo.progress,
    progressLabel: progressInfo.label,
    progressInfo,
    priority: priorityInfo,
    isHighPriority: priorityInfo.isHighPriority,
    currentSupport: currentSupport.label,
    currentSupportKey: currentSupport.key,
    currentSupportBadgeStyle: currentSupport.badgeStyle,
    isUnderSupport: currentSupport.isUnderSupport,
  };
}

/**
 * 6. SUMMARY CARDS CALCULATOR
 * Deduplicates by unique learner in the active scope.
 * Calculates independent counts according to DepEd / CNHS policy:
 * - For Review: Current Support === "Needs Review"
 * - High Priority: authoritative existing priority logic
 * - Under Support: actual active Class Support or active ARAL support
 * - Improving: Progress === "Improving"
 */
export function calculateMonitoringSummaryCards(students = []) {
  // Deduplicate by unique learner identity
  const uniqueMap = new Map();
  for (const s of students) {
    if (!s) continue;
    const key = learnerIdentityKey(s);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, s);
    }
  }

  const uniqueLearners = [...uniqueMap.values()];

  let forReviewCount = 0;
  let highPriorityCount = 0;
  let underSupportCount = 0;
  let improvingCount = 0;

  for (const learner of uniqueLearners) {
    const state = deriveLearnerMonitoringState(learner);

    if (state.currentSupportKey === "needs_review") {
      forReviewCount++;
    }

    if (state.isHighPriority) {
      highPriorityCount++;
    }

    if (state.isUnderSupport) {
      underSupportCount++;
    }

    if (state.progress === "Improving") {
      improvingCount++;
    }
  }

  return {
    forReviewCount,
    highPriorityCount,
    underSupportCount,
    improvingCount,
    totalUnique: uniqueLearners.length,
  };
}
