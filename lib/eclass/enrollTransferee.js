import { createClient } from "@/lib/supabase/client";
import { splitLearnerName } from "./normalize.js";
import { invalidateTeacherClassesCache } from "@/lib/supabase/queries/myClasses";

/**
 * Enroll or transfer a student directly into a target section.
 * Handles both:
 * 1. Internal transfer: Student exists in another section -> updates section_id.
 * 2. External transfer: Student does not exist in DB -> inserts new student record.
 */
export async function enrollTransfereeStudent({
  lrn,
  fullName,
  gender,
  sectionId,
}) {
  if (!sectionId) throw new Error("Target section is required.");
  if (!fullName?.trim()) throw new Error("Learner name is required.");

  const cleanLrn = String(lrn || "").trim();
  const supabase = createClient();
  const parsed = splitLearnerName(fullName);

  let existingStudent = null;
  if (cleanLrn) {
    const { data: existing, error: findErr } = await supabase
      .from("students")
      .select("id, student_number, first_name, middle_name, last_name, section_id, sex")
      .eq("student_number", cleanLrn)
      .maybeSingle();

    if (findErr) throw findErr;
    existingStudent = existing;
  }

  // 1. If student already exists in the system (Internal Transfer)
  if (existingStudent) {
    const { data: updated, error: updErr } = await supabase
      .from("students")
      .update({
        section_id: sectionId,
        status: "active",
      })
      .eq("id", existingStudent.id)
      .select("id, student_number, first_name, middle_name, last_name, section_id, sex")
      .single();

    if (updErr) throw updErr;
    invalidateTeacherClassesCache();
    return updated;
  }

  // 2. If student is new to the system (External Transfer)
  const normalizedSex = String(gender || "").toUpperCase().startsWith("F")
    ? "Female"
    : String(gender || "").toUpperCase().startsWith("M")
    ? "Male"
    : null;

  const { data: inserted, error: insErr } = await supabase
    .from("students")
    .insert({
      student_number: cleanLrn || null,
      first_name: parsed.first_name,
      middle_name: parsed.middle_name,
      last_name: parsed.last_name,
      sex: normalizedSex,
      section_id: sectionId,
      status: "active",
    })
    .select("id, student_number, first_name, middle_name, last_name, section_id, sex")
    .single();

  if (insErr) throw insErr;
  invalidateTeacherClassesCache();
  return inserted;
}
