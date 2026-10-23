/**
 * Authorization helpers for the experimental per-subject trend forecast route.
 *
 * Extracted from the route handler so the authorization contract is testable
 * without booting Next.js. The HTTP semantics are preserved exactly:
 *   401 — unauthenticated,
 *   403 — inactive / missing profile, insufficient role, learner out of scope.
 *
 * No RLS, role or policy change is performed here: the caller's own session
 * token is always used, so row level security keeps deciding what is visible.
 */

/**
 * Authenticate a staff user (admin or teacher).
 *
 * @returns {Promise<{ok: true, user: object, profile: object} | {ok: false, status: number, message: string}>}
 */
export async function authorizeStaff(supabase) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      status: 401,
      message: "Authentication required.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, auth_user_id, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return {
      ok: false,
      status: 403,
      message: "Inactive or missing profile.",
    };
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    return {
      ok: false,
      status: 403,
      message: "Insufficient role for recommendations.",
    };
  }

  return { ok: true, user, profile };
}

/**
 * Verify teacher authorization for a specific learner.
 *
 * Admins have school-wide access. Teachers must have the learner enrolled in at
 * least one assigned class. Row level security still restricts which records
 * the session can actually read afterwards.
 *
 * @returns {Promise<{ok: true} | {ok: false, status: number, message: string}>}
 */
export async function authorizeLearnerAccess(supabase, profile, user, studentId) {
  if (!studentId) {
    return {
      ok: false,
      status: 400,
      message: "Learner ID is required.",
    };
  }

  if (profile?.role === "admin") return { ok: true };

  // Resolve teacher row
  const candidateUserIds = [profile?.auth_user_id, profile?.id, user?.id].filter(
    Boolean
  );
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id")
    .in("user_id", candidateUserIds);

  const teacherIds = (teachers ?? []).map((t) => t.id).filter(Boolean);
  if (!teacherIds.length) {
    return {
      ok: false,
      status: 403,
      message: "No teacher profile found.",
    };
  }

  // Check if the learner is enrolled in any class assigned to this teacher
  const { data: enrollment, error } = await supabase
    .from("class_students")
    .select("id, class_id, classes!inner(id, teacher_id)")
    .eq("student_id", studentId)
    .in("classes.teacher_id", teacherIds)
    .limit(1)
    .maybeSingle();

  if (error || !enrollment) {
    return {
      ok: false,
      status: 403,
      message: "Learner is not enrolled in any of your assigned classes.",
    };
  }

  return { ok: true };
}
