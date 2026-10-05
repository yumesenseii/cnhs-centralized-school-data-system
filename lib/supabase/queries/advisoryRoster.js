import { createClient } from "@/lib/supabase/client";
import { splitLearnerName } from "@/lib/teacher/myClassesMappers";
import { normalizeText } from "@/lib/eclass/normalize";

const supabase = createClient();

/**
 * Fetch the official learner roster for an advisory section.
 */
export async function getOfficialSectionRoster(sectionId) {
  if (!sectionId) return { data: [], error: new Error("Section ID required.") };

  const { data, error } = await supabase
    .from("students")
    .select("id, student_number, first_name, middle_name, last_name, sex, birthdate, status, created_at")
    .eq("section_id", sectionId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  return { data: data ?? [], error };
}

/**
 * Import or maintain official section roster learners.
 * The Class Adviser uses this to establish the official membership:
 * Student → Section → School Year → Adviser.
 */
export async function importOfficialSectionRoster(sectionId, learners = []) {
  if (!sectionId) throw new Error("Section ID required.");
  if (!learners?.length) throw new Error("No learners provided for roster import.");

  // 1. Gather all student numbers
  const numbers = [
    ...new Set(
      learners
        .map((l) => String(l.student_number ?? "").trim())
        .filter(Boolean)
    ),
  ];

  // 2. Lookup existing students across database
  const { data: existingStudents, error: lookupErr } = await supabase
    .from("students")
    .select("id, student_number, section_id")
    .in("student_number", numbers);

  if (lookupErr) throw lookupErr;

  const existingMap = new Map();
  for (const s of existingStudents ?? []) {
    existingMap.set(String(s.student_number).trim(), s);
  }

  let enrolledCount = 0;
  let updatedCount = 0;

  const toInsert = [];
  const toUpdate = [];

  for (const learner of learners) {
    const lrn = String(learner.student_number ?? "").trim();
    if (!lrn) continue;

    const names =
      learner.first_name && learner.last_name
        ? {
            first_name: learner.first_name,
            middle_name: learner.middle_name ?? null,
            last_name: learner.last_name,
          }
        : splitLearnerName(normalizeText(learner.full_name));

    const sex =
      learner.sex ??
      learner.gender ??
      (String(learner.full_name ?? "").toLowerCase().includes("female") ? "Female" : null);

    if (existingMap.has(lrn)) {
      const existing = existingMap.get(lrn);
      toUpdate.push({
        id: existing.id,
        section_id: sectionId,
        first_name: names.first_name,
        middle_name: names.middle_name,
        last_name: names.last_name,
        sex: sex ?? undefined,
        status: "active",
      });
    } else {
      toInsert.push({
        student_number: lrn,
        first_name: names.first_name,
        middle_name: names.middle_name,
        last_name: names.last_name,
        sex: sex ?? null,
        section_id: sectionId,
        status: "active",
      });
    }
  }

  // 3. Batch updates
  for (const item of toUpdate) {
    const { id, ...fields } = item;
    const { error: updErr } = await supabase
      .from("students")
      .update(fields)
      .eq("id", id);
    if (updErr) throw updErr;
    updatedCount++;
  }

  // 4. Batch inserts
  if (toInsert.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error: insErr } = await supabase.from("students").insert(chunk);
      if (insErr) throw insErr;
      enrolledCount += chunk.length;
    }
  }

  return {
    success: true,
    enrolledCount,
    updatedCount,
    totalRoster: enrolledCount + updatedCount,
  };
}

/**
 * Clear the official section roster for a given section.
 * Unlinks students from this section and cleans up section class links.
 */
export async function clearOfficialSectionRoster(sectionId) {
  if (!sectionId) throw new Error("Section ID required.");

  // 1. Fetch all student IDs in this section
  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id")
    .eq("section_id", sectionId);

  if (sErr) throw sErr;
  const studentIds = (students || []).map((s) => s.id);

  // 2. Set section_id = null for these students to remove them from the official section roster
  // Student master records, historical grades, attendance, and intervention records are preserved
  if (studentIds.length > 0) {
    const { error: updErr } = await supabase
      .from("students")
      .update({ section_id: null })
      .eq("section_id", sectionId);

    if (updErr) throw updErr;
  }

  return {
    success: true,
    clearedCount: studentIds.length,
  };
}

