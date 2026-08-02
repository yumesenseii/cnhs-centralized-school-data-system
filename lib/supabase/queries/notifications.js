import { createClient } from "@/lib/supabase/client";
import { NOTIFICATION_PRIORITY } from "@/lib/notifications/notificationConstants";

const supabase = createClient();

const NOTIFICATION_SELECT = `
  id,
  recipient_profile_id,
  actor_profile_id,
  notification_type,
  title,
  message,
  priority,
  action_url,
  entity_type,
  entity_id,
  dedupe_key,
  metadata,
  is_read,
  read_at,
  created_at,
  actor:profiles!notifications_actor_profile_id_fkey (
    id,
    full_name,
    role
  )
`;

/**
 * Resolve the signed-in user's profile row. All notification access is scoped
 * to this id, matching the RLS policies on the table.
 */
export async function getCurrentProfile() {
  await supabase.auth.getSession();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { data: null, error: userError ?? new Error("Not authenticated.") };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, auth_user_id, full_name, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!data) {
    return { data: null, error: new Error("Unable to load your profile.") };
  }

  return { data, error: null };
}

/**
 * Map a teachers.id to the owning profiles.id.
 * teachers.user_id stores the auth user id, which profiles.auth_user_id mirrors.
 */
export async function resolveProfileIdForTeacher(teacherId) {
  if (!teacherId) return { data: null, error: null };

  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", teacherId)
    .maybeSingle();

  if (teacherError) return { data: null, error: teacherError };
  if (!teacher?.user_id) return { data: null, error: null };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", teacher.user_id)
    .maybeSingle();

  if (profileError) return { data: null, error: profileError };
  return { data: profile?.id ?? null, error: null };
}

function normalizeRow(payload) {
  return {
    recipient_profile_id: payload.recipientProfileId,
    actor_profile_id: payload.actorProfileId ?? null,
    notification_type: payload.type,
    title: payload.title,
    message: payload.message,
    priority: payload.priority ?? NOTIFICATION_PRIORITY.MEDIUM,
    action_url: payload.actionUrl ?? null,
    entity_type: payload.entityType ?? null,
    entity_id: payload.entityId ?? null,
    dedupe_key: payload.dedupeKey ?? null,
    metadata: payload.metadata ?? {},
  };
}

function isValid(payload) {
  return Boolean(
    payload?.recipientProfileId && payload?.type && payload?.title && payload?.message
  );
}

/**
 * Insert a single notification. Rows carrying a dedupe_key are ignored when the
 * same key already exists, so repeated syncs never duplicate an event.
 */
export async function createNotification(payload) {
  const result = await createNotifications([payload]);
  return { data: result.data?.[0] ?? null, error: result.error };
}

/** Bulk insert variant — one round trip for a whole batch of events. */
export async function createNotifications(payloads = []) {
  const rows = payloads.filter(isValid).map(normalizeRow);
  if (!rows.length) return { data: [], error: null };

  const { data, error } = await supabase
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, dedupe_key");

  return { data: data ?? [], error };
}

/**
 * Notification creation must never break the mutation that triggered it.
 * Use this wrapper at call sites inside existing module flows.
 */
export async function createNotificationsSafely(payloads = []) {
  try {
    const { data, error } = await createNotifications(payloads);
    if (error) {
      console.warn("[notifications] create failed:", error.message);
      return { data: [], error };
    }
    return { data, error: null };
  } catch (cause) {
    console.warn("[notifications] create threw:", cause?.message ?? cause);
    return { data: [], error: cause };
  }
}

/** Newest-first inbox for the signed-in recipient. */
export async function getTeacherNotifications({ limit = 200 } = {}) {
  const profile = await getCurrentProfile();
  if (profile.error) return { data: [], profile: null, error: profile.error };

  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_profile_id", profile.data.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return { data: data ?? [], profile: profile.data, error };
}

export async function getUnreadNotificationCount() {
  const profile = await getCurrentProfile();
  if (profile.error) return { data: 0, error: profile.error };

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profile.data.id)
    .eq("is_read", false);

  return { data: count ?? 0, error };
}

export async function markNotificationRead(notificationId, isRead = true) {
  if (!notificationId) {
    return { data: null, error: new Error("Notification id is required.") };
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: isRead, read_at: isRead ? new Date().toISOString() : null })
    .eq("id", notificationId)
    .select("id, is_read, read_at")
    .maybeSingle();

  return { data, error };
}

export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();
  if (profile.error) return { data: 0, error: profile.error };

  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_profile_id", profile.data.id)
    .eq("is_read", false)
    .select("id");

  return { data: data?.length ?? 0, error };
}

let channelSequence = 0;

/**
 * Realtime subscription for a single recipient. Returns an unsubscribe fn.
 * The topic is unique per subscriber so the sidebar and the inbox page can
 * both listen at the same time.
 */
export function subscribeToNotifications(profileId, onChange) {
  if (!profileId) return () => {};

  channelSequence += 1;
  const channel = supabase
    .channel(`notifications:${profileId}:${channelSequence}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_profile_id=eq.${profileId}`,
      },
      (payload) => onChange?.(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
