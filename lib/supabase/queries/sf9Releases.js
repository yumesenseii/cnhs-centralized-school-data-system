import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

/**
 * Fetch all SF9 release tracking records for an entire advisory section.
 * Returns a Map or lookup dictionary keyed by student_id.
 */
export async function getSectionSf9Releases(sectionId, schoolYear) {
  if (!sectionId) return { data: {}, error: null };

  try {
    let query = supabase
      .from("sf9_releases")
      .select(`
        id,
        student_id,
        section_id,
        school_year,
        version,
        status,
        is_current_release,
        validation_summary,
        reviewed_at,
        reviewed_by,
        released_at,
        released_by,
        created_at,
        updated_at
      `)
      .eq("section_id", sectionId);

    if (schoolYear) {
      query = query.eq("school_year", schoolYear);
    }

    const { data, error } = await query.order("version", { ascending: false });

    if (error) {
      console.error("[getSectionSf9Releases] Error:", error);
      return { data: {}, error };
    }

    // Keep the latest version per student
    const releasesByStudent = {};
    (data || []).forEach((row) => {
      if (!releasesByStudent[row.student_id]) {
        releasesByStudent[row.student_id] = row;
      }
    });

    return { data: releasesByStudent, error: null };
  } catch (err) {
    console.error("[getSectionSf9Releases] Unexpected exception:", err);
    return { data: {}, error: err };
  }
}

/**
 * Fetch latest SF9 release record for a specific learner.
 */
export async function getLearnerSf9Release(studentId, schoolYear) {
  if (!studentId) return { data: null, error: null };

  try {
    let query = supabase
      .from("sf9_releases")
      .select("*")
      .eq("student_id", studentId);

    if (schoolYear) {
      query = query.eq("school_year", schoolYear);
    }

    const { data, error } = await query
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Mark SF9 status (draft -> ready_for_review -> completed).
 */
export async function updateSf9Status({
  studentId,
  sectionId,
  schoolYear,
  status,
  snapshotData = {},
  validationSummary = {},
  userId = null,
}) {
  if (!studentId || !sectionId) {
    throw new Error("Student ID and Section ID are required.");
  }

  const effectiveSY = schoolYear || "SY 2026-2027";

  // Check existing latest record
  const { data: existing } = await supabase
    .from("sf9_releases")
    .select("id, version, status, is_current_release")
    .eq("student_id", studentId)
    .eq("school_year", effectiveSY)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const updatePayload = {
    status,
    snapshot_data: snapshotData,
    validation_summary: validationSummary,
    updated_at: now,
  };

  if (status === "ready_for_review" || status === "completed") {
    updatePayload.reviewed_at = now;
    if (userId) updatePayload.reviewed_by = userId;
  }

  if (existing) {
    // If currently released and changes require new review, bump version
    if (existing.status === "released" && status !== "released") {
      const nextVersion = (existing.version || 1) + 1;
      const { data: newRow, error: insErr } = await supabase
        .from("sf9_releases")
        .insert({
          student_id: studentId,
          section_id: sectionId,
          school_year: effectiveSY,
          version: nextVersion,
          status,
          is_current_release: false,
          snapshot_data: snapshotData,
          validation_summary: validationSummary,
          reviewed_at: updatePayload.reviewed_at,
          reviewed_by: updatePayload.reviewed_by,
        })
        .select()
        .single();

      if (insErr) throw insErr;
      return { data: newRow, error: null };
    }

    const { data: updated, error: updErr } = await supabase
      .from("sf9_releases")
      .update(updatePayload)
      .eq("id", existing.id)
      .select()
      .single();

    if (updErr) throw updErr;
    return { data: updated, error: null };
  } else {
    // Create first version
    const { data: created, error: insErr } = await supabase
      .from("sf9_releases")
      .insert({
        student_id: studentId,
        section_id: sectionId,
        school_year: effectiveSY,
        version: 1,
        status,
        is_current_release: false,
        snapshot_data: snapshotData,
        validation_summary: validationSummary,
        reviewed_at: updatePayload.reviewed_at,
        reviewed_by: updatePayload.reviewed_by,
      })
      .select()
      .single();

    if (insErr) throw insErr;
    return { data: created, error: null };
  }
}

/**
 * Explicitly release the SF9 report card so it becomes available in the Student Portal.
 */
export async function releaseSf9ReportCard({
  studentId,
  sectionId,
  schoolYear,
  snapshotData = {},
  validationSummary = {},
  userId = null,
}) {
  if (!studentId || !sectionId) {
    throw new Error("Student ID and Section ID are required to release SF9.");
  }

  const effectiveSY = schoolYear || "SY 2026-2027";
  const now = new Date().toISOString();

  // Find latest record
  const { data: existing } = await supabase
    .from("sf9_releases")
    .select("id, version")
    .eq("student_id", studentId)
    .eq("school_year", effectiveSY)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Reset any other version of this student's SF9 for this SY from being current
  await supabase
    .from("sf9_releases")
    .update({ is_current_release: false })
    .eq("student_id", studentId)
    .eq("school_year", effectiveSY);

  const payload = {
    status: "released",
    is_current_release: true,
    released_at: now,
    released_by: userId,
    reviewed_at: now,
    reviewed_by: userId,
    snapshot_data: snapshotData,
    validation_summary: validationSummary,
    updated_at: now,
  };

  if (existing) {
    const { data: updated, error } = await supabase
      .from("sf9_releases")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return { data: updated, error: null };
  } else {
    const { data: created, error } = await supabase
      .from("sf9_releases")
      .insert({
        student_id: studentId,
        section_id: sectionId,
        school_year: effectiveSY,
        version: 1,
        ...payload,
      })
      .select()
      .single();

    if (error) throw error;
    return { data: created, error: null };
  }
}

/**
 * Student Portal: Query officially released SF9 for the logged-in student.
 * Strictly filters on status = 'released' and is_current_release = true.
 */
export async function getStudentPortalReleasedSf9(studentId, schoolYear = null) {
  if (!studentId) return { data: null, error: null };

  try {
    let query = supabase
      .from("sf9_releases")
      .select(`
        id,
        student_id,
        section_id,
        school_year,
        version,
        status,
        is_current_release,
        snapshot_data,
        released_at,
        sections:section_id (
          id,
          section_name,
          grade_level,
          school_year
        )
      `)
      .eq("student_id", studentId)
      .eq("status", "released")
      .eq("is_current_release", true);

    if (schoolYear) {
      query = query.eq("school_year", schoolYear);
    }

    const { data, error } = await query
      .order("released_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[getStudentPortalReleasedSf9] Error:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
