/**
 * All Terms = four `classes` rows (quarters 1–4). Roster lives per class_id.
 * Copy enrollments from the richest sibling; never invent grades.
 */

const ALL_TERM_QUARTERS = [1, 2, 3, 4];

function familyFilters(family = {}) {
  return {
    teacherId: family.teacherId ?? family.teacher_id ?? null,
    subjectId: family.subjectId ?? family.subject_id ?? null,
    sectionId: family.sectionId ?? family.section_id ?? null,
    schoolYear: family.schoolYear ?? family.school_year ?? null,
  };
}

function missingTermError(quarter) {
  const label = Number(quarter) === 4 ? "Final Grade" : `Term ${quarter}`;
  return new Error(
    `${label} is not assigned yet. Ask the head teacher to set this class to All Terms, then upload the E-Class Record again.`
  );
}

export async function listSiblingTermClasses(client, family) {
  const { teacherId, subjectId, sectionId, schoolYear } = familyFilters(family);
  if (!teacherId || !subjectId || !sectionId || !schoolYear) {
    return { data: [], error: new Error("Class family is incomplete.") };
  }

  const { data, error } = await client
    .from("classes")
    .select("id, quarter, teacher_id, subject_id, section_id, school_year")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId)
    .eq("section_id", sectionId)
    .eq("school_year", schoolYear);

  return { data: data ?? [], error };
}

/**
 * Insert any missing Term 1–3 + Final rows for this teacher/subject/section/year.
 */
export async function ensureAllTermSiblingClasses(client, family) {
  const listed = await listSiblingTermClasses(client, family);
  if (listed.error) return { map: new Map(), created: [], error: listed.error };

  const map = new Map();
  for (const row of listed.data) {
    const q = Number(row.quarter);
    if (q >= 1 && q <= 4) map.set(q, row.id);
  }

  const created = [];
  const { teacherId, subjectId, sectionId, schoolYear } = familyFilters(family);

  for (const quarter of ALL_TERM_QUARTERS) {
    if (map.has(quarter)) continue;
    const { data, error } = await client
      .from("classes")
      .insert({
        teacher_id: teacherId,
        subject_id: subjectId,
        section_id: sectionId,
        school_year: schoolYear,
        quarter,
      })
      .select("id, quarter")
      .single();

    if (error || !data?.id) {
      return { map, created, error: missingTermError(quarter) };
    }
    map.set(quarter, data.id);
    created.push(data.id);
  }

  return { map, created, error: null };
}

/**
 * Copy `class_students` from the sibling with the largest roster onto the rest.
 */
export async function syncSiblingClassRosters(client, family) {
  const listed = await listSiblingTermClasses(client, family);
  if (listed.error) return { copied: 0, error: listed.error };

  const classIds = [...new Set((listed.data ?? []).map((row) => row.id).filter(Boolean))];
  if (classIds.length < 2) {
    return { copied: 0, error: null, classIds };
  }

  const { data: links, error: linkError } = await client
    .from("class_students")
    .select("class_id, student_id")
    .in("class_id", classIds);

  if (linkError) return { copied: 0, error: linkError, classIds };

  const byClass = new Map(classIds.map((id) => [id, new Set()]));
  for (const row of links ?? []) {
    const set = byClass.get(row.class_id);
    if (set && row.student_id) set.add(row.student_id);
  }

  let sourceId = classIds[0];
  let sourceSize = byClass.get(sourceId)?.size ?? 0;
  for (const id of classIds) {
    const size = byClass.get(id)?.size ?? 0;
    if (size > sourceSize) {
      sourceId = id;
      sourceSize = size;
    }
  }

  const sourceStudents = [...(byClass.get(sourceId) ?? [])];
  if (!sourceStudents.length) {
    return { copied: 0, error: null, classIds, sourceId };
  }

  const inserts = [];
  for (const targetId of classIds) {
    if (targetId === sourceId) continue;
    const existing = byClass.get(targetId) ?? new Set();
    for (const studentId of sourceStudents) {
      if (existing.has(studentId)) continue;
      inserts.push({ class_id: targetId, student_id: studentId });
    }
  }

  if (!inserts.length) {
    return { copied: 0, error: null, classIds, sourceId };
  }

  const { error: insertError } = await client.from("class_students").insert(inserts);
  if (insertError) return { copied: 0, error: insertError, classIds, sourceId };

  return { copied: inserts.length, error: null, classIds, sourceId };
}
