import { createClient } from "@/lib/supabase/client";

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
