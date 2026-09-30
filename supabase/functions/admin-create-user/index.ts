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

function extractErrorMessage(err: unknown): string {
  if (!err) return "Unable to save user records.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null) {
    const rec = err as Record<string, unknown>;
    const code = String(rec.code ?? "");
    const msg = String(rec.message ?? "");
    const details = String(rec.details ?? "");

    if (code === "23505" || msg.includes("duplicate key")) {
      if (msg.includes("employee_number") || details.includes("employee_number")) {
        return "A staff member with this employee ID already exists.";
      }
      if (msg.includes("email") || details.includes("email")) {
        return "A user with this email already exists.";
      }
      if (msg.includes("username") || details.includes("username")) {
        return "A user with this username already exists.";
      }
      return "A record with this information already exists.";
    }
    if (msg) return msg;
    if (details) return details;
  }
  return "Unable to save user records.";
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
  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .single();

  if (profileError || callerProfile?.role !== "admin" || callerProfile.is_active === false) {
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
  const password = generateTemporaryPassword();
  const role = body.role === "admin" ? "admin" : "teacher";
  const status = body.status === "inactive" ? "inactive" : "active";
  const learningArea = clean(body.learningArea) || (role === "admin" ? "Administration" : "");
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName || !employeeId || !email) {
    return json({ ok: false, error: "First name, last name, employee ID, and email are required." }, 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  // =========================================================================
  // 1. PRE-VALIDATION: Prevent duplicate accounts before touching Auth
  // =========================================================================

  // Check email in public.users
  const { data: existingUser } = await admin
    .from("users")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (existingUser) {
    // Check if user genuinely exists in Supabase Auth
    const { data: authCheck } = await admin.auth.admin.getUserById(existingUser.id);
    if (authCheck?.user) {
      return json({ ok: false, error: "A user with this email already exists." }, 400);
    } else {
      // Dangling ghost record without an auth account — clean up so creation can proceed
      await admin.from("teachers").update({ user_id: null }).eq("user_id", existingUser.id);
      await admin.from("users").delete().eq("id", existingUser.id);
    }
  }

  // Check if a teacher row already exists with this email or employee number
  const { data: existingTeacherByEmail } = await admin
    .from("teachers")
    .select("id, email, user_id, employee_number")
    .ilike("email", email)
    .maybeSingle();

  const { data: existingTeacherByEmp } = await admin
    .from("teachers")
    .select("id, email, user_id, employee_number")
    .ilike("employee_number", employeeId)
    .maybeSingle();

  const matchedTeacher = existingTeacherByEmail || existingTeacherByEmp;

  if (matchedTeacher?.user_id) {
    // Check if the linked user actually exists in Auth
    const { data: linkedAuthCheck } = await admin.auth.admin.getUserById(matchedTeacher.user_id);
    if (linkedAuthCheck?.user) {
      if (existingTeacherByEmail) {
        return json({ ok: false, error: "A user with this email already exists." }, 400);
      }
      return json(
        { ok: false, error: `A staff member with employee ID "${employeeId}" already exists.` },
        400
      );
    } else {
      // Orphaned user_id on teacher record — unbind so we can rebind to the new legitimate account
      await admin.from("teachers").update({ user_id: null }).eq("id", matchedTeacher.id);
      matchedTeacher.user_id = null;
    }
  }

  // =========================================================================
  // 2. USERNAME GENERATION: Guarantee a non-colliding username
  // =========================================================================
  const baseUsername = usernameFromEmail(email) || "staff";
  let chosenUsername = baseUsername;
  const { data: existingUsername } = await admin
    .from("users")
    .select("id")
    .eq("username", chosenUsername)
    .maybeSingle();

  if (existingUsername) {
    const suffix = Math.floor(100 + Math.random() * 900);
    chosenUsername = `${baseUsername}-${suffix}`;
  }

  // =========================================================================
  // 3. CREATE AUTH USER
  // =========================================================================
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, must_change_password: true },
  });

  if (authError || !authData.user) {
    const rawMsg = authError?.message || "";
    if (rawMsg.includes("already registered") || rawMsg.includes("already been registered")) {
      return json({ ok: false, error: "A user with this email already exists." }, 400);
    }
    return json({ ok: false, error: rawMsg || "Unable to create Auth user." }, 400);
  }

  const authUserId = authData.user.id;

  // =========================================================================
  // 4. INSERT APPLICATION RECORDS (users -> profiles -> teachers)
  // =========================================================================
  try {
    const { error: accountError } = await admin.from("users").insert({
      id: authUserId,
      username: chosenUsername,
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
      if (matchedTeacher?.id) {
        // Link existing teacher record to the newly created user
        const { error: teacherUpdateError } = await admin
          .from("teachers")
          .update({
            user_id: authUserId,
            first_name: firstName,
            last_name: lastName,
            email,
            employee_number: employeeId || matchedTeacher.employee_number,
            learning_area: learningArea || null,
            status,
          })
          .eq("id", matchedTeacher.id);
        if (teacherUpdateError) throw teacherUpdateError;
      } else {
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
    }

    // =======================================================================
    // 5. WELCOME EMAIL (Non-fatal if email service fails)
    // =======================================================================
    let emailSent = false;
    let emailErrorMessage: string | null = null;

    try {
      const brevo = requireBrevoConfig();
      if (brevo.ok) {
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
        emailSent = emailed.ok;
        if (!emailed.ok) {
          emailErrorMessage = emailed.error;
        }
      } else {
        emailErrorMessage = brevo.error;
      }
    } catch (mailErr) {
      emailErrorMessage = mailErr instanceof Error ? mailErr.message : "Email sending failed.";
    }

    return json({
      ok: true,
      emailSent,
      emailError: emailErrorMessage,
      temporaryPassword: password,
      user: { id: authUserId, email, fullName, role, status },
    });
  } catch (error) {
    // Safe reverse cleanup on failure so no partial/ghost records remain
    try {
      if (matchedTeacher?.id) {
        await admin.from("teachers").update({ user_id: null }).eq("id", matchedTeacher.id);
      } else {
        await admin.from("teachers").delete().eq("user_id", authUserId);
      }
      await admin.from("profiles").delete().eq("auth_user_id", authUserId);
      await admin.from("users").delete().eq("id", authUserId);
      await admin.auth.admin.deleteUser(authUserId);
    } catch {
      /* ignore rollback cascade errors */
    }

    return json(
      {
        ok: false,
        error: extractErrorMessage(error),
      },
      400
    );
  }
});
