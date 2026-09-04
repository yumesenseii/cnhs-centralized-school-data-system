/**
 * ARAL recommendation HT/Admin approval statuses (lean PLP-oriented workflow).
 * No row in DB = Suggested (system recommendation only).
 */

import { parseTermNumber } from "@/lib/academic/termLabels";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";

export const ARAL_APPROVAL_STATUS = {
  SUGGESTED: "Suggested",
  SUBMITTED: "Submitted for review",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

/** Softer labels for HT-facing UI (logic still uses ARAL_APPROVAL_STATUS). */
export const ARAL_APPROVAL_DISPLAY = {
  [ARAL_APPROVAL_STATUS.SUGGESTED]: "Suggested",
  [ARAL_APPROVAL_STATUS.SUBMITTED]: "For your review",
  [ARAL_APPROVAL_STATUS.APPROVED]: "Approved",
  [ARAL_APPROVAL_STATUS.RETURNED]: "Returned",
};

export function aralApprovalDisplayLabel(status) {
  if (!status) return ARAL_APPROVAL_DISPLAY[ARAL_APPROVAL_STATUS.SUGGESTED];
  return ARAL_APPROVAL_DISPLAY[status] || status;
}

export const ARAL_APPROVAL_DB = {
  SUBMITTED: "submitted",
  APPROVED: "approved",
  RETURNED: "returned",
};

export const aralApprovalStyles = {
  [ARAL_APPROVAL_STATUS.SUGGESTED]: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  [ARAL_APPROVAL_STATUS.SUBMITTED]: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  [ARAL_APPROVAL_STATUS.APPROVED]: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  [ARAL_APPROVAL_STATUS.RETURNED]: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
};

export function dbStatusToLabel(dbStatus) {
  if (dbStatus === ARAL_APPROVAL_DB.APPROVED) return ARAL_APPROVAL_STATUS.APPROVED;
  if (dbStatus === ARAL_APPROVAL_DB.RETURNED) return ARAL_APPROVAL_STATUS.RETURNED;
  if (dbStatus === ARAL_APPROVAL_DB.SUBMITTED) return ARAL_APPROVAL_STATUS.SUBMITTED;
  return ARAL_APPROVAL_STATUS.SUGGESTED;
}

export function approvalKey(studentId, classId, schoolYear, quarter) {
  return `${studentId}:${classId}:${schoolYear}:${quarter}`;
}

/** Resolve 1–4 term for approval matching / submit. */
export function resolveApprovalQuarter(student = {}) {
  const candidates = [
    student.aralApprovalQuarter,
    student.reportQuarterNumber,
    student.quarterNumber,
    student.quarter,
  ];
  for (const c of candidates) {
    const n = parseTermNumber(c);
    if (n) return n;
  }
  return null;
}

/**
 * Learner counts toward HT inbox / Approve ARAL even if the live RF label
 * flipped to None after grades changed — as long as an approval row exists.
 */
export function hasHtApprovalRecord(learner = {}) {
  const db = learner.aralApprovalDbStatus;
  return (
    db === ARAL_APPROVAL_DB.SUBMITTED ||
    db === ARAL_APPROVAL_DB.APPROVED ||
    db === ARAL_APPROVAL_DB.RETURNED
  );
}

export function isAralHtTrackedLearner(learner = {}) {
  return isAralRecommended(learner) || hasHtApprovalRecord(learner);
}

/**
 * Merge approval map onto monitoring roster rows.
 * Prefers exact school_year + quarter key; falls back to student:class.
 */
export function attachAralApprovals(students = [], approvalMap = new Map()) {
  return students.map((student) => {
    const preferredQuarter = resolveApprovalQuarter(student);
    const exactKey =
      preferredQuarter != null
        ? approvalKey(
            student.studentId,
            student.classId,
            student.schoolYear,
            preferredQuarter
          )
        : null;

    let row =
      (exactKey && approvalMap.get(exactKey)) ||
      approvalMap.get(`${student.studentId}:${student.classId}`) ||
      null;

    // If preferred quarter missed but map has another term for this pair, keep it
    // (fallback key already covers last-write). Prefer submitted over stale when possible.
    const dbStatus = row?.status ?? null;
    const approvalQuarter =
      parseTermNumber(row?.quarter) ?? preferredQuarter ?? null;
    const label = dbStatusToLabel(dbStatus);

    return {
      ...student,
      aralApprovalId: row?.id ?? null,
      aralApprovalDbStatus: dbStatus,
      aralApprovalStatus: label,
      aralApprovalQuarter: approvalQuarter,
      aralApprovalNote: row?.review_note ?? row?.reviewNote ?? null,
      aralSubmittedAt: row?.submitted_at ?? row?.submittedAt ?? null,
      aralReviewedAt: row?.reviewed_at ?? row?.reviewedAt ?? null,
      aralReviewedByProfileId:
        row?.reviewed_by_profile_id ?? row?.reviewedByProfileId ?? null,
    };
  });
}
