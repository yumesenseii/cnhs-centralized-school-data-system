"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import LoginButton from "@/components/auth/LoginButton";
import PasswordInput from "@/components/auth/PasswordInput";
import { loginContent } from "@/lib/constants/loginContent";
import { useAuth } from "@/hooks/useAuth";

function resolveHome(role) {
  if (role === "admin") return "/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  return "/login";
}

export default function FirstLoginForm() {
  const router = useRouter();
  const { completeFirstLogin } = useAuth();
  const { form, errors } = loginContent;

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    current: "",
    password: "",
    confirm: "",
    terms: "",
  });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = { current: "", password: "", confirm: "", terms: "" };
    if (!currentPassword) nextErrors.current = "Temporary password is required.";
    if (!password || password.length < 8) {
      nextErrors.password = form.resetTooShort;
    }
    if (password !== confirm) nextErrors.confirm = form.resetMismatch;
    if (currentPassword && password && currentPassword === password) {
      nextErrors.password =
        "New password must be different from the temporary password.";
    }
    if (!acceptedTerms) {
      nextErrors.terms = "Accept the Terms of Use and Privacy Policy to continue.";
    }
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setLoading(true);
    setServerError("");

    try {
      const result = await completeFirstLogin({
        currentPassword,
        newPassword: password,
        acceptedTerms,
      });
      if (result.error) {
        setServerError(result.error.message || errors.networkError);
        return;
      }

      router.replace(resolveHome(result.data?.role));
      router.refresh();
    } catch {
      setServerError(errors.networkError);
    } finally {
      setLoading(false);
    }
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

      <main className="relative z-10 w-full max-w-[480px]">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#174D37]/10"
              aria-hidden="true"
            >
              <ShieldCheck className="text-[#174D37]" size={26} strokeWidth={1.75} />
            </div>
            <h1 className="text-[24px] font-bold tracking-[-0.03em] text-[#174D37]">
              {form.firstLoginTitle}
            </h1>
            <p className="mt-2 max-w-[360px] text-[13px] leading-5 text-slate-500">
              {form.firstLoginSubtitle}
            </p>
          </div>

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
              id="temp-password"
              name="temp-password"
              label={form.firstLoginCurrentLabel}
              placeholder={form.passwordPlaceholder}
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                if (fieldErrors.current) {
                  setFieldErrors((prev) => ({ ...prev, current: "" }));
                }
              }}
              required
              error={fieldErrors.current}
            />
            <PasswordInput
              id="new-password"
              name="new-password"
              label={form.firstLoginNewLabel}
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
              label={form.firstLoginConfirmLabel}
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

            <section className="mb-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {form.firstLoginTermsTitle}
              </h2>
              <p className="mt-1.5 max-h-28 overflow-y-auto text-[12px] leading-5 text-slate-600">
                {form.firstLoginTerms}
              </p>
            </section>

            <label className="mb-3 flex items-start gap-2 text-[12px] leading-5 text-slate-600">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked);
                  if (fieldErrors.terms) {
                    setFieldErrors((prev) => ({ ...prev, terms: "" }));
                  }
                }}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-cnhs-green-dark"
              />
              <span>{form.firstLoginAccept}</span>
            </label>
            {fieldErrors.terms ? (
              <p className="mb-2 text-[11px] font-medium text-red-600">
                {fieldErrors.terms}
              </p>
            ) : null}

            <LoginButton loading={loading}>{form.firstLoginSubmit}</LoginButton>
          </form>
        </div>
      </main>
    </motion.div>
  );
}
