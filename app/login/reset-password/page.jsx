"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, LoaderCircle, Lock } from "lucide-react";
import LoginButton from "@/components/auth/LoginButton";
import PasswordInput from "@/components/auth/PasswordInput";
import { loginContent } from "@/lib/constants/loginContent";
import ForceLightMode from "@/components/theme/ForceLightMode";
import { createClient } from "@/lib/supabase/client";

const exchangeByCode = new Map();

function exchangeCodeOnce(supabase, code) {
  let pending = exchangeByCode.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code);
    exchangeByCode.set(code, pending);
  }
  return pending;
}

export default function ResetPasswordPage() {
  const { form, errors } = loginContent;
  // 'checking' | 'ready' | 'invalid' | 'success'
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    password: "",
    confirm: "",
  });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const processedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function initRecovery() {
      if (processedRef.current) return;

      const searchParams = new URLSearchParams(window.location.search);
      const rawHash = window.location.hash.replace(/^#/, "");
      const hashParams = new URLSearchParams(rawHash);

      // 1. Explicit auth error in query or hash (e.g. otp_expired, access_denied)
      const errorCode = searchParams.get("error_code") || hashParams.get("error_code");
      const authError = searchParams.get("error") || hashParams.get("error");
      const errorDesc =
        searchParams.get("error_description") || hashParams.get("error_description");

      if (authError || errorCode) {
        console.warn("[reset-password] Auth error in URL:", authError, errorCode, errorDesc);
        if (!cancelled) setStatus("invalid");
        return;
      }

      // 2. PKCE code flow (?code=...)
      const code = searchParams.get("code");
      if (code) {
        processedRef.current = true;
        try {
          const { data, error: exchangeError } = await exchangeCodeOnce(supabase, code);
          if (cancelled) return;
          if (exchangeError || !data?.session) {
            console.warn("[reset-password] code exchange error:", exchangeError?.message);
            setStatus("invalid");
            return;
          }
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
          return;
        } catch (err) {
          console.warn("[reset-password] code exchange exception:", err);
          if (!cancelled) setStatus("invalid");
          return;
        }
      }

      // 3. Implicit hash flow (#access_token=...&refresh_token=...)
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken) {
        processedRef.current = true;
        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          });

          if (cancelled) return;

          if (sessionError || !data?.session) {
            console.warn("[reset-password] setSession error:", sessionError?.message);
            setStatus("invalid");
            return;
          }

          // Successfully established recovery session. Clean hash from address bar.
          window.history.replaceState(null, "", window.location.pathname);
          setStatus("ready");
          return;
        } catch (err) {
          console.warn("[reset-password] setSession exception:", err);
          if (!cancelled) setStatus("invalid");
          return;
        }
      }

      // 4. Session already established (e.g. user refreshed the page while resetting)
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionData?.session) {
          setStatus("ready");
          return;
        }
      } catch (err) {
        console.warn("[reset-password] getSession error:", err);
      }

      // 5. If no code, no token, and no active session -> invalid or expired link
      if (!cancelled) {
        setStatus("invalid");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    initRecovery();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = { password: "", confirm: "" };
    if (!password || password.length < 8) {
      nextErrors.password = form.resetTooShort;
    }
    if (password !== confirm) {
      nextErrors.confirm = form.resetMismatch;
    }
    setFieldErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirm) return;

    setLoading(true);
    setServerError("");
    const supabase = createClient();

    try {
      const { data: updateData, error } = await supabase.auth.updateUser({ password });
      if (error) {
        setServerError(error.message || errors.networkError);
        setLoading(false);
        return;
      }

      // Clear must_change_password and temp_password in profiles if user had them
      if (updateData?.user?.id) {
        await supabase
          .from("profiles")
          .update({
            must_change_password: false,
            temp_password: null,
          })
          .eq("auth_user_id", updateData.user.id);
      }

      setStatus("success");
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[reset-password] updateUser unexpected:", err);
      setServerError(errors.networkError);
      setLoading(false);
    }
  }

  return (
    <ForceLightMode>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="portal-body relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
        data-force-light="true"
        data-keep-white="true"
      >
        <div className="portal-page__bg absolute inset-0" aria-hidden="true">
          <Image
            src={loginContent.backgroundSrc}
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(14,72,45,0.85) 0%, rgba(14,72,45,0.55) 40%, rgba(14,72,45,0.20) 70%, rgba(14,72,45,0.05) 100%)",
            }}
          />
        </div>

        <main className="relative z-10 w-full max-w-[440px]">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#174D37]/10"
                aria-hidden="true"
              >
                <Lock className="text-[#174D37]" size={26} strokeWidth={1.75} />
              </div>
              <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[#174D37]">
                {form.resetTitle}
              </h1>
              <p className="mt-2 max-w-[340px] text-[13px] leading-5 text-slate-500">
                {form.resetSubtitle}
              </p>
            </div>

            {status === "checking" ? (
              <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
                <LoaderCircle className="h-7 w-7 animate-spin text-[#174D37]" />
                <p className="mt-3 text-[13px] font-medium text-slate-600">
                  Verifying reset link…
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Connecting to CNHS Learn authentication…
                </p>
              </div>
            ) : status === "success" ? (
              <div className="mt-5 space-y-4 text-center">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-[#174D37]"
                  style={{ backgroundColor: "#f0fdf4", color: "#174D37" }}
                >
                  <CheckCircle2 size={28} />
                </div>
                <p
                  role="status"
                  className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-xs font-semibold leading-5 text-[#174D37]"
                  style={{
                    backgroundColor: "#f0fdf4",
                    borderColor: "#bbf7d0",
                    color: "#174D37",
                  }}
                >
                  {form.resetSuccess}
                </p>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#174D37] text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#123D2C]"
                  >
                    {form.resetBack}
                  </Link>
                </div>
              </div>
            ) : status === "invalid" ? (
              <div className="mt-5 space-y-4">
                <p
                  className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] font-medium leading-5 text-red-600"
                  role="alert"
                >
                  {form.resetInvalid}
                </p>
                <Link
                  href="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {form.resetBack}
                </Link>
              </div>
            ) : (
              <form className="mt-5" onSubmit={handleSubmit} noValidate>
                {serverError ? (
                  <p
                    className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600"
                    role="alert"
                  >
                    {serverError}
                  </p>
                ) : null}
                <PasswordInput
                  id="new-password"
                  name="new-password"
                  label={form.resetPasswordLabel}
                  placeholder={form.passwordPlaceholder}
                  value={password}
                  autoComplete="new-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: "" }));
                    }
                  }}
                  required
                  error={fieldErrors.password}
                />
                <PasswordInput
                  id="confirm-password"
                  name="confirm-password"
                  label={form.resetConfirmLabel}
                  placeholder={form.passwordPlaceholder}
                  value={confirm}
                  autoComplete="new-password"
                  onChange={(event) => {
                    setConfirm(event.target.value);
                    if (fieldErrors.confirm) {
                      setFieldErrors((prev) => ({ ...prev, confirm: "" }));
                    }
                  }}
                  required
                  error={fieldErrors.confirm}
                />
                <div className="pt-1">
                  <LoginButton loading={loading}>{form.resetSubmit}</LoginButton>
                </div>
              </form>
            )}
          </div>
        </main>
      </motion.div>
    </ForceLightMode>
  );
}
