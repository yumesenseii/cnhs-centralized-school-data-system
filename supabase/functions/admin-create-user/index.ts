import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  loginUrlFromEnv,
  requireBrevoConfig,
  sendBrevoTransactionalEmail,
  welcomeAccountEmail,
} from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function generateTemporaryPassword() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 10)
    .toUpperCase();
  return `CNHS-${token || "TMP9X7K2"}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, error: "Supabase function environment is incomplete." }, 500);
  }

  const brevo = requireBrevoConfig();
  if (!brevo.ok) {
    return json({ ok: false, error: brevo.error }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ ok: false, error: "Not authenticated." }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ ok: false, error: "Invalid session." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .single();

  if (profileError || profile?.role !== "admin" || profile.is_active === false) {
    return json({ ok: false, error: "Only active administrators can create users." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const employeeId = clean(body.employeeId);
  const email = clean(body.email).toLowerCase();
  // Ignore any client-supplied password. HT never sees or shares it.
  const password = generateTemporaryPassword();
  const role = body.role === "admin" ? "admin" : "teacher";
  const status = body.status === "inactive" ? "inactive" : "active";
  const learningArea = clean(body.learningArea) || (role === "admin" ? "Administration" : "");
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName || !employeeId || !email) {
    return json({ ok: false, error: "First name, last name, employee ID, and email are required." }, 400);
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, must_change_password: true },
  });
  if (authError || !authData.user) {
    return json({ ok: false, error: authError?.message || "Unable to create Auth user." }, 400);
  }

  const authUserId = authData.user.id;
  try {
    const { error: accountError } = await admin.from("users").insert({
      id: authUserId,
      username: usernameFromEmail(email),
      email,
      password_hash: "supabase-auth-managed",
      role,
      status,
    });
    if (accountError) throw accountError;

    const { error: profileUpsertError } = await admin.from("profiles").upsert(
      {
        auth_user_id: authUserId,
        full_name: fullName,
        role,
        is_active: status === "active",
        must_change_password: true,
        temp_password: password,
      },
      { onConflict: "auth_user_id" }
    );
    if (profileUpsertError) throw profileUpsertError;

    if (role === "teacher") {
      const { error: teacherError } = await admin.from("teachers").insert({
        user_id: authUserId,
        employee_number: employeeId,
        first_name: firstName,
        last_name: lastName,
        email,
        learning_area: learningArea || null,
        status,
      });
      if (teacherError) throw teacherError;
    }

    // Safer: keep the account only if the welcome email is sent.
    // HT can retry Add User; the teacher never gets an account they cannot sign into.
    const message = welcomeAccountEmail({
      fullName,
      email,
      temporaryPassword: password,
      loginUrl: loginUrlFromEnv(),
    });
    const emailed = await sendBrevoTransactionalEmail({
      toEmail: email,
      toName: fullName,
      subject: message.subject,
      textContent: message.textContent,
      htmlContent: message.htmlContent,
    });
    if (!emailed.ok) throw new Error(emailed.error);

    return json({
      ok: true,
      user: { id: authUserId, email, fullName, role, status },
    });
  } catch (error) {
    await admin.from("teachers").delete().eq("user_id", authUserId);
    await admin.from("profiles").delete().eq("auth_user_id", authUserId);
    await admin.from("users").delete().eq("id", authUserId);
    await admin.auth.admin.deleteUser(authUserId);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to save user records.",
      },
      400
    );
  }
});
