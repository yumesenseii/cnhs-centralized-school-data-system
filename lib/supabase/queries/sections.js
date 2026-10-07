import { createClient } from "@/lib/supabase/client";
import { getAdminSession, requireAdmin } from "@/lib/supabase/queries/adminAuth";
import {
  buildAssignmentBlockedError,
  buildAssignmentVerifyFailedError,
  countSectionDependentRecords,
} from "@/lib/admin/assignmentEditGuard";
import { isValidGradeLevel } from "@/lib/academic/gradeLevels";

const supabase = createClient();

const SECTION_SELECT = `
  id,
  grade_level,
  section_name,
  school_year,
  adviser_id,
  status,
  created_at,
  teachers (
    id,
    first_name,
    middle_name,
    last_name,
    employee_number,
    status
  )
`;

export { getAdminSession };

export async function listSections({ schoolYear, status, gradeLevel } = {}) {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: [], error: auth.error };

  let query = supabase
    .from("sections")
    .select(SECTION_SELECT)
    .order("school_year", { ascending: false })
    .order("grade_level", { ascending: true })
    .order("section_name", { ascending: true });

  if (schoolYear && schoolYear !== "All School Years") {
    query = query.eq("school_year", schoolYear);
  }

  if (status && status !== "All Status") {
    query = query.eq("status", status.toLowerCase());
  }

  if (gradeLevel && gradeLevel !== "All Grades") {
    const grade = Number(String(gradeLevel).replace(/\D/g, ""));
    if (Number.isFinite(grade)) {
      query = query.eq("grade_level", grade);
    }
  }

  const { data, error } = await query;
  return { data: data ?? [], error };
}

export async function listTeachersForAdviser() {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await supabase
    .from("teachers")
    .select(
      "id, first_name, middle_name, last_name, employee_number, status, learning_area"
    )
    .eq("status", "active")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  return { data: data ?? [], error };
}

export async function listSchoolYears() {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await supabase
    .from("sections")
    .select("school_year")
    .order("school_year", { ascending: false });

  if (error) return { data: [], error };

  const years = [...new Set((data ?? []).map((row) => row.school_year).filter(Boolean))];
  return { data: years, error: null };
}

async function findDuplicateSection({
  gradeLevel,
  sectionName,
  schoolYear,
  excludeId = null,
}) {
  let query = supabase
    .from("sections")
    .select("id")
    .eq("grade_level", gradeLevel)
    .ilike("section_name", sectionName.trim())
    .eq("school_year", schoolYear);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.limit(1);
  if (error) {
    return { duplicate: false, error };
  }

  return { duplicate: Boolean(data?.length), error: null };
}

export async function createSection(payload) {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: null, error: auth.error };

  const gradeLevel = Number(payload.grade_level);
  const sectionName = String(payload.section_name ?? "").trim();
  const schoolYear = String(payload.school_year ?? "").trim();

  if (!isValidGradeLevel(gradeLevel)) {
    return { data: null, error: new Error("Grade level must be between 7 and 10.") };
  }
  if (!sectionName) {
    return { data: null, error: new Error("Section name is required.") };
  }
  if (!schoolYear) {
    return { data: null, error: new Error("School year is required.") };
  }

  const dup = await findDuplicateSection({
    gradeLevel,
    sectionName,
    schoolYear,
  });
  if (dup.error) return { data: null, error: dup.error };
  if (dup.duplicate) {
    return {
      data: null,
      error: new Error(
        "A section with this grade, name, and school year already exists."
      ),
    };
  }

  const { data, error } = await supabase
    .from("sections")
    .insert({
      grade_level: gradeLevel,
      section_name: sectionName,
      school_year: schoolYear,
      adviser_id: payload.adviser_id || null,
      status: "active",
    })
    .select(SECTION_SELECT)
    .single();

  return { data, error };
}

export async function updateSection(sectionId, payload) {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: null, error: auth.error };

  const gradeLevel = Number(payload.grade_level);
  const sectionName = String(payload.section_name ?? "").trim();
  const schoolYear = String(payload.school_year ?? "").trim();

  if (!isValidGradeLevel(gradeLevel)) {
    return { data: null, error: new Error("Grade level must be between 7 and 10.") };
  }
  if (!sectionName) {
    return { data: null, error: new Error("Section name is required.") };
  }
  if (!schoolYear) {
    return { data: null, error: new Error("School year is required.") };
  }

  const dup = await findDuplicateSection({
    gradeLevel,
    sectionName,
    schoolYear,
    excludeId: sectionId,
  });
  if (dup.error) return { data: null, error: dup.error };
  if (dup.duplicate) {
    return {
      data: null,
      error: new Error(
        "A section with this grade, name, and school year already exists."
      ),
    };
  }

  // Assignment Edit Rule: the advisory assignment may only change while no
  // data records are associated with the section. Blocked edits change
  // nothing — no writes, no migration, no silent reassignment.
  const current = await supabase
    .from("sections")
    .select("id, adviser_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (current.error) return { data: null, error: current.error };
  if (!current.data) return { data: null, error: new Error("Section not found.") };

  const normalizeAdviser = (value) =>
    value === "" || value === undefined ? null : (value ?? null);
  const adviserChanged =
    normalizeAdviser(current.data.adviser_id) !==
    normalizeAdviser(payload.adviser_id);
  if (adviserChanged) {
    const guard = await countSectionDependentRecords(sectionId);
    if (guard.error) {
      return { data: null, error: buildAssignmentVerifyFailedError() };
    }
    if (guard.total > 0) {
      return {
        data: null,
        error: buildAssignmentBlockedError(guard.breakdown),
      };
    }
  }

  const { data, error } = await supabase
    .from("sections")
    .update({
      grade_level: gradeLevel,
      section_name: sectionName,
      school_year: schoolYear,
      adviser_id: payload.adviser_id || null,
    })
    .eq("id", sectionId)
    .select(SECTION_SELECT)
    .single();

  return { data, error };
}

export async function archiveSection(sectionId) {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: null, error: auth.error };

  const { data, error } = await supabase
    .from("sections")
    .update({ status: "archived" })
    .eq("id", sectionId)
    .select(SECTION_SELECT)
    .single();

  return { data, error };
}

export async function restoreSection(sectionId) {
  const auth = await requireAdmin("manage sections");
  if (!auth.ok) return { data: null, error: auth.error };

  const { data, error } = await supabase
    .from("sections")
    .update({ status: "active" })
    .eq("id", sectionId)
    .select(SECTION_SELECT)
    .single();

  return { data, error };
}
