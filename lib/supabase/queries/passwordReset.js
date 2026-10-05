import { createClient } from "@/lib/supabase/client";

/**
 * Request a password-reset email.
 * First tries the request-password-reset Edge Function (Brevo API).
 * If that is unavailable or returns an error, falls back to supabase.auth.resetPasswordForEmail.
 */
export async function requestPasswordResetEmail(email) {
  const trimmed = String(email || "").trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, error: new Error("Email is required.") };
  }

  const supabase = createClient();
  const defaultOrigin =
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    process.env.APP_ORIGIN ||
    "http://localhost:3002";
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/login/reset-password`
      : `${defaultOrigin}/login/reset-password`;

  try {
    const { data, error } = await supabase.functions.invoke(
      "request-password-reset",
      {
        body: { email: trimmed, redirectTo },
      }
    );

    if (!error && data?.ok !== false) {
      return { ok: true, data };
    }

    console.warn(
      "[forgot-password] Edge function invoke failed or returned error, falling back to resetPasswordForEmail:",
      error || data?.error
    );
  } catch (err) {
    console.warn(
      "[forgot-password] Edge function invoke exception, falling back to resetPasswordForEmail:",
      err
    );
  }

  // Fallback: Supabase Auth's built-in resetPasswordForEmail
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    if (error) {
      console.warn("[forgot-password] resetPasswordForEmail failed:", error.message);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[forgot-password] resetPasswordForEmail exception:", err);
    return { ok: false, error: err };
  }
}
