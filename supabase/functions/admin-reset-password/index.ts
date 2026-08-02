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

function generateTempPassword() {
  const chunk = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CNHS-Tmp-${chunk}`;
}

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
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .single();

  if (
    profileError ||
    profile?.role !== "admin" ||
    profile.is_active === false
  ) {
    return json(
      { ok: false, error: "Only active administrators can reset passwords." },
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
  if (!authUserId) {
    return json({ ok: false, error: "authUserId is required." }, 400);
  }

  const temporaryPassword =
    clean(body.temporaryPassword) || generateTempPassword();
  if (temporaryPassword.length < 8) {
    return json(
      { ok: false, error: "Temporary password must be at least 8 characters." },
      400
    );
  }

  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id, auth_user_id, full_name, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (targetError || !targetProfile) {
    return json({ ok: false, error: "Target user profile not found." }, 404);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    authUserId,
    { password: temporaryPassword }
  );

  if (updateError) {
    return json(
      { ok: false, error: updateError.message || "Unable to reset password." },
      400
    );
  }

  const { error: profileFlagError } = await admin
    .from("profiles")
    .update({
      must_change_password: true,
      temp_password: temporaryPassword,
    })
    .eq("auth_user_id", authUserId);

  if (profileFlagError) {
    return json(
      {
        ok: false,
        error:
          profileFlagError.message ||
          "Password reset, but temporary password flag could not be saved.",
      },
      400
    );
  }

  return json({
    ok: true,
    temporaryPassword,
    user: {
      authUserId,
      fullName: targetProfile.full_name,
      role: targetProfile.role,
    },
  });
});
