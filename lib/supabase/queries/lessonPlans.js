import { createClient } from "@/lib/supabase/client";
import {
  notifyLessonPlanStatus,
  notifyLessonPlanSubmitted,
} from "@/lib/notifications/lessonPlanNotifications";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import { getCurrentProfile } from "@/lib/supabase/queries/notifications";

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
  section_remarks,
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
  section_remarks,
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
  section_remarks,
  created_at
`;

/** Legacy fallback selects used if section_remarks column does not exist yet on remote DB */
const LESSON_PLAN_SELECT_LEGACY = `
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

const LESSON_PLAN_SELECT_BASIC_LEGACY = `
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

const LESSON_PLAN_EVENT_SELECT_LEGACY = `
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

  const insertPayload = {
    lesson_plan_id: event.lessonPlanId,
    event_type: event.eventType,
    actor_role: event.actorRole,
    actor_name: event.actorName ?? null,
    actor_profile_id: event.actorProfileId ?? null,
    remarks: event.remarks?.trim() ? event.remarks.trim() : null,
  };

  if (Array.isArray(event.sectionRemarks)) {
    insertPayload.section_remarks = event.sectionRemarks;
  }

  let { error } = await supabase.from("lesson_plan_events").insert(insertPayload);

  if (error && insertPayload.section_remarks) {
    delete insertPayload.section_remarks;
    const retry = await supabase.from("lesson_plan_events").insert(insertPayload);
    error = retry.error;
  }

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
  let { data, error } = await supabase
    .from("lesson_plan_events")
    .select(LESSON_PLAN_EVENT_SELECT)
    .eq("lesson_plan_id", lessonPlanId)
    .order("created_at", { ascending: true });

  if (error) {
    const retry = await supabase
      .from("lesson_plan_events")
      .select(LESSON_PLAN_EVENT_SELECT_LEGACY)
      .eq("lesson_plan_id", lessonPlanId)
      .order("created_at", { ascending: true });
    data = retry.data;
    error = retry.error;
  }

  return { data: data ?? [], error };
}

const LESSON_PLAN_ACTIVITY_SELECT = `
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
    teacher_id,
    teachers (
      first_name,
      middle_name,
      last_name
    )
  )
`;

/**
 * Latest school-wide lesson plan events for Admin Review sidebar.
 */
export async function getRecentLessonPlanActivity(limit = 5) {
  const { supabase } = await ensureAuthSession();
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 5);

  const { data, error } = await supabase
    .from("lesson_plan_events")
    .select(LESSON_PLAN_ACTIVITY_SELECT)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  return { data: data ?? [], error };
}

/**
 * Latest lesson plan events for the signed-in teacher's own plans.
 */
export async function getRecentLessonPlanActivityForTeacher(limit = 5) {
  const { supabase } = await ensureAuthSession();
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 5);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { data: [], error: userError ?? new Error("Not authenticated.") };
  }

  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherError) return { data: [], error: teacherError };
  if (!teacher?.id) return { data: [], error: null };

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
      lesson_plans!inner (
        id,
        lesson_title,
        teacher_id,
        teachers (
          first_name,
          middle_name,
          last_name
        )
      )
    `
    )
    .eq("lesson_plans.teacher_id", teacher.id)
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

async function executeLessonPlanSelectQuery(buildQueryFn) {
  const { supabase } = await ensureAuthSession();

  // 1. Try full select (includes profiles embed and section_remarks)
  let { data, error } = await buildQueryFn(
    supabase.from("lesson_plans").select(LESSON_PLAN_SELECT)
  );

  // 2. Try basic select (no profiles embed, includes section_remarks)
  if (error) {
    const retryBasic = await buildQueryFn(
      supabase.from("lesson_plans").select(LESSON_PLAN_SELECT_BASIC)
    );
    data = retryBasic.data;
    error = retryBasic.error;
  }

  // 3. Try legacy full select (no section_remarks, includes profiles embed)
  if (error) {
    const retryLegacy = await buildQueryFn(
      supabase.from("lesson_plans").select(LESSON_PLAN_SELECT_LEGACY)
    );
    data = retryLegacy.data;
    error = retryLegacy.error;
  }

  // 4. Try legacy basic select (no section_remarks, no profiles embed)
  if (error) {
    const retryLegacyBasic = await buildQueryFn(
      supabase.from("lesson_plans").select(LESSON_PLAN_SELECT_BASIC_LEGACY)
    );
    data = retryLegacyBasic.data;
    error = retryLegacyBasic.error;
  }

  // Ensure every row has section_remarks as an array
  if (Array.isArray(data)) {
    data.forEach((row) => {
      if (!Array.isArray(row.section_remarks)) {
        row.section_remarks = [];
      }
    });
  } else if (data && typeof data === "object") {
    if (!Array.isArray(data.section_remarks)) {
      data.section_remarks = [];
    }
  }

  await hydrateReviewerProfiles(supabase, data);
  return { data, error };
}

export async function getTeacherLessonPlans(teacherId) {
  if (!teacherId) {
    return {
      data: [],
      error: new Error("Teacher id is required to load lesson plans."),
    };
  }

  const { session, error: sessionError } = await ensureAuthSession();
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

  const { data, error } = await executeLessonPlanSelectQuery((base) =>
    base.eq("teacher_id", teacherId).order("submitted_at", { ascending: false })
  );

  console.log("[lesson_plans] getTeacherLessonPlans:result", {
    teacherId,
    error: error?.message ?? null,
    count: data?.length ?? 0,
  });

  return { data: data ?? [], error };
}

export async function getLessonPlanById(id, { teacherId = null } = {}) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }

  const { data, error } = await executeLessonPlanSelectQuery((base) => {
    let q = base.eq("id", id);
    if (teacherId) q = q.eq("teacher_id", teacherId);
    return q.maybeSingle();
  });

  return { data, error };
}

export async function getAllLessonPlansForReview({
  schoolYear = null,
  quarter = null,
} = {}) {
  const { data, error } = await executeLessonPlanSelectQuery((base) => {
    let query = base.order("submitted_at", { ascending: false });
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
    return query;
  });

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

  let { data, error } = await supabase
    .from("lesson_plans")
    .insert(row)
    .select(LESSON_PLAN_SELECT_BASIC)
    .single();

  if (error) {
    const retryLegacy = await supabase
      .from("lesson_plans")
      .insert(row)
      .select(LESSON_PLAN_SELECT_BASIC_LEGACY)
      .single();
    data = retryLegacy.data;
    error = retryLegacy.error;
  }

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

    const actor = await getCurrentProfile();
    await notifyLessonPlanSubmitted({
      plan: data,
      kind: "submitted",
      actorProfileId: actor.data?.id ?? null,
      stamp: String(data.submitted_at || Date.now()),
      teacherDisplayName: teacherNameFromRow(data) || actor.data?.full_name,
    });
  }

  return { data, error };
}

export async function reviewLessonPlan({
  id,
  status,
  remarks,
  sectionRemarks = [],
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

  const sanitizedRemarks = String(remarks ?? "").trim();
  const hasSectionRemarks = Array.isArray(sectionRemarks) && sectionRemarks.length > 0;

  if (status === "Needs Revision" && !sanitizedRemarks && !hasSectionRemarks) {
    return {
      data: null,
      error: new Error("Remarks or section comments are required when requesting revision."),
    };
  }

  // Construct a comprehensive structured summary if section remarks exist
  const structuredRemarksString = Array.isArray(sectionRemarks) && sectionRemarks.length > 0
    ? sectionRemarks
        .filter((r) => r.comment)
        .map(
          (r) =>
            `[${r.severity || "Needs Revision"}][${r.sectionTitle || "Section"}] ${
              r.highlightedText ? `"${r.highlightedText}": ` : ""
            }${r.comment}`
        )
        .join("; ")
    : null;

  const effectiveRemarks = sanitizedRemarks
    ? (structuredRemarksString ? `${sanitizedRemarks} — ${structuredRemarksString}` : sanitizedRemarks)
    : structuredRemarksString;

  const { supabase } = await ensureAuthSession();
  const resolvedReviewerName =
    String(reviewerName ?? "").trim() || "Principal";

  const updatePayload = {
    status,
    remarks: effectiveRemarks,
    section_remarks: Array.isArray(sectionRemarks) ? sectionRemarks : [],
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
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.section_remarks;
    const retry = await supabase
      .from("lesson_plans")
      .update(fallbackPayload)
      .eq("id", id)
      .select(LESSON_PLAN_SELECT_LEGACY)
      .single();
    if (!retry.error) {
      data = retry.data;
      error = null;
    } else {
      const retryBasic = await supabase
        .from("lesson_plans")
        .update(fallbackPayload)
        .eq("id", id)
        .select(LESSON_PLAN_SELECT_BASIC_LEGACY)
        .single();
      data = retryBasic.data;
      error = retryBasic.error;
    }
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
      sectionRemarks: updatePayload.section_remarks,
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
 * Save draft section remarks in real-time while Principal is reading/reviewing.
 */
export async function saveLessonPlanSectionRemarks({ id, sectionRemarks = [] }) {
  if (!id) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }

  const structuredRemarksString = Array.isArray(sectionRemarks) && sectionRemarks.length > 0
    ? sectionRemarks
        .filter((r) => r.comment)
        .map(
          (r) =>
            `[${r.severity || "Needs Revision"}][${r.sectionTitle || "Section"}] ${
              r.highlightedText ? `"${r.highlightedText}": ` : ""
            }${r.comment}`
        )
        .join("; ")
    : null;

  const { supabase } = await ensureAuthSession();
  const updatePayload = {
    section_remarks: Array.isArray(sectionRemarks) ? sectionRemarks : [],
    remarks: structuredRemarksString,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("lesson_plans")
    .update(updatePayload)
    .eq("id", id)
    .select(LESSON_PLAN_SELECT)
    .single();

  if (error) {
    // If section_remarks JSON column doesn't exist, update fallback remarks column
    const fallbackPayload = {
      remarks: structuredRemarksString,
      updated_at: new Date().toISOString(),
    };
    const retry = await supabase
      .from("lesson_plans")
      .update(fallbackPayload)
      .eq("id", id)
      .select(LESSON_PLAN_SELECT_BASIC)
      .single();
    data = retry.data;
    error = retry.error;
  }

  await hydrateReviewerProfiles(supabase, data);
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
      actorName: actor.actorName ?? "Principal",
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
  revisionNote = null,
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

  // Fetch current section remarks to preserve and mark open remarks as addressed
  let existingSectionRemarks = [];
  try {
    const { data: currentPlan } = await supabase
      .from("lesson_plans")
      .select("section_remarks")
      .eq("id", id)
      .single();
    if (Array.isArray(currentPlan?.section_remarks)) {
      existingSectionRemarks = currentPlan.section_remarks.map((r) => ({
        ...r,
        status: r.status === "open" ? "addressed" : r.status,
      }));
    }
  } catch (err) {
    console.warn("[lesson_plans] failed to fetch existing section_remarks", err);
  }

  const updatePayload = {
    file_name: upload.data.file_name,
    file_path: upload.data.path,
    file_size: upload.data.file_size,
    file_type: upload.data.file_type,
    status: "Pending Review",
    section_remarks: existingSectionRemarks,
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    remarks: revisionNote?.trim() ? `Revision Note: ${revisionNote.trim()}` : null,
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
    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.section_remarks;
    const retryLegacy = await supabase
      .from("lesson_plans")
      .update(fallbackPayload)
      .eq("id", id)
      .eq("teacher_id", teacherId)
      .eq("status", "Needs Revision")
      .select(LESSON_PLAN_SELECT_LEGACY)
      .single();
    if (!retryLegacy.error) {
      data = retryLegacy.data;
      error = null;
    } else {
      const retryBasic = await supabase
        .from("lesson_plans")
        .update(fallbackPayload)
        .eq("id", id)
        .eq("teacher_id", teacherId)
        .eq("status", "Needs Revision")
        .select(LESSON_PLAN_SELECT_BASIC_LEGACY)
        .single();
      data = retryBasic.data;
      error = retryBasic.error;
    }
  }

  if (!error && data?.id) {
    await recordLessonPlanEvent(supabase, {
      lessonPlanId: data.id,
      eventType: "Resubmitted",
      actorRole: "teacher",
      actorName: teacherNameFromRow(data),
      remarks: revisionNote?.trim() || "Resubmitted revised lesson plan.",
      sectionRemarks: existingSectionRemarks,
    });

    const actor = await getCurrentProfile();
    await notifyLessonPlanSubmitted({
      plan: data,
      kind: "resubmitted",
      actorProfileId: actor.data?.id ?? null,
      stamp: String(data.submitted_at || Date.now()),
      teacherDisplayName: teacherNameFromRow(data) || actor.data?.full_name,
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

/** Head Teacher deletes a lesson plan after approving a teacher request. */
export async function deleteLessonPlanAsAdmin(id) {
  const auth = await requireAdmin("delete lesson plan");
  if (!auth.ok) return { data: null, error: auth.error };

  const planId = String(id ?? "").trim();
  if (!planId) {
    return { data: null, error: new Error("Lesson plan id is required.") };
  }

  const { supabase } = await ensureAuthSession();
  const { data: existing, error: loadError } = await supabase
    .from("lesson_plans")
    .select("id, file_path, lesson_title")
    .eq("id", planId)
    .maybeSingle();

  if (loadError) return { data: null, error: loadError };
  if (!existing) {
    return { data: null, error: new Error("Lesson plan not found.") };
  }

  const { error: deleteError } = await supabase
    .from("lesson_plans")
    .delete()
    .eq("id", planId);

  if (deleteError) return { data: null, error: deleteError };

  if (existing.file_path) {
    await supabase.storage.from(LESSON_PLAN_BUCKET).remove([existing.file_path]);
  }

  return {
    data: { id: existing.id, lesson_title: existing.lesson_title },
    error: null,
  };
}

let lessonPlanChannelSequence = 0;

/**
 * Realtime: any change to lesson_plans or lesson_plan_events.
 * Used by Admin Lesson Plan Review for soft live refresh.
 */
export function subscribeToLessonPlanReviewChanges(onChange) {
  if (typeof window === "undefined") return () => {};

  lessonPlanChannelSequence += 1;
  const supabase = createClient();
  const channel = supabase
    .channel(`lesson-plan-review:${lessonPlanChannelSequence}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lesson_plans" },
      (payload) => onChange?.(payload)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "lesson_plan_events" },
      (payload) => onChange?.(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Realtime for a teacher's own lesson_plans rows (status changes while page open).
 */
export function subscribeToTeacherLessonPlans(teacherId, onChange) {
  if (!teacherId || typeof window === "undefined") return () => {};

  lessonPlanChannelSequence += 1;
  const supabase = createClient();
  const channel = supabase
    .channel(`lesson-plans-teacher:${teacherId}:${lessonPlanChannelSequence}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "lesson_plans",
        filter: `teacher_id=eq.${teacherId}`,
      },
      (payload) => onChange?.(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
