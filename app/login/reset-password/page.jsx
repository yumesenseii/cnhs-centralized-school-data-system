"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import LoginButton from "@/components/auth/LoginButton";
import PasswordInput from "@/components/auth/PasswordInput";
import { loginContent } from "@/lib/constants/loginContent";
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
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    password: "",
    confirm: "",
  });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function prepare() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );
      const errorCode = params.get("error_code") || hashParams.get("error_code");
      const authError = params.get("error") || hashParams.get("error");
      if (authError === "access_denied" || errorCode === "otp_expired") {
        setInvalid(true);
        setReady(false);
        return;
      }

      const code = params.get("code");

      if (code) {
        if (cancelled) return;
        const { error } = await exchangeCodeOnce(supabase, code);
        if (cancelled) return;
        if (error) {
          setInvalid(true);
          setReady(false);
          return;
        }
        window.history.replaceState({}, "", "/login/reset-password");
        setInvalid(false);
        setReady(true);
        return;
      }

      const type = params.get("type") || hashParams.get("type");
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data?.session && (type === "recovery" || hashParams.get("access_token"))) {
        setInvalid(false);
        setReady(true);
        return;
      }
      if (data?.session && !code) {
        setInvalid(false);
        setReady(true);
        return;
      }

      setInvalid(true);
      setReady(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setInvalid(false);
        setReady(true);
      }
    });

    prepare();

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
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setServerError(error.message || errors.networkError);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.assign("/login?reset=1");
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="portal-body relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
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

          {invalid ? (
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
          ) : !ready ? (
            <p className="mt-5 text-center text-[12px] text-slate-500">Checking reset link…</p>
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
  );
}
