/**
 * ARAL recommendation HT/Admin approval statuses (lean PLP-oriented workflow).
 * No row in DB = Suggested (system recommendation only).
 */

export const ARAL_APPROVAL_STATUS = {
  SUGGESTED: "Suggested",
  SUBMITTED: "Submitted for review",
  APPROVED: "Approved",
  RETURNED: "Returned",
};

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

/**
 * Merge approval map onto monitoring roster rows.
 * Only meaningful for ARAL-eligible Eng/Fil recommendations.
 */
export function attachAralApprovals(students = [], approvalMap = new Map()) {
  return students.map((student) => {
    const quarter =
      student.quarterNumber ??
      Number(String(student.quarter ?? "").replace(/\D/g, "")) ??
      null;
    const key = approvalKey(
      student.studentId,
      student.classId,
      student.schoolYear,
      quarter
    );
    const row = approvalMap.get(key) || approvalMap.get(`${student.studentId}:${student.classId}`);
    const dbStatus = row?.status ?? null;
    const label = dbStatusToLabel(dbStatus);
    return {
      ...student,
      aralApprovalId: row?.id ?? null,
      aralApprovalDbStatus: dbStatus,
      aralApprovalStatus: label,
      aralApprovalNote: row?.review_note ?? row?.reviewNote ?? null,
      aralSubmittedAt: row?.submitted_at ?? row?.submittedAt ?? null,
      aralReviewedAt: row?.reviewed_at ?? row?.reviewedAt ?? null,
      aralReviewedByProfileId:
        row?.reviewed_by_profile_id ?? row?.reviewedByProfileId ?? null,
    };
  });
}
