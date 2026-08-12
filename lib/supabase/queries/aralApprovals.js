import { createClient } from "@/lib/supabase/client";
import {
  ARAL_APPROVAL_DB,
  approvalKey,
} from "@/lib/monitoring/aralApproval";

async function ensureAuthSession() {
  const supabase = createClient();
  await supabase.auth.getSession();
  return supabase;
}

function normalizeQuarter(quarter) {
  const n = Number(quarter);
  if (Number.isFinite(n) && n >= 1 && n <= 4) return n;
  const fromLabel = Number(String(quarter ?? "").replace(/\D/g, ""));
  return Number.isFinite(fromLabel) && fromLabel >= 1 && fromLabel <= 4
    ? fromLabel
    : null;
}

/**
 * Load approvals for a school year (optionally one term).
 * Returns Map keyed by studentId:classId:schoolYear:quarter and studentId:classId.
 */
export async function listAralApprovals({
  schoolYear = null,
  quarter = null,
  studentIds = null,
} = {}) {
  const supabase = await ensureAuthSession();

  let query = supabase.from("aral_recommendation_approvals").select(`
    id,
    student_id,
    class_id,
    school_year,
    quarter,
    status,
    review_note,
    submitted_at,
    submitted_by_profile_id,
    reviewed_at,
    reviewed_by_profile_id,
    updated_at
  `);

  if (schoolYear) query = query.eq("school_year", schoolYear);
  const qNum = normalizeQuarter(quarter);
  if (qNum) query = query.eq("quarter", qNum);
  if (Array.isArray(studentIds) && studentIds.length) {
    query = query.in("student_id", studentIds);
  }

  const { data, error } = await query;
  if (error) {
    // Table may not exist yet on older deploys — fail soft.
    if (/aral_recommendation_approvals|schema cache|does not exist/i.test(error.message)) {
      return { data: new Map(), error: null };
    }
    return { data: new Map(), error };
  }

  const map = new Map();
  for (const row of data ?? []) {
    const full = approvalKey(
      row.student_id,
      row.class_id,
      row.school_year,
      row.quarter
    );
    map.set(full, row);
    const loose = `${row.student_id}:${row.class_id}`;
    const prev = map.get(loose);
    // Prefer actionable HT statuses when multiple terms share the loose key.
    const rank = (s) =>
      s === ARAL_APPROVAL_DB.SUBMITTED
        ? 3
        : s === ARAL_APPROVAL_DB.RETURNED
          ? 2
          : s === ARAL_APPROVAL_DB.APPROVED
            ? 1
            : 0;
    if (!prev || rank(row.status) >= rank(prev.status)) {
      map.set(loose, row);
    }
  }
  return { data: map, error: null };
}

/**
 * Teacher (or admin) submits ARAL recommendation for HT review.
 */
export async function submitAralRecommendationForReview({
  studentId,
  classId,
  schoolYear,
  quarter,
  profileId = null,
} = {}) {
  const qNum = normalizeQuarter(quarter);
  if (!studentId || !classId || !schoolYear || !qNum) {
    return {
      data: null,
      error: { message: "Missing student, class, school year, or term." },
    };
  }

  const supabase = await ensureAuthSession();

  const { data: existing } = await supabase
    .from("aral_recommendation_approvals")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("school_year", schoolYear)
    .eq("quarter", qNum)
    .maybeSingle();

  if (existing?.status === ARAL_APPROVAL_DB.APPROVED) {
    return {
      data: null,
      error: {
        message:
          "This ARAL recommendation is already approved by the Head Teacher.",
      },
    };
  }

  const payload = {
    student_id: studentId,
    class_id: classId,
    school_year: schoolYear,
    quarter: qNum,
    status: ARAL_APPROVAL_DB.SUBMITTED,
    review_note: null,
    submitted_at: new Date().toISOString(),
    submitted_by_profile_id: profileId,
    reviewed_at: null,
    reviewed_by_profile_id: null,
  };

  const { data, error } = await supabase
    .from("aral_recommendation_approvals")
    .upsert(payload, { onConflict: "student_id,class_id,school_year,quarter" })
    .select("*")
    .single();

  return { data, error };
}

/**
 * HT/Admin approve or return one recommendation.
 * @param {'approved'|'returned'} status
 */
export async function reviewAralRecommendation({
  studentId,
  classId,
  schoolYear,
  quarter,
  status,
  reviewNote = null,
  profileId = null,
} = {}) {
  const qNum = normalizeQuarter(quarter);
  if (!studentId || !classId || !schoolYear || !qNum) {
    return {
      data: null,
      error: { message: "Missing student, class, school year, or term." },
    };
  }
  if (
    status !== ARAL_APPROVAL_DB.APPROVED &&
    status !== ARAL_APPROVAL_DB.RETURNED
  ) {
    return { data: null, error: { message: "Invalid review status." } };
  }

  const supabase = await ensureAuthSession();
  const now = new Date().toISOString();
  const payload = {
    student_id: studentId,
    class_id: classId,
    school_year: schoolYear,
    quarter: qNum,
    status,
    review_note: reviewNote ? String(reviewNote).trim().slice(0, 500) : null,
    reviewed_at: now,
    reviewed_by_profile_id: profileId,
    // Keep submitted_at if row exists; set if approving directly from Suggested.
    submitted_at: now,
    submitted_by_profile_id: profileId,
  };

  // Prefer update-or-insert while preserving earlier submitted_at when possible.
  const { data: existing } = await supabase
    .from("aral_recommendation_approvals")
    .select("id, submitted_at, submitted_by_profile_id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("school_year", schoolYear)
    .eq("quarter", qNum)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("aral_recommendation_approvals")
      .update({
        status,
        review_note: payload.review_note,
        reviewed_at: now,
        reviewed_by_profile_id: profileId,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from("aral_recommendation_approvals")
    .insert(payload)
    .select("*")
    .single();
  return { data, error };
}

/**
 * Batch approve or return many ARAL rows (admin).
 */
export async function batchReviewAralRecommendations({
  learners = [],
  status,
  reviewNote = null,
  profileId = null,
} = {}) {
  const results = [];
  for (const learner of learners) {
    const result = await reviewAralRecommendation({
      studentId: learner.studentId,
      classId: learner.classId,
      schoolYear: learner.schoolYear,
      quarter:
        learner.aralApprovalQuarter ??
        learner.reportQuarterNumber ??
        learner.quarterNumber ??
        learner.quarter,
      status,
      reviewNote,
      profileId,
    });
    results.push({ learnerId: learner.id, ...result });
    if (result.error) {
      return { data: results, error: result.error };
    }
  }
  return { data: results, error: null };
}

/**
 * Teacher submits all ARAL-recommended learners in a class report file to HT.
 * Uses the **report file term** (`quarter` arg) first so Term 1 sends land on Term 1.
 */
export async function submitClassReportForHtReview({
  learners = [],
  schoolYear,
  quarter,
  profileId = null,
} = {}) {
  const fileQuarter = normalizeQuarter(quarter);

  const targets = (learners ?? []).filter((l) => {
    if (l.aralEligible === false || l.subjectAralEligible === false) return false;
    const t = String(l.recommendationDisplay ?? l.recommendation ?? "");
    return /aral/i.test(t);
  });

  if (!targets.length) {
    return {
      data: { submitted: 0 },
      error: {
        message:
          "No ARAL-recommended learners in this class file to submit. Failing learners without an ARAL recommendation stay on the Failing tab for review only.",
      },
    };
  }

  const results = [];
  for (const learner of targets) {
    const result = await submitAralRecommendationForReview({
      studentId: learner.studentId,
      classId: learner.classId,
      schoolYear: learner.schoolYear || schoolYear,
      // File term wins over class assignment term.
      quarter:
        fileQuarter ??
        normalizeQuarter(learner.reportQuarterNumber) ??
        normalizeQuarter(learner.quarterNumber) ??
        normalizeQuarter(learner.quarter),
      profileId,
    });
    results.push({ learnerId: learner.id, ...result });
    if (
      result.error &&
      !/already approved/i.test(String(result.error.message || ""))
    ) {
      return {
        data: { submitted: Math.max(0, results.length - 1), results },
        error: result.error,
      };
    }
  }

  return { data: { submitted: results.length, results }, error: null };
}

/**
 * HT batch-review all ARAL / approval-tracked rows on a class report file.
 */
export async function reviewClassReportForHt({
  learners = [],
  status,
  reviewNote = null,
  profileId = null,
} = {}) {
  const targets = (learners ?? []).filter((l) => {
    const t = String(l.recommendationDisplay ?? l.recommendation ?? "");
    if (/aral/i.test(t)) return true;
    const db = l.aralApprovalDbStatus;
    return db === "submitted" || db === "approved" || db === "returned";
  });
  return batchReviewAralRecommendations({
    learners: targets,
    status,
    reviewNote,
    profileId,
  });
}
