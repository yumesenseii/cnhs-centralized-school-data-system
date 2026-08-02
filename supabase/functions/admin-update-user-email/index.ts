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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      { ok: false, error: "Only active administrators can update login emails." },
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
  const email = clean(body.email).toLowerCase();

  if (!authUserId) {
    return json({ ok: false, error: "authUserId is required." }, 400);
  }
  if (!email || !isValidEmail(email)) {
    return json({ ok: false, error: "A valid email address is required." }, 400);
  }

  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id, auth_user_id, full_name, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (targetError || !targetProfile) {
    return json({ ok: false, error: "Target user profile not found." }, 404);
  }

  // School-managed accounts: confirm immediately so login works without an
  // inbox confirm click. See docs/USER_MANUAL.md (Manage Users) caveats.
  const { data: authUpdate, error: authError } =
    await admin.auth.admin.updateUserById(authUserId, {
      email,
      email_confirm: true,
    });

  if (authError) {
    return json(
      {
        ok: false,
        error: authError.message || "Unable to update Auth login email.",
      },
      400
    );
  }

  const username = usernameFromEmail(email) || `user-${authUserId.slice(0, 8)}`;
  const { data: existingAccount } = await admin
    .from("users")
    .select("id")
    .eq("id", authUserId)
    .maybeSingle();

  let usersError = null;
  if (existingAccount) {
    const result = await admin
      .from("users")
      .update({ email, username })
      .eq("id", authUserId);
    usersError = result.error;
  } else {
    const result = await admin.from("users").insert({
      id: authUserId,
      email,
      username,
      password_hash: "supabase-auth-managed",
      role: targetProfile.role,
      status: "active",
    });
    usersError = result.error;
  }

  if (usersError) {
    // Auth already moved — surface a clear recovery message.
    return json(
      {
        ok: false,
        error:
          usersError.message ||
          "Auth email updated, but public.users could not be synced.",
      },
      400
    );
  }

  await admin.from("teachers").update({ email }).eq("user_id", authUserId);

  return json({
    ok: true,
    email: authUpdate.user?.email ?? email,
    emailConfirmed: true,
    user: {
      authUserId,
      fullName: targetProfile.full_name,
      role: targetProfile.role,
    },
    note:
      "Login email updated and marked confirmed. The user should sign in with the new address.",
  });
});
