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
  if (!authorization) return json({ ok: false, error: "Not authenticated." }, 401);

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

  if (profileError || profile?.role !== "admin" || profile.is_active === false) {
    return json(
      { ok: false, error: "Only active administrators can delete users." },
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
    return json({ ok: false, error: "User auth id is required." }, 400);
  }
  if (authUserId === caller.id) {
    return json(
      { ok: false, error: "You cannot delete the account you are signed in with." },
      400
    );
  }

  const { data: teacher } = await admin
    .from("teachers")
    .select("id")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (teacher?.id) {
    const { count, error: classError } = await admin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacher.id);
    if (classError) {
      return json({ ok: false, error: classError.message }, 400);
    }
    if ((count ?? 0) > 0) {
      return json(
        {
          ok: false,
          error:
            "This teacher still has assigned classes. Unassign or reassign those classes first.",
        },
        409
      );
    }
  }

  const { error: teacherDeleteError } = await admin
    .from("teachers")
    .delete()
    .eq("user_id", authUserId);
  if (teacherDeleteError) {
    return json(
      {
        ok: false,
        error:
          teacherDeleteError.code === "23503"
            ? "This user still has related school records (for example assigned classes). Remove those first."
            : teacherDeleteError.message,
      },
      409
    );
  }

  const { error: profileDeleteError } = await admin
    .from("profiles")
    .delete()
    .eq("auth_user_id", authUserId);
  if (profileDeleteError) {
    return json({ ok: false, error: profileDeleteError.message }, 400);
  }

  const { error: userDeleteError } = await admin
    .from("users")
    .delete()
    .eq("id", authUserId);
  if (userDeleteError) {
    return json(
      {
        ok: false,
        error:
          userDeleteError.code === "23503"
            ? "This user still has related school records. Remove those first."
            : userDeleteError.message,
      },
      409
    );
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUserId);
  if (authDeleteError) {
    return json(
      { ok: false, error: authDeleteError.message || "Unable to delete Auth user." },
      400
    );
  }

  return json({ ok: true, authUserId });
});
