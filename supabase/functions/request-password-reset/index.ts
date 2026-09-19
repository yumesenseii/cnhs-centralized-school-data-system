import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  appOriginFromEnv,
  passwordResetEmail,
  requireBrevoConfig,
  sendBrevoTransactionalEmail,
} from "../_shared/brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Best-effort per-isolate throttle (same email). */
const recentByEmail = new Map<string, number>();
const MIN_INTERVAL_MS = 60_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function allowedRedirectTo(redirectTo: string) {
  const origin = appOriginFromEnv();
  const allowed = new Set<string>();
  if (origin) {
    allowed.add(`${origin}/login/reset-password`);
  }
  allowed.add("http://localhost:3000/login/reset-password");
  allowed.add("http://127.0.0.1:3000/login/reset-password");

  try {
    const url = new URL(redirectTo);
    if (url.pathname.replace(/\/$/, "") !== "/login/reset-password") {
      return false;
    }
    if (allowed.has(redirectTo.replace(/\/$/, "")) || allowed.has(redirectTo)) {
      return true;
    }
    // Allow any https host that ends with vercel.app for this project previews
    if (
      url.protocol === "https:" &&
      (url.hostname.endsWith(".vercel.app") ||
        url.hostname === "cnhs-centralized-school-data-system.vercel.app")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Supabase function environment is incomplete." }, 500);
  }

  const brevo = requireBrevoConfig();
  if (!brevo.ok) {
    return json({ ok: false, error: brevo.error }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const email = clean(body.email).toLowerCase();
  if (!email || !isValidEmail(email)) {
    return json({ ok: false, error: "A valid email is required." }, 400);
  }

  const requestedRedirect = clean(body.redirectTo);
  const fallbackRedirect = appOriginFromEnv()
    ? `${appOriginFromEnv()}/login/reset-password`
    : "http://localhost:3000/login/reset-password";
  const redirectTo =
    requestedRedirect && allowedRedirectTo(requestedRedirect)
      ? requestedRedirect
      : fallbackRedirect;

  // Always return generic ok after validation — do not reveal whether the user exists.
  const genericOk = () => json({ ok: true });

  const last = recentByEmail.get(email) ?? 0;
  const now = Date.now();
  if (now - last < MIN_INTERVAL_MS) {
    return genericOk();
  }
  recentByEmail.set(email, now);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error || !data) {
      console.warn("[request-password-reset] generateLink:", error?.message);
      return genericOk();
    }

    const actionLink =
      data.properties?.action_link ||
      // deno-lint-ignore no-explicit-any
      (data as any)?.action_link ||
      "";

    if (!actionLink) {
      console.warn("[request-password-reset] missing action_link");
      return genericOk();
    }

    const message = passwordResetEmail({
      email,
      resetUrl: actionLink,
    });
    const emailed = await sendBrevoTransactionalEmail({
      toEmail: email,
      toName: email,
      subject: message.subject,
      textContent: message.textContent,
      htmlContent: message.htmlContent,
    });

    if (!emailed.ok) {
      console.warn("[request-password-reset] Brevo:", emailed.error);
      // Still generic — avoid leaking transport details to the client.
      return genericOk();
    }

    return genericOk();
  } catch (err) {
    console.warn(
      "[request-password-reset] unexpected:",
      err instanceof Error ? err.message : err
    );
    return genericOk();
  }
});
