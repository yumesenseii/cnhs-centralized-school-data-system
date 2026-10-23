import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function usernameFromEmail(email: string) {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

/**
 * Syncs the legacy public.users row (status) for an Auth account.
 * Clients can only SELECT public.users (migration 007), so staff status
 * changes that touch this table must run through this admin-verified
 * service-role function. Does not create Auth accounts — only the public
 * mirror row is inserted when it is missing.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(
      { ok: false, error: "Supabase function environment is incomplete." },
      500
    );
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return json({ ok: false, error: "Not authenticated." }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return json({ ok: false, error: "Invalid session." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerProfile, error: callerProfileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .single();

  if (
    callerProfileError ||
    callerProfile?.role !== "admin" ||
    callerProfile.is_active === false
  ) {
    return json(
      { ok: false, error: "Only active administrators can update user accounts." },
      403
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const authUserId = clean(body.authUserId);
  const status =
    clean(body.status).toLowerCase() === "inactive" ? "inactive" : "active";

  if (!authUserId) {
    return json({ ok: false, error: "authUserId is required." }, 400);
  }

  // Never let an admin lock themselves out of the console.
  if (status === "inactive" && authUserId === caller.id) {
    return json(
      { ok: false, error: "You cannot deactivate your own account." },
      400
    );
  }

  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id, auth_user_id, full_name, role, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (targetError || !targetProfile) {
    return json({ ok: false, error: "Target user profile not found." }, 404);
  }

  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(
    authUserId
  );
  if (authUserError || !authUser?.user) {
    return json(
      { ok: false, error: "Linked authentication account was not found." },
      404
    );
  }

  const email = clean(authUser.user.email).toLowerCase();
  const username =
    usernameFromEmail(email) || `user-${authUserId.slice(0, 8)}`;

  const { data: existingAccount } = await admin
    .from("users")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();

  let syncError = null;
  if (existingAccount) {
    const result = await admin
      .from("users")
      .update({ status })
      .eq("id", authUserId);
    syncError = result.error;
  } else {
    // Mirror row missing (e.g. School Principal predating public.users).
    // Reuse the deterministic "supabase-auth-managed" convention so the row
    // stays strictly a mirror — it is never a real credential.
    const result = await admin.from("users").insert({
      id: authUserId,
      username,
      email,
      password_hash: "supabase-auth-managed",
      role: targetProfile.role,
      status,
    });
    syncError = result.error;
  }

  if (syncError) {
    return json(
      { ok: false, error: syncError.message || "Unable to sync account status." },
      400
    );
  }

  return json({
    ok: true,
    user: {
      authUserId,
      fullName: targetProfile.full_name,
      role: targetProfile.role,
    },
    status,
    synced: true,
    note:
      "Account status synchronized with the legacy users table via service role.",
  });
});
