import { createClient } from "@/lib/supabase/client";
import { notifyLessonPlanStatus } from "@/lib/notifications/lessonPlanNotifications";

export const LESSON_PLAN_STATUSES = [
  "Pending Review",
  "Under Review",
  "Approved",
  "Needs Revision",
];

export const LESSON_PLAN_BUCKET = "lesson-plans";

const LESSON_PLAN_SELECT = `
  id,
  teacher_id,
  class_id,
  lesson_title,
  week_covered,
  learning_competency,
  school_year,
  quarter,
  file_name,
  file_path,
  file_size,
  file_type,
  status,
  submitted_at,
  updated_at,
  remarks,
  reviewed_by,
  reviewed_by_name,
  reviewed_at,
  reviewed_profile:profiles!reviewed_by (
    id,
    full_name,
    role
  ),
  teachers (
    id,
    first_name,
    middle_name,
    last_name,
    email
  ),
  classes (
    id,
    school_year,
    quarter,
    subject_id,
    section_id,
    subjects (
      id,
      subject_name,
      subject_code
    ),
    sections (
      id,
      section_name,
      grade_level,
      school_year
    )
  )
`;

/** Minimal select used if nested embeds fail (e.g. profiles RLS). */
const LESSON_PLAN_SELECT_BASIC = `
  id,
  teacher_id,
  class_id,
  lesson_title,
  week_covered,
  learning_competency,
  school_year,
  quarter,
  file_name,
  file_path,
  file_size,
  file_type,
  status,
  submitted_at,
  updated_at,
  remarks,
  reviewed_by,
  reviewed_by_name,
  reviewed_at,
  teachers (
    id,
    first_name,
    middle_name,
    last_name,
    email
  ),
  classes (
    id,
    school_year,
    quarter,
    subject_id,
    section_id,
    subjects (
      id,
      subject_name,
      subject_code
    ),
    sections (
      id,
      section_name,
      grade_level,
      school_year
    )
  )
`;

const LESSON_PLAN_EVENT_SELECT = `
  id,
  lesson_plan_id,
  event_type,
  actor_role,
  actor_name,
  remarks,
  created_at
`;

async function ensureAuthSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  return {
    supabase,
    session: data?.session ?? null,
    error,
  };
}

/**
 * The basic select has no profiles embed, so rows coming from the fallback path
 * would lose the reviewer name. Resolve it with a second lookup instead.
 */
async function hydrateReviewerProfiles(supabase, rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const missingIds = [
    ...new Set(
      list
        .filter((row) => row?.reviewed_by && !row.reviewed_profile)
        .map((row) => row.reviewed_by)
    ),
  ];

  if (!missingIds.length) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", missingIds);

  if (!profiles?.length) return rows;

  const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  list.forEach((row) => {
    if (row?.reviewed_by && !row.reviewed_profile) {
      row.reviewed_profile = byId.get(row.reviewed_by) ?? null;
    }
  });

  return rows;
}

function unwrapReviewerName(row) {
  const profile = Array.isArray(row?.reviewed_profile)
    ? row.reviewed_profile[0]
    : row?.reviewed_profile;
  return profile?.full_name ?? null;
}

function teacherNameFromRow(row) {
  const teacher = Array.isArray(row?.teachers) ? row.teachers[0] : row?.teachers;
  if (!teacher) return null;
  return (
    [teacher.first_name, teacher.middle_name, teacher.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || null
  );
}

/**
 * History is auxiliary — a failure here must never break the submit/review flow.
 */
async function recordLessonPlanEvent(supabase, event) {
  if (!event?.lessonPlanId || !event?.eventType) return;

  const { error } = await supabase.from("lesson_plan_events").insert({
    lesson_plan_id: event.lessonPlanId,
    event_type: event.eventType,
    actor_role: event.actorRole,
    actor_name: event.actorName ?? null,
    actor_profile_id: event.actorProfileId ?? null,
    remarks: event.remarks?.trim() ? event.remarks.trim() : null,
  });

  if (error) {
    console.warn(
      `[lesson_plans] failed to record "${event.eventType}" event`,
      error
    );
  }
}

export async function getLessonPlanEvents(lessonPlanId) {
  if (!lessonPlanId) {
    return { data: [], error: new Error("Lesson plan id is required.") };
  }

  const { supabase } = await ensureAuthSession();
  const { data, error } = await supabase
    .from("lesson_plan_events")
    .select(LESSON_PLAN_EVENT_SELECT)
    .eq("lesson_plan_id", lessonPlanId)
    .order("created_at", { ascending: true });

  return { data: data ?? [], error };
}

/**
 * Latest school-wide lesson plan events for Admin Review sidebar.
 */
export async function getRecentLessonPlanActivity(limit = 8) {
  const { supabase } = await ensureAuthSession();
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 30);

  const { data, error } = await supabase
    .from("lesson_plan_events")
    .select(
      `
      id,
      lesson_plan_id,
      event_type,
      actor_role,
      actor_name,
      remarks,
      created_at,
      lesson_plans (
        id,
        lesson_title,
        teachers (
          first_name,
          middle_name,
          last_name
        )
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  return { data: data ?? [], error };
}

function sanitizePathPart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);
}

export function buildLessonPlanStoragePath({
  teacherId,
  schoolYear,
  fileName,
}) {
  const safeYear = sanitizePathPart(schoolYear) || "school-year";
  const safeName = sanitizePathPart(fileName) || `lesson-${Date.now()}.pdf`;
  const unique = `${Date.now()}-${safeName}`;
  return `${teacherId}/${safeYear}/${unique}`;
}

export async function uploadLessonPlanFile({
  teacherId,
  schoolYear,
  file,
}) {
  if (!file) {
    return { data: null, error: new Error("Lesson plan file is required.") };
  }

  const { supabase } = await ensureAuthSession();
  const path = buildLessonPlanStoragePath({
    teacherId,
    schoolYear,
    fileName: file.name,
  });

  const { error } = await supabase.storage
    .from(LESSON_PLAN_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) return { data: null, error };

  return {
    data: {
      path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || file.name.split(".").pop()?.toLowerCase() || "file",
    },
    error: null,
  };
}

export async function getLessonPlanSignedUrl(filePath, expiresIn = 3600) {
  if (!filePath) {
    return { data: null, error: new Error("File path is required.") };
  }

  const { supabase } = await ensureAuthSession();
  const { data, error } = await supabase.storage
    .from(LESSON_PLAN_BUCKET)
    .createSignedUrl(filePath, expiresIn);

  return {
    data: data?.signedUrl ?? null,
    error,
  };
}

export async function getTeacherLessonPlans(teacherId) {
  if (!teacherId) {
    console.warn("[lesson_plans] getTeacherLessonPlans aborted: missing teacherId");
    return { data: [], error: new Error("Teacher id is required.") };
  }

  const { supabase, session, error: sessionError } = await ensureAuthSession();

  console.log("[lesson_plans] getTeacherLessonPlans:start", {
    teacherId,
    hasSession: Boolean(session),
    authUserId: session?.user?.id ?? null,
    sessionError: sessionError?.message ?? null,
  });

  if (!session) {
    return {
      data: [],
      error:
        sessionError ??
        new Error(
          "Not authenticated. Sign in again to load your lesson plans."
        ),
    };
  }

  let { data, error } = await supabase
    .from("lesson_plans")
    .select(LESSON_PLAN_SELECT)
    .eq("teacher_id", teacherId)
    .order("submitted_at", { ascending: false });

  // Nested profiles embed can fail under teacher RLS — retry without it.
  if (error) {
    console.warn("[lesson_plans] full select failed, retrying basic select", error);
    const retry = await supabase
      .from("lesson_plans")
      .select(LESSON_PLAN_SELECT_BASIC)
      .eq("teacher_id", teacherId)
      .order("submitted_at", { ascending: false });
    data = retry.data;
    error = retry.error;
  }

  await hydrateReviewerProfiles(supabase, data);

  console.log("[lesson_plans] getTeacherLessonPlans:result", {
    teacherId,
    error: error?.message ?? null,
    count: data?.length ?? 0,
    rows: (data ?? []).map((row) => ({
      id: row.id,
      teacher_id: row.teacher_id,
      class_id: row.class_id,
      school_year: row.school_year,
      quarter: row.quarter,
      status: row.status,
      lesson_title: row.lesson_title,
      submitted_at: row.submitted_at,
    })),
  });

  return { data: data ?? [], error };
}

export async function getLessonPlanById(id, { teacherId = null } = {}) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }

  const { supabase } = await ensureAuthSession();
  let query = supabase
    .from("lesson_plans")
    .select(LESSON_PLAN_SELECT)
    .eq("id", id);

  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }

  let { data, error } = await query.maybeSingle();

  if (error) {
    let fallback = supabase
      .from("lesson_plans")
      .select(LESSON_PLAN_SELECT_BASIC)
      .eq("id", id);
    if (teacherId) fallback = fallback.eq("teacher_id", teacherId);
    const retry = await fallback.maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  await hydrateReviewerProfiles(supabase, data);

  return { data, error };
}

export async function getAllLessonPlansForReview({
  schoolYear = null,
  quarter = null,
} = {}) {
  const { supabase } = await ensureAuthSession();
  let query = supabase
    .from("lesson_plans")
    .select(LESSON_PLAN_SELECT)
    .order("submitted_at", { ascending: false });

  if (schoolYear && schoolYear !== "All School Years") {
    query = query.eq("school_year", schoolYear);
  }
  if (
    quarter !== null &&
    quarter !== undefined &&
    quarter !== "" &&
    quarter !== "All Terms"
  ) {
    const quarterNumber = Number(String(quarter).replace(/\D/g, ""));
    if (quarterNumber) query = query.eq("quarter", quarterNumber);
  }

  let { data, error } = await query;

  if (error) {
    let retry = supabase
      .from("lesson_plans")
      .select(LESSON_PLAN_SELECT_BASIC)
      .order("submitted_at", { ascending: false });
    if (schoolYear && schoolYear !== "All School Years") {
      retry = retry.eq("school_year", schoolYear);
    }
    if (
      quarter !== null &&
      quarter !== undefined &&
      quarter !== "" &&
      quarter !== "All Terms"
    ) {
      const quarterNumber = Number(String(quarter).replace(/\D/g, ""));
      if (quarterNumber) retry = retry.eq("quarter", quarterNumber);
    }
    const result = await retry;
    data = result.data;
    error = result.error;
  }

  await hydrateReviewerProfiles(supabase, data);

  return { data: data ?? [], error };
}

export async function createLessonPlan(payload) {
  const { supabase } = await ensureAuthSession();
  const row = {
    teacher_id: payload.teacher_id,
    class_id: payload.class_id,
    lesson_title: payload.lesson_title,
    week_covered: payload.week_covered,
    learning_competency: payload.learning_competency || null,
    school_year: payload.school_year,
    quarter: Number(payload.quarter),
    file_name: payload.file_name,
    file_path: payload.file_path,
    file_size: Number(payload.file_size),
    file_type: payload.file_type,
    status: payload.status || "Pending Review",
    submitted_at: payload.submitted_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log("[lesson_plans] createLessonPlan:payload", {
    teacher_id: row.teacher_id,
    class_id: row.class_id,
    school_year: row.school_year,
    quarter: row.quarter,
    status: row.status,
    lesson_title: row.lesson_title,
  });

  const { data, error } = await supabase
    .from("lesson_plans")
    .insert(row)
    .select(LESSON_PLAN_SELECT_BASIC)
    .single();

  console.log("[lesson_plans] createLessonPlan:result", {
    error: error?.message ?? null,
    id: data?.id ?? null,
    teacher_id: data?.teacher_id ?? null,
    status: data?.status ?? null,
  });

  if (!error && data?.id) {
    await recordLessonPlanEvent(supabase, {
      lessonPlanId: data.id,
      eventType: "Submitted",
      actorRole: "teacher",
      actorName: teacherNameFromRow(data),
    });
  }

  return { data, error };
}

export async function reviewLessonPlan({
  id,
  status,
  remarks,
  reviewedBy,
  reviewerName = null,
}) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }

  if (!["Approved", "Needs Revision"].includes(status)) {
    return {
      data: null,
      error: new Error("Invalid review status."),
    };
  }

  if (status === "Needs Revision" && !String(remarks ?? "").trim()) {
    return {
      data: null,
      error: new Error("Remarks are required when requesting revision."),
    };
  }

  const { supabase } = await ensureAuthSession();
  const resolvedReviewerName =
    String(reviewerName ?? "").trim() || "Head Teacher";
  const updatePayload = {
    status,
    remarks:
      status === "Needs Revision"
        ? String(remarks).trim()
        : remarks?.trim()
          ? String(remarks).trim()
          : null,
    reviewed_by: reviewedBy ?? null,
    reviewed_by_name: resolvedReviewerName,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("lesson_plans")
    .update(updatePayload)
    .eq("id", id)
    .select(LESSON_PLAN_SELECT)
    .single();

  if (error) {
    const retry = await supabase
      .from("lesson_plans")
      .update(updatePayload)
      .eq("id", id)
      .select(LESSON_PLAN_SELECT_BASIC)
      .single();
    data = retry.data;
    error = retry.error;
  }

  await hydrateReviewerProfiles(supabase, data);

  if (!error && data?.id) {
    await recordLessonPlanEvent(supabase, {
      lessonPlanId: data.id,
      eventType: status,
      actorRole: "admin",
      actorName: resolvedReviewerName,
      actorProfileId: reviewedBy ?? null,
      remarks: updatePayload.remarks,
    });

    await notifyLessonPlanStatus({
      plan: data,
      status,
      remarks: updatePayload.remarks,
      actorProfileId: reviewedBy ?? null,
    });
  }

  return { data, error };
}

/**
 * First open of a Pending Review plan → Under Review.
 * Does not set reviewed_at / remarks.
 */
export async function markLessonPlanUnderReview(id, actor = {}) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }

  const { supabase } = await ensureAuthSession();
  let { data, error } = await supabase
    .from("lesson_plans")
    .update({
      status: "Under Review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "Pending Review")
    .select(LESSON_PLAN_SELECT)
    .maybeSingle();

  if (error) {
    const retry = await supabase
      .from("lesson_plans")
      .update({
        status: "Under Review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "Pending Review")
      .select(LESSON_PLAN_SELECT_BASIC)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  await hydrateReviewerProfiles(supabase, data);

  // data is null when the plan was already past Pending Review — no transition, no event.
  if (!error && data?.id) {
    await recordLessonPlanEvent(supabase, {
      lessonPlanId: data.id,
      eventType: "Under Review",
      actorRole: "admin",
      actorName: actor.actorName ?? null,
      actorProfileId: actor.actorProfileId ?? null,
    });

    await notifyLessonPlanStatus({
      plan: data,
      status: "Under Review",
      actorProfileId: actor.actorProfileId ?? null,
    });
  }

  return { data, error };
}

/**
 * Teacher resubmits a revised file for the same lesson plan record.
 */
export async function resubmitLessonPlan({
  id,
  teacherId,
  schoolYear,
  file,
  previousFilePath = null,
}) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }
  if (!file) {
    return { data: null, error: new Error("A revised lesson plan file is required.") };
  }

  const upload = await uploadLessonPlanFile({
    teacherId,
    schoolYear,
    file,
  });
  if (upload.error) return { data: null, error: upload.error };

  const { supabase } = await ensureAuthSession();
  const updatePayload = {
    file_name: upload.data.file_name,
    file_path: upload.data.path,
    file_size: upload.data.file_size,
    file_type: upload.data.file_type,
    status: "Pending Review",
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    remarks: null,
    updated_at: new Date().toISOString(),
    submitted_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("lesson_plans")
    .update(updatePayload)
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .eq("status", "Needs Revision")
    .select(LESSON_PLAN_SELECT)
    .single();

  if (error) {
    const retry = await supabase
      .from("lesson_plans")
      .update(updatePayload)
      .eq("id", id)
      .eq("teacher_id", teacherId)
      .eq("status", "Needs Revision")
      .select(LESSON_PLAN_SELECT_BASIC)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (!error && data?.id) {
    await recordLessonPlanEvent(supabase, {
      lessonPlanId: data.id,
      eventType: "Resubmitted",
      actorRole: "teacher",
      actorName: teacherNameFromRow(data),
    });
  }

  if (!error && previousFilePath && previousFilePath !== upload.data.path) {
    await supabase.storage.from(LESSON_PLAN_BUCKET).remove([previousFilePath]);
  }

  return { data, error };
}

/**
 * Subject teacher deletes their own lesson plan (row + storage object).
 * Events cascade via FK on delete.
 */
export async function deleteTeacherLessonPlan({ id, teacherId }) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }

  const { supabase } = await ensureAuthSession();

  const { data: existing, error: loadError } = await supabase
    .from("lesson_plans")
    .select("id, teacher_id, file_path, lesson_title")
    .eq("id", id)
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (loadError) return { data: null, error: loadError };
  if (!existing) {
    return {
      data: null,
      error: new Error("Lesson plan not found or you do not own this plan."),
    };
  }

  const { error: deleteError } = await supabase
    .from("lesson_plans")
    .delete()
    .eq("id", id)
    .eq("teacher_id", teacherId);

  if (deleteError) return { data: null, error: deleteError };

  if (existing.file_path) {
    const { error: storageError } = await supabase.storage
      .from(LESSON_PLAN_BUCKET)
      .remove([existing.file_path]);
    if (storageError) {
      console.warn(
        "[lesson_plans] storage cleanup after delete:",
        storageError.message
      );
    }
  }

  return {
    data: { id: existing.id, lesson_title: existing.lesson_title },
    error: null,
  };
}
