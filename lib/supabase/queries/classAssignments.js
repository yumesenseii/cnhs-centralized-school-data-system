import { createClient } from "@/lib/supabase/client";
import {
  assignmentSummary,
  notifyClassAssignmentChange,
} from "@/lib/notifications/classAssignmentNotifications";
import { getAdminSession, requireAdmin } from "@/lib/supabase/queries/adminAuth";

const supabase = createClient();

const CLASS_ASSIGNMENT_SELECT = `
  id,
  subject_id,
  teacher_id,
  section_id,
  school_year,
  quarter,
  created_at,
  subjects (
    id,
    subject_name,
    subject_code
  ),
  sections (
    id,
    section_name,
    grade_level,
    school_year,
    status
  ),
  teachers (
    id,
    first_name,
    middle_name,
    last_name,
    employee_number,
    learning_area,
    status
  )
`;

export { getAdminSession };

export async function listClassAssignments() {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await supabase
    .from("classes")
    .select(CLASS_ASSIGNMENT_SELECT)
    .order("school_year", { ascending: false })
    .order("quarter", { ascending: true })
    .order("created_at", { ascending: false });

  return { data: data ?? [], error };
}

export async function listAssignmentTeachers() {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await supabase
    .from("teachers")
    .select(
      "id, first_name, middle_name, last_name, employee_number, learning_area, status"
    )
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  return { data: data ?? [], error };
}

export async function listAssignmentSubjects() {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await supabase
    .from("subjects")
    .select("id, subject_name, subject_code")
    .order("subject_name", { ascending: true });

  return { data: data ?? [], error };
}

export async function listAssignmentSections({
  schoolYear,
  gradeLevel,
  activeOnly = true,
} = {}) {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: [], error: auth.error };

  let query = supabase
    .from("sections")
    .select(
      "id, grade_level, section_name, school_year, status, adviser_id"
    )
    .order("grade_level", { ascending: true })
    .order("section_name", { ascending: true });

  if (activeOnly) {
    query = query.eq("status", "active");
  }

  if (schoolYear) {
    query = query.eq("school_year", schoolYear);
  }

  if (gradeLevel !== undefined && gradeLevel !== null && gradeLevel !== "") {
    const grade = Number(gradeLevel);
    if (Number.isFinite(grade)) {
      query = query.eq("grade_level", grade);
    }
  }

  const { data, error } = await query;
  return { data: data ?? [], error };
}

async function findDuplicateAssignment({
  teacherId,
  subjectId,
  sectionId,
  schoolYear,
  quarter,
  excludeId = null,
}) {
  let query = supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId)
    .eq("section_id", sectionId)
    .eq("school_year", schoolYear)
    .eq("quarter", quarter);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.limit(1);
  if (error) return { duplicate: false, error };
  return { duplicate: Boolean(data?.length), error: null };
}

function validateAssignmentPayload(payload) {
  const teacherId = payload.teacher_id;
  const subjectId = payload.subject_id;
  const sectionId = payload.section_id;
  const schoolYear = String(payload.school_year ?? "").trim();
  const quarter = Number(payload.quarter);

  if (!teacherId) return { error: new Error("Teacher is required.") };
  if (!subjectId) return { error: new Error("Subject is required.") };
  if (!sectionId) return { error: new Error("Section is required.") };
  if (!schoolYear) return { error: new Error("School year is required.") };
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return { error: new Error("Quarter must be between 1 and 4.") };
  }

  return {
    error: null,
    value: {
      teacher_id: teacherId,
      subject_id: subjectId,
      section_id: sectionId,
      school_year: schoolYear,
      quarter,
    },
  };
}

export async function createClassAssignment(payload) {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: null, error: auth.error };

  const validated = validateAssignmentPayload(payload);
  if (validated.error) return { data: null, error: validated.error };

  const sectionCheck = await supabase
    .from("sections")
    .select("id, grade_level, section_name, school_year, status")
    .eq("id", validated.value.section_id)
    .maybeSingle();

  if (sectionCheck.error) return { data: null, error: sectionCheck.error };
  if (!sectionCheck.data) {
    return { data: null, error: new Error("Selected section was not found.") };
  }
  if (sectionCheck.data.status === "archived") {
    return {
      data: null,
      error: new Error("Cannot assign classes to an archived section."),
    };
  }

  // Grade level is stored on sections; ensure UI selection matches the section.
  if (
    payload.grade_level !== undefined &&
    payload.grade_level !== null &&
    payload.grade_level !== ""
  ) {
    const expectedGrade = Number(payload.grade_level);
    if (
      Number.isFinite(expectedGrade) &&
      Number(sectionCheck.data.grade_level) !== expectedGrade
    ) {
      return {
        data: null,
        error: new Error("Selected section does not match the grade level."),
      };
    }
  }

  const dup = await findDuplicateAssignment({
    teacherId: validated.value.teacher_id,
    subjectId: validated.value.subject_id,
    sectionId: validated.value.section_id,
    schoolYear: validated.value.school_year,
    quarter: validated.value.quarter,
  });
  if (dup.error) return { data: null, error: dup.error };
  if (dup.duplicate) {
    return {
      data: null,
      error: new Error(
        "This teacher is already assigned to that subject, section, school year, and quarter."
      ),
    };
  }

  const { data, error } = await supabase
    .from("classes")
    .insert(validated.value)
    .select(CLASS_ASSIGNMENT_SELECT)
    .single();

  if (!error && data?.id) {
    await notifyClassAssignmentChange({
      action: "created",
      teacherId: data.teacher_id,
      assignment: assignmentSummary(data),
      actorProfileId: auth.profile?.id ?? null,
    });
  }

  return { data, error };
}

export async function updateClassAssignment(classId, payload) {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: null, error: auth.error };

  const validated = validateAssignmentPayload(payload);
  if (validated.error) return { data: null, error: validated.error };

  const sectionCheck = await supabase
    .from("sections")
    .select("id, grade_level, status")
    .eq("id", validated.value.section_id)
    .maybeSingle();

  if (sectionCheck.error) return { data: null, error: sectionCheck.error };
  if (!sectionCheck.data) {
    return { data: null, error: new Error("Selected section was not found.") };
  }
  if (sectionCheck.data.status === "archived") {
    return {
      data: null,
      error: new Error("Cannot assign classes to an archived section."),
    };
  }

  if (
    payload.grade_level !== undefined &&
    payload.grade_level !== null &&
    payload.grade_level !== ""
  ) {
    const expectedGrade = Number(payload.grade_level);
    if (
      Number.isFinite(expectedGrade) &&
      Number(sectionCheck.data.grade_level) !== expectedGrade
    ) {
      return {
        data: null,
        error: new Error("Selected section does not match the grade level."),
      };
    }
  }

  const dup = await findDuplicateAssignment({
    teacherId: validated.value.teacher_id,
    subjectId: validated.value.subject_id,
    sectionId: validated.value.section_id,
    schoolYear: validated.value.school_year,
    quarter: validated.value.quarter,
    excludeId: classId,
  });
  if (dup.error) return { data: null, error: dup.error };
  if (dup.duplicate) {
    return {
      data: null,
      error: new Error(
        "This teacher is already assigned to that subject, section, school year, and quarter."
      ),
    };
  }

  // Captured before the write so a reassignment can notify the previous teacher.
  const previous = await supabase
    .from("classes")
    .select(CLASS_ASSIGNMENT_SELECT)
    .eq("id", classId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("classes")
    .update(validated.value)
    .eq("id", classId)
    .select(CLASS_ASSIGNMENT_SELECT)
    .single();

  if (!error && data?.id) {
    const actorProfileId = auth.profile?.id ?? null;
    const previousTeacherId = previous.data?.teacher_id ?? null;

    if (previousTeacherId && previousTeacherId !== data.teacher_id) {
      await notifyClassAssignmentChange({
        action: "removed",
        teacherId: previousTeacherId,
        assignment: assignmentSummary(previous.data),
        actorProfileId,
      });
    }

    await notifyClassAssignmentChange({
      action: "updated",
      teacherId: data.teacher_id,
      assignment: {
        ...assignmentSummary(data),
        // Content signature: re-saving the same values does not re-notify,
        // but any real change (including a reassignment) does.
        revision: [
          data.teacher_id,
          data.subject_id,
          data.section_id,
          data.school_year,
          data.quarter,
        ].join("-"),
      },
      actorProfileId,
    });
  }

  return { data, error };
}

export async function deleteClassAssignment(classId) {
  const auth = await requireAdmin("manage class assignments");
  if (!auth.ok) return { data: null, error: auth.error };

  // Context for the notification is only available before the row is removed.
  const previous = await supabase
    .from("classes")
    .select(CLASS_ASSIGNMENT_SELECT)
    .eq("id", classId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId)
    .select("id")
    .single();

  if (!error && previous.data?.teacher_id) {
    await notifyClassAssignmentChange({
      action: "removed",
      teacherId: previous.data.teacher_id,
      assignment: assignmentSummary(previous.data),
      actorProfileId: auth.profile?.id ?? null,
    });
  }

  return { data, error };
}
