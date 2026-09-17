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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Pilot batch cap for bulk LRN+email invite. */
const BULK_MAX = 50;

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
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function studentFullName(row: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) {
  return [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

type AdminClient = ReturnType<typeof createClient>;

async function requireActiveAdmin(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      ok: false as const,
      response: json(
        { ok: false, error: "Supabase function environment is incomplete." },
        500
      ),
    };
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return {
      ok: false as const,
      response: json({ ok: false, error: "Not authenticated." }, 401),
    };
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return {
      ok: false as const,
      response: json({ ok: false, error: "Invalid session." }, 401),
    };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", caller.id)
    .single();

  if (profileError || profile?.role !== "admin" || profile.is_active === false) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          error: "Only active administrators can manage student accounts.",
        },
        403
      ),
    };
  }

  return { ok: true as const, admin, callerId: caller.id };
}

async function rollbackAuthUser(admin: AdminClient, authUserId: string) {
  await admin.from("profiles").delete().eq("auth_user_id", authUserId);
  await admin.from("users").delete().eq("id", authUserId);
  await admin.auth.admin.deleteUser(authUserId);
}

async function createOneStudentAccount(
  admin: AdminClient,
  {
    studentId,
    email,
    loginUrl,
    sendEmail,
  }: {
    studentId: string;
    email: string;
    loginUrl: string;
    sendEmail: boolean;
  }
) {
  const normalizedEmail = email.toLowerCase();
  if (!studentId) {
    return { ok: false as const, error: "Student id is required.", code: "missing_student" };
  }
  if (!isValidEmail(normalizedEmail)) {
    return { ok: false as const, error: "Invalid email address.", code: "invalid_email" };
  }

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("id, student_number, first_name, middle_name, last_name, user_id, status")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    return { ok: false as const, error: "Student record not found.", code: "not_found" };
  }
  if (student.user_id) {
    return {
      ok: false as const,
      error: "Student already has a linked portal account.",
      code: "already_linked",
    };
  }

  const { data: emailTaken } = await admin
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (emailTaken?.id) {
    return {
      ok: false as const,
      error: "Email is already used by another account.",
      code: "email_used",
    };
  }

  const fullName = studentFullName(student) || student.student_number || "Student";
  const password = generateTemporaryPassword();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "student",
      portal_role: "student",
      portal_active: true,
      must_change_password: true,
    },
  });
  if (authError || !authData.user) {
    return {
      ok: false as const,
      error: authError?.message || "Unable to create Auth user.",
      code: "auth_create_failed",
    };
  }

  const authUserId = authData.user.id;
  try {
    const { error: accountError } = await admin.from("users").insert({
      id: authUserId,
      username: usernameFromEmail(normalizedEmail),
      email: normalizedEmail,
      password_hash: "supabase-auth-managed",
      role: "student",
      status: "active",
    });
    if (accountError) throw accountError;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        auth_user_id: authUserId,
        full_name: fullName,
        role: "student",
        is_active: true,
        must_change_password: true,
        temp_password: password,
      },
      { onConflict: "auth_user_id" }
    );
    if (profileError) throw profileError;

    const { error: linkError } = await admin
      .from("students")
      .update({ user_id: authUserId })
      .eq("id", student.id)
      .is("user_id", null);
    if (linkError) throw linkError;

    const { data: linked } = await admin
      .from("students")
      .select("user_id")
      .eq("id", student.id)
      .maybeSingle();
    if (linked?.user_id !== authUserId) {
      throw new Error("Unable to link student record (may already be linked).");
    }

    let emailSent = false;
    let emailError: string | null = null;
    if (sendEmail) {
      const message = welcomeAccountEmail({
        fullName,
        email: normalizedEmail,
        temporaryPassword: password,
        loginUrl,
      });
      const emailed = await sendBrevoTransactionalEmail({
        toEmail: normalizedEmail,
        toName: fullName,
        subject: message.subject,
        textContent: message.textContent,
        htmlContent: message.htmlContent,
      });
      if (emailed.ok) {
        emailSent = true;
      } else {
        emailError = emailed.error || "Unable to send welcome email.";
      }
    }

    return {
      ok: true as const,
      studentId: student.id,
      studentNumber: student.student_number,
      fullName,
      email: normalizedEmail,
      authUserId,
      emailSent,
      emailError,
      // Always return once for HT fallback when email fails (demo-safe).
      temporaryPassword: emailSent ? undefined : password,
    };
  } catch (error) {
    await admin.from("students").update({ user_id: null }).eq("id", student.id);
    await rollbackAuthUser(admin, authUserId);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Unable to create student account.",
      code: "save_failed",
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const gate = await requireActiveAdmin(req);
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const action = clean(body.action || "create") || "create";
  const loginUrl = loginUrlFromEnv();

  if (action === "setStatus") {
    const studentId = clean(body.studentId);
    const active = body.active !== false && body.active !== "false";
    if (!studentId) {
      return json({ ok: false, error: "Student id is required." }, 400);
    }

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, user_id, first_name, last_name, student_number")
      .eq("id", studentId)
      .maybeSingle();
    if (studentError || !student?.user_id) {
      return json(
        { ok: false, error: "Linked student account not found." },
        404
      );
    }

    const authUserId = student.user_id;
    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_active: active })
      .eq("auth_user_id", authUserId)
      .eq("role", "student");
    if (profileError) {
      return json({ ok: false, error: profileError.message }, 400);
    }

    await admin
      .from("users")
      .update({ status: active ? "active" : "inactive" })
      .eq("id", authUserId);

    await admin.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        portal_role: "student",
        portal_active: active,
      },
    });

    return json({
      ok: true,
      studentId,
      authUserId,
      active,
    });
  }

  if (action === "bulk") {
    const brevo = requireBrevoConfig();
    if (!brevo.ok) {
      return json({ ok: false, error: brevo.error }, 500);
    }

    const rowsIn = Array.isArray(body.rows) ? body.rows : [];
    if (!rowsIn.length) {
      return json({ ok: false, error: "No CSV rows provided." }, 400);
    }
    if (rowsIn.length > BULK_MAX) {
      return json(
        {
          ok: false,
          error: `Bulk invite is limited to ${BULK_MAX} rows per upload (pilot).`,
        },
        400
      );
    }

    const results: Array<Record<string, unknown>> = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const usedEmails = new Set<string>();

    for (const raw of rowsIn) {
      const row = (raw ?? {}) as Record<string, unknown>;
      const studentNumber = clean(row.student_number ?? row.studentNumber ?? row.lrn);
      const email = clean(row.email).toLowerCase();
      const nameHint = clean(row.name ?? row.full_name ?? row.fullName);

      if (!studentNumber) {
        skipped += 1;
        results.push({
          studentNumber: "",
          email,
          status: "skipped",
          reason: "Missing student_number (LRN).",
        });
        continue;
      }
      if (!isValidEmail(email)) {
        skipped += 1;
        results.push({
          studentNumber,
          email,
          status: "skipped",
          reason: "Invalid email.",
        });
        continue;
      }
      if (usedEmails.has(email)) {
        skipped += 1;
        results.push({
          studentNumber,
          email,
          status: "skipped",
          reason: "Duplicate email in this upload.",
        });
        continue;
      }
      usedEmails.add(email);

      const { data: student } = await admin
        .from("students")
        .select("id, student_number, first_name, middle_name, last_name, user_id")
        .eq("student_number", studentNumber)
        .maybeSingle();

      if (!student) {
        skipped += 1;
        results.push({
          studentNumber,
          email,
          status: "skipped",
          reason: "LRN not found in learners.",
        });
        continue;
      }
      if (student.user_id) {
        skipped += 1;
        results.push({
          studentNumber,
          email,
          status: "skipped",
          reason: "Already linked.",
          fullName: studentFullName(student),
        });
        continue;
      }

      const createdOne = await createOneStudentAccount(admin, {
        studentId: student.id,
        email,
        loginUrl,
        sendEmail: true,
      });

      if (!createdOne.ok) {
        if (
          createdOne.code === "already_linked" ||
          createdOne.code === "email_used" ||
          createdOne.code === "invalid_email" ||
          createdOne.code === "not_found"
        ) {
          skipped += 1;
          results.push({
            studentNumber,
            email,
            status: "skipped",
            reason: createdOne.error,
            nameHint: nameHint || undefined,
          });
        } else {
          failed += 1;
          results.push({
            studentNumber,
            email,
            status: "failed",
            reason: createdOne.error,
          });
        }
        continue;
      }

      created += 1;
      results.push({
        studentNumber,
        email,
        status: "created",
        fullName: createdOne.fullName,
        emailSent: createdOne.emailSent,
        emailError: createdOne.emailError ?? undefined,
        temporaryPassword: createdOne.temporaryPassword,
      });
    }

    return json({
      ok: true,
      summary: { created, skipped, failed, total: rowsIn.length, maxBatch: BULK_MAX },
      results,
    });
  }

  // Default: single create
  const brevo = requireBrevoConfig();
  if (!brevo.ok) {
    return json({ ok: false, error: brevo.error }, 500);
  }

  const studentId = clean(body.studentId);
  const email = clean(body.email).toLowerCase();
  const createdOne = await createOneStudentAccount(admin, {
    studentId,
    email,
    loginUrl,
    sendEmail: true,
  });

  if (!createdOne.ok) {
    return json({ ok: false, error: createdOne.error, code: createdOne.code }, 400);
  }

  return json({
    ok: true,
    user: {
      studentId: createdOne.studentId,
      studentNumber: createdOne.studentNumber,
      fullName: createdOne.fullName,
      email: createdOne.email,
      authUserId: createdOne.authUserId,
      role: "student",
      status: "active",
    },
    emailSent: createdOne.emailSent,
    emailError: createdOne.emailError,
    temporaryPassword: createdOne.temporaryPassword,
  });
});
