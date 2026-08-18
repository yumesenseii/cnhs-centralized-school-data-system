import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { getCurrentProfile } from "@/lib/supabase/queries/notifications";
import { deleteClassAssignment } from "@/lib/supabase/queries/classAssignments";
import { clearGradesForClass } from "@/lib/supabase/queries/classGrades";
import { deleteLessonPlanAsAdmin } from "@/lib/supabase/queries/lessonPlans";
import {
  notifyDeleteRequestCreated,
  notifyDeleteRequestReviewed,
} from "@/lib/notifications/deleteRequestNotifications";
import { invalidateAdminRosterCache } from "@/lib/admin/adminRosterCache";

const supabase = createClient();

const SELECT = `
  id,
  requester_teacher_id,
  requester_profile_id,
  target_type,
  target_id,
  label,
  status,
  reviewed_by,
  reviewed_at,
  created_at,
  teachers (
    id,
    first_name,
    middle_name,
    last_name
  )
`;

export const DELETE_REQUEST_TYPES = {
  CLASS: "class",
  ECR: "ecr",
  LESSON_PLAN: "lesson_plan",
};

function missingTableError(error) {
  const message = String(error?.message ?? "");
  const code = String(error?.code ?? "");
  if (code === "42P01" || /delete_requests/i.test(message) || /schema cache/i.test(message)) {
    return new Error(
      "Delete requests are not set up yet. Run supabase/migrations/018_delete_requests.sql on the database."
    );
  }
  return error;
}

function teacherName(row) {
  const t = Array.isArray(row?.teachers) ? row.teachers[0] : row?.teachers;
  if (!t) return "Teacher";
  return [t.first_name, t.middle_name, t.last_name].filter(Boolean).join(" ").trim();
}

export function mapDeleteRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    teacherId: row.requester_teacher_id,
    teacherName: teacherName(row),
    targetType: row.target_type,
    targetId: row.target_id,
    label: row.label || "Item",
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createDeleteRequest({
  targetType,
  targetId,
  label,
} = {}) {
  const session = await getCurrentTeacherSession();
  if (session.error || !session.data) {
    return { data: null, error: session.error ?? new Error("Teacher session required.") };
  }

  const type = String(targetType || "").trim();
  const id = String(targetId || "").trim();
  if (!["class", "ecr", "lesson_plan"].includes(type) || !id) {
    return { data: null, error: new Error("A class, ECR, or lesson plan is required.") };
  }

  const profile = await getCurrentProfile();
  const { data, error } = await supabase
    .from("delete_requests")
    .insert({
      requester_teacher_id: session.data.teacherId,
      requester_profile_id: profile.data?.id ?? null,
      target_type: type,
      target_id: id,
      label: String(label || "").trim() || "Item",
      status: "pending",
    })
    .select(SELECT)
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message || "")) {
      return {
        data: null,
        error: new Error("A delete request for this item is already pending."),
      };
    }
    return { data: null, error: missingTableError(error) };
  }

  await notifyDeleteRequestCreated({
    request: data,
    actorProfileId: profile.data?.id ?? null,
  });

  return { data: mapDeleteRequest(data), error: null };
}

export async function listPendingDeleteRequests() {
  const auth = await requireAdmin("review delete requests");
  if (!auth.ok) return { data: [], error: auth.error };

  const { data, error } = await supabase
    .from("delete_requests")
    .select(SELECT)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: missingTableError(error) };
  return { data: (data ?? []).map(mapDeleteRequest), error: null };
}

export async function rejectDeleteRequest(requestId) {
  const auth = await requireAdmin("review delete requests");
  if (!auth.ok) return { data: null, error: auth.error };

  const { data, error } = await supabase
    .from("delete_requests")
    .update({
      status: "rejected",
      reviewed_by: auth.profile?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select(SELECT)
    .maybeSingle();

  if (error) return { data: null, error: missingTableError(error) };
  if (!data) {
    return { data: null, error: new Error("This request is no longer pending.") };
  }

  await notifyDeleteRequestReviewed({
    request: data,
    approved: false,
    actorProfileId: auth.profile?.id ?? null,
  });

  return { data: mapDeleteRequest(data), error: null };
}

export async function approveDeleteRequest(requestId) {
  const auth = await requireAdmin("review delete requests");
  if (!auth.ok) return { data: null, error: auth.error };

  const loaded = await supabase
    .from("delete_requests")
    .select(SELECT)
    .eq("id", requestId)
    .eq("status", "pending")
    .maybeSingle();

  if (loaded.error) return { data: null, error: missingTableError(loaded.error) };
  if (!loaded.data) {
    return { data: null, error: new Error("This request is no longer pending.") };
  }

  const row = loaded.data;
  let action = { error: null };
  if (row.target_type === "class") {
    action = await deleteClassAssignment(row.target_id);
  } else if (row.target_type === "ecr") {
    action = await clearGradesForClass(row.target_id);
  } else if (row.target_type === "lesson_plan") {
    action = await deleteLessonPlanAsAdmin(row.target_id);
  } else {
    action = { error: new Error("Unknown delete request type.") };
  }

  if (action.error) return { data: null, error: action.error };

  const { data, error } = await supabase
    .from("delete_requests")
    .update({
      status: "approved",
      reviewed_by: auth.profile?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select(SELECT)
    .maybeSingle();

  if (error) return { data: null, error: missingTableError(error) };

  invalidateAdminRosterCache();
  await notifyDeleteRequestReviewed({
    request: data ?? row,
    approved: true,
    actorProfileId: auth.profile?.id ?? null,
  });

  return { data: mapDeleteRequest(data ?? row), error: null };
}
