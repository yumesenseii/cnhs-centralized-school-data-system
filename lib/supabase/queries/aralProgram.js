import { createClient } from "@/lib/supabase/client";
import { notifyAralFacilitatorAssigned } from "@/lib/notifications/aralFacilitatorNotifications";
import {
  aralPeriodForFacilitatorPhase,
  isFacilitatorPhaseWritable,
} from "@/lib/monitoring/assessmentTimeline";

/**
 * Reject writes for phases whose ARAL period is not current.
 * Returns an Error when blocked, null when allowed (or untagged).
 */
function rejectNonCurrentPhase(phase, assessmentPeriod) {
  if (assessmentPeriod === null || assessmentPeriod === undefined || assessmentPeriod === "") {
    return null;
  }
  if (isFacilitatorPhaseWritable(phase, assessmentPeriod)) return null;
  const period = aralPeriodForFacilitatorPhase(phase);
  return new Error(
    period
      ? `This assessment belongs to a ${period} window that is not currently open. Past results are read-only and future periods are not yet available.`
      : "Unknown assessment phase."
  );
}

async function ensureAuthSession() {
  const supabase = createClient();
  await supabase.auth.getSession();
  return supabase;
}

function formatTeacherName(teacher) {
  if (!teacher) return "—";
  const parts = [teacher.first_name, teacher.middle_name, teacher.last_name]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  return parts.join(" ") || teacher.email || "—";
}

function formatStudentName(student) {
  if (!student) return "—";
  const parts = [student.first_name, student.middle_name, student.last_name]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean);
  return parts.join(" ") || "—";
}

/**
 * Ensure an active Summer ARAL Program batch exists for the school year.
 */
export async function ensureActiveAralBatch(schoolYear = "SY 2026-2027") {
  const supabase = await ensureAuthSession();

  const { data: existing, error: existingError } = await supabase
    .from("aral_program_batches")
    .select("id, name, school_year, starts_on, ends_on, is_active")
    .eq("school_year", schoolYear)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return { data: null, error: existingError };
  if (existing) return { data: existing, error: null };

  const { data, error } = await supabase
    .from("aral_program_batches")
    .upsert(
      {
        name: "Summer ARAL Program",
        school_year: schoolYear,
        is_active: true,
      },
      { onConflict: "school_year,name" }
    )
    .select("id, name, school_year, starts_on, ends_on, is_active")
    .single();

  return { data, error };
}

export async function listAralFacilitatorAssignments({
  batchId = null,
  schoolYear = "SY 2026-2027",
} = {}) {
  const supabase = await ensureAuthSession();

  let resolvedBatchId = batchId;
  if (!resolvedBatchId) {
    const batchResult = await ensureActiveAralBatch(schoolYear);
    if (batchResult.error) return { data: [], error: batchResult.error };
    resolvedBatchId = batchResult.data?.id ?? null;
  }

  if (!resolvedBatchId) return { data: [], error: null };

  const { data, error } = await supabase
    .from("aral_facilitator_assignments")
    .select(
      `
      id,
      batch_id,
      student_id,
      facilitator_teacher_id,
      source_class_id,
      notes,
      created_at,
      student:students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name,
        section_id
      ),
      facilitator:teachers (
        id,
        first_name,
        middle_name,
        last_name,
        email
      ),
      source_class:classes (
        id,
        school_year,
        quarter,
        subject:subjects ( subject_name ),
        section:sections ( grade_level, section_name )
      )
    `
    )
    .eq("batch_id", resolvedBatchId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };

  const rows = (data ?? []).map((row) => {
    const section = row.source_class?.section;
    const gradeSection = section
      ? `Grade ${section.grade_level} — ${section.section_name}`
      : "—";
    return {
      id: row.id,
      batchId: row.batch_id,
      studentId: row.student_id,
      facilitatorTeacherId: row.facilitator_teacher_id,
      sourceClassId: row.source_class_id,
      notes: row.notes,
      studentName: formatStudentName(row.student),
      studentNumber: row.student?.student_number ?? "—",
      facilitatorName: formatTeacherName(row.facilitator),
      subject: row.source_class?.subject?.subject_name ?? "—",
      gradeSection,
      schoolYear: row.source_class?.school_year ?? schoolYear,
      quarter: row.source_class?.quarter ?? null,
    };
  });

  return { data: rows, error: null };
}

export async function listTeachersForFacilitatorSelect() {
  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, first_name, middle_name, last_name, email, status")
    .order("last_name", { ascending: true });

  if (error) return { data: [], error };

  return {
    data: (data ?? []).map((t) => ({
      id: t.id,
      name: formatTeacherName(t),
      email: t.email,
      status: t.status,
    })),
    error: null,
  };
}

/**
 * Assign or reassign a facilitator for an ARAL learner in the active batch.
 */
export async function upsertAralFacilitatorAssignment({
  studentId,
  facilitatorTeacherId,
  sourceClassId = null,
  schoolYear = "SY 2026-2027",
  notes = null,
  assignedByProfileId = null,
}) {
  if (!studentId || !facilitatorTeacherId) {
    return {
      data: null,
      error: new Error("Student and facilitator are required."),
    };
  }

  const batchResult = await ensureActiveAralBatch(schoolYear);
  if (batchResult.error || !batchResult.data?.id) {
    return {
      data: null,
      error: batchResult.error ?? new Error("Unable to resolve ARAL program batch."),
    };
  }

  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("aral_facilitator_assignments")
    .upsert(
      {
        batch_id: batchResult.data.id,
        student_id: studentId,
        facilitator_teacher_id: facilitatorTeacherId,
        source_class_id: sourceClassId,
        notes,
        assigned_by_profile_id: assignedByProfileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "batch_id,student_id" }
    )
    .select("id, batch_id, student_id, facilitator_teacher_id, source_class_id")
    .single();

  if (!error && data?.id) {
    let learnerName = null;
    try {
      const { data: student } = await supabase
        .from("students")
        .select("first_name, middle_name, last_name")
        .eq("id", data.student_id)
        .maybeSingle();
      learnerName = formatStudentName(student);
    } catch {
      // ignore name lookup
    }
    await notifyAralFacilitatorAssigned({
      assignment: data,
      actorProfileId: assignedByProfileId,
      learnerName: learnerName === "—" ? null : learnerName,
    });
  }

  return { data, error };
}

export async function removeAralFacilitatorAssignment(assignmentId) {
  if (!assignmentId) {
    return { data: null, error: new Error("Assignment id is required.") };
  }
  const supabase = await ensureAuthSession();
  const { error } = await supabase
    .from("aral_facilitator_assignments")
    .delete()
    .eq("id", assignmentId);
  return { data: !error, error };
}

/**
 * Assignments for the logged-in teacher (Summer ARAL facilitator view).
 */
export async function listMyAralFacilitatorAssignments(teacherId) {
  if (!teacherId) {
    return { data: [], error: new Error("Teacher id is required.") };
  }

  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("aral_facilitator_assignments")
    .select(
      `
      id,
      batch_id,
      student_id,
      facilitator_teacher_id,
      source_class_id,
      notes,
      created_at,
      batch:aral_program_batches ( id, name, school_year, is_active ),
      student:students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name
      ),
      source_class:classes (
        id,
        school_year,
        quarter,
        subject:subjects ( subject_name ),
        section:sections ( grade_level, section_name )
      )
    `
    )
    .eq("facilitator_teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };

  const rows = (data ?? [])
    .filter((row) => row.batch?.is_active !== false)
    .map((row) => {
      const section = row.source_class?.section;
      return {
        id: row.id,
        batchId: row.batch_id,
        batchName: row.batch?.name ?? "Summer ARAL Program",
        schoolYear: row.batch?.school_year ?? row.source_class?.school_year,
        studentId: row.student_id,
        firstName: row.student?.first_name ?? "",
        middleName: row.student?.middle_name ?? "",
        lastName: row.student?.last_name ?? "",
        studentName: formatStudentName(row.student),
        studentNumber: row.student?.student_number ?? "—",
        sourceClassId: row.source_class_id,
        subject: row.source_class?.subject?.subject_name ?? "—",
        gradeSection: section
          ? `Grade ${section.grade_level} — ${section.section_name}`
          : "—",
        quarter: row.source_class?.quarter ?? 4,
      };
    });

  return { data: rows, error: null };
}

/**
 * Map of studentId → assignment for an active batch (admin merge into roster).
 */
export async function getAralAssignmentMapByStudent({
  schoolYear = "SY 2026-2027",
} = {}) {
  const result = await listAralFacilitatorAssignments({ schoolYear });
  if (result.error) return { data: new Map(), error: result.error };

  const map = new Map();
  for (const row of result.data ?? []) {
    map.set(row.studentId, row);
  }
  return { data: map, error: null };
}

export async function isCurrentTeacherAralFacilitator(studentId) {
  if (!studentId) return { data: false, error: null };
  const supabase = await ensureAuthSession();
  const { data, error } = await supabase.rpc("is_aral_facilitator_for_student", {
    p_student_id: studentId,
  });
  if (error) {
    // Fallback if RPC unavailable: query assignments for current teacher session.
    return { data: false, error };
  }
  return { data: Boolean(data), error: null };
}

/**
 * Load assessment scores for a section (all phases or one).
 */
export async function listAralAssessmentScoresForSection({
  batchId,
  gradeSection,
  phase = null,
} = {}) {
  if (!batchId || !gradeSection) {
    return { data: [], error: new Error("Batch and section are required.") };
  }

  const supabase = await ensureAuthSession();
  let query = supabase
    .from("aral_assessment_scores")
    .select(
      `
      id,
      batch_id,
      student_id,
      assignment_id,
      grade_section,
      phase,
      score,
      max_score,
      pass_percent,
      result,
      notes,
      status,
      started_at,
      scored_at,
      recorded_by_teacher_id
    `
    )
    .eq("batch_id", batchId)
    .eq("grade_section", gradeSection);

  if (phase) query = query.eq("phase", phase);

  const { data, error } = await query;
  if (error) return { data: [], error };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      studentId: row.student_id,
      assignmentId: row.assignment_id,
      gradeSection: row.grade_section,
      phase: row.phase,
      score: row.score == null ? null : Number(row.score),
      maxScore: row.max_score == null ? null : Number(row.max_score),
      passPercent: row.pass_percent == null ? null : Number(row.pass_percent),
      result: row.result,
      notes: row.notes || "",
      status: row.status,
      startedAt: row.started_at,
      scoredAt: row.scored_at,
      recordedByTeacherId: row.recorded_by_teacher_id,
    })),
    error: null,
  };
}

/**
 * Own or facilitated Pre/Mid/Post rows for one learner (recorded progress).
 */
export async function listAralAssessmentScoresForStudents(studentIds = []) {
  const ids = [...new Set((studentIds ?? []).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };
  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("aral_assessment_scores")
    .select(
      `
      id,
      student_id,
      phase,
      score,
      max_score,
      pass_percent,
      result,
      notes,
      status,
      scored_at,
      started_at
    `
    )
    .in("student_id", ids);

  if (error) return { data: [], error };
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      studentId: row.student_id,
      phase: row.phase,
      score: row.score == null ? null : Number(row.score),
      maxScore: row.max_score == null ? null : Number(row.max_score),
      passPercent: row.pass_percent == null ? null : Number(row.pass_percent),
      result: row.result,
      notes: row.notes || "",
      status: row.status,
      scoredAt: row.scored_at,
      startedAt: row.started_at,
    })),
    error: null,
  };
}

export async function listAralAssessmentScoresForStudent(studentId) {
  return listAralAssessmentScoresForStudents(studentId ? [studentId] : []);
}

/**
 * Load assessment scores for a section + phase (map by studentId).
 */
export async function listAralAssessmentScores({
  batchId,
  gradeSection,
  phase = "pre",
} = {}) {
  const result = await listAralAssessmentScoresForSection({
    batchId,
    gradeSection,
    phase,
  });
  return result;
}

/**
 * Mark Pre/Mid/Post open for all learners in a section (Start for class).
 * Does not wipe already-scored rows.
 */
export async function startAralAssessmentForSection({
  learners = [],
  gradeSection,
  phase = "pre",
  maxScore = 40,
  passPercent = 75,
  teacherId = null,
  assessmentPeriod = null,
}) {
  if (!learners.length) {
    return { data: [], error: new Error("No learners in this section.") };
  }
  if (!gradeSection) {
    return { data: null, error: new Error("Section is required.") };
  }
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }

  const periodBlockError = rejectNonCurrentPhase(phase, assessmentPeriod);
  if (periodBlockError) {
    return { data: [], error: periodBlockError };
  }

  const batchId = learners[0]?.batchId;
  if (!batchId) {
    return { data: null, error: new Error("Batch id is missing on assignments.") };
  }

  const existingResult = await listAralAssessmentScores({
    batchId,
    gradeSection,
    phase,
  });
  if (existingResult.error) return { data: [], error: existingResult.error };

  const existingByStudent = new Map(
    (existingResult.data ?? []).map((row) => [row.studentId, row])
  );

  const now = new Date().toISOString();
  const rows = [];

  for (const learner of learners) {
    const existing = existingByStudent.get(learner.studentId);
    if (existing?.status === "scored" && existing.score != null) {
      continue;
    }
    rows.push({
      batch_id: batchId,
      student_id: learner.studentId,
      assignment_id: learner.id || existing?.assignmentId || null,
      grade_section: gradeSection,
      phase,
      score: existing?.score ?? null,
      max_score: Number(maxScore) || 40,
      pass_percent: Number(passPercent) || 75,
      result: existing?.result ?? null,
      notes: existing?.notes || null,
      status: "in_progress",
      started_at: existing?.startedAt || now,
      scored_at: existing?.scoredAt || null,
      recorded_by_teacher_id: teacherId,
      updated_at: now,
    });
  }

  if (!rows.length) {
    return { data: [], error: null };
  }

  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("aral_assessment_scores")
    .upsert(rows, { onConflict: "batch_id,student_id,phase" })
    .select("id, student_id, status, started_at");

  return { data: data ?? [], error };
}

/**
 * Save score rows for a section phase (facilitator).
 * @param {Array<{ studentId, assignmentId?, score, maxScore, passPercent, result, notes, status? }>} rows
 */
export async function saveAralAssessmentScores({
  batchId,
  gradeSection,
  phase = "pre",
  teacherId = null,
  rows = [],
  assessmentPeriod = null,
} = {}) {
  if (!batchId || !gradeSection) {
    return { data: [], error: new Error("Batch and section are required.") };
  }
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }
  if (!rows.length) {
    return { data: [], error: new Error("No scores to save.") };
  }

  const periodBlockError = rejectNonCurrentPhase(phase, assessmentPeriod);
  if (periodBlockError) {
    return { data: [], error: periodBlockError };
  }

  const now = new Date().toISOString();
  const payload = rows.map((row) => {
    const hasScore = row.score !== null && row.score !== undefined;
    return {
      batch_id: batchId,
      student_id: row.studentId,
      assignment_id: row.assignmentId || null,
      grade_section: gradeSection,
      phase,
      score: hasScore ? Number(row.score) : null,
      max_score: Number(row.maxScore) || 40,
      pass_percent: Number(row.passPercent) || 75,
      result: row.result || null,
      notes: row.notes || null,
      status: hasScore ? "scored" : row.status || "in_progress",
      started_at: row.startedAt || now,
      scored_at: hasScore ? now : null,
      recorded_by_teacher_id: teacherId,
      updated_at: now,
    };
  });

  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("aral_assessment_scores")
    .upsert(payload, { onConflict: "batch_id,student_id,phase" })
    .select("id, student_id, score, result, status");

  return { data: data ?? [], error };
}

/**
 * Official historical ARAL aggregate benchmarks (read-only reference).
 * Used for equivalent-period longitudinal comparison on the principal
 * dashboard. Never written by application code.
 */
export async function listAralBenchmarks() {
  const supabase = await ensureAuthSession();
  try {
    const { data, error } = await supabase
      .from("cnhs_aral_aggregate_benchmarks")
      .select("*")
      .order("school_year", { ascending: false });
    if (error) return { data: [], error: null };
    return { data: data ?? [], error: null };
  } catch {
    return { data: [], error: null };
  }
}

/**
 * List HT/Admin comments for a section (optional phase filter).
 * phase undefined → all; null → section-wide only; pre|mid|post → that phase (+ section-wide if includeSectionWide).
 */
export async function listAralAssessmentComments({
  batchId,
  gradeSection,
  phase,
  includeSectionWide = true,
} = {}) {
  if (!batchId || !gradeSection) {
    return { data: [], error: new Error("Batch and section are required.") };
  }

  const supabase = await ensureAuthSession();
  const fallbackSelect =
    "id, batch_id, grade_section, phase, body, created_by_profile_id, created_at";

  let query = supabase
    .from("aral_assessment_comments")
    .select(fallbackSelect)
    .eq("batch_id", batchId)
    .eq("grade_section", gradeSection)
    .order("created_at", { ascending: false });

  if (phase === null) {
    query = query.is("phase", null);
  } else if (phase === "pre" || phase === "mid" || phase === "post") {
    if (includeSectionWide) {
      query = query.or(`phase.eq.${phase},phase.is.null`);
    } else {
      query = query.eq("phase", phase);
    }
  }

  const { data, error } = await query;
  if (error) return { data: [], error };

  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      gradeSection: row.grade_section,
      phase: row.phase,
      body: row.body,
      createdByProfileId: row.created_by_profile_id,
      createdAt: row.created_at,
      authorName: "Principal",
    })),
    error: null,
  };
}

export async function createAralAssessmentComment({
  batchId,
  gradeSection,
  phase = null,
  body,
  createdByProfileId = null,
} = {}) {
  const text = String(body || "").trim();
  if (!batchId || !gradeSection || !text) {
    return {
      data: null,
      error: new Error("Batch, section, and comment body are required."),
    };
  }

  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("aral_assessment_comments")
    .insert({
      batch_id: batchId,
      grade_section: gradeSection,
      phase: phase || null,
      body: text,
      created_by_profile_id: createdByProfileId,
    })
    .select("id, batch_id, grade_section, phase, body, created_at")
    .single();

  if (error) return { data: null, error };
  return {
    data: {
      id: data.id,
      batchId: data.batch_id,
      gradeSection: data.grade_section,
      phase: data.phase,
      body: data.body,
      createdAt: data.created_at,
    },
    error: null,
  };
}
