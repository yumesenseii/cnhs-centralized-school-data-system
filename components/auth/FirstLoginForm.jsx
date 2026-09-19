"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import LoginButton from "@/components/auth/LoginButton";
import PasswordInput from "@/components/auth/PasswordInput";
import { queueWelcomeToast } from "@/lib/auth/welcomeToast";
import { loginContent } from "@/lib/constants/loginContent";
import { PASSWORD_HINT, validateNewPassword } from "@/lib/auth/passwordPolicy";
import { useAuth } from "@/hooks/useAuth";

function resolveHome(role) {
  if (role === "admin") return "/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  if (role === "student") return "/student/dashboard";
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
  const [termsOpen, setTermsOpen] = useState(false);
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
    const policyError = validateNewPassword(password, currentPassword);
    if (policyError) {
      nextErrors.password =
        policyError.includes("different")
          ? form.firstLoginPasswordSame
          : form.firstLoginPasswordPolicy;
    }
    if (password !== confirm) nextErrors.confirm = form.resetMismatch;
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

      queueWelcomeToast(result.data?.full_name);
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
              maxLength={32}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }
              }}
              required
              error={fieldErrors.password}
              hint={form.firstLoginPasswordHint || PASSWORD_HINT}
            />
            <PasswordInput
              id="confirm-password"
              name="confirm-password"
              label={form.firstLoginConfirmLabel}
              placeholder={form.passwordPlaceholder}
              value={confirm}
              autoComplete="new-password"
              maxLength={32}
              onChange={(event) => {
                setConfirm(event.target.value);
                if (fieldErrors.confirm) {
                  setFieldErrors((prev) => ({ ...prev, confirm: "" }));
                }
              }}
              required
              error={fieldErrors.confirm}
            />

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
              <span>
                {form.firstLoginAcceptPrefix}
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="inline cursor-pointer font-semibold text-[#174D37] underline underline-offset-2 hover:text-[#123D2C]"
                >
                  {form.firstLoginAcceptLink}
                </button>
                {form.firstLoginAcceptSuffix}
              </span>
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

      {termsOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            aria-label="Close terms"
            onClick={() => setTermsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-login-terms-title"
            className="relative z-10 flex w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
            data-force-light="true"
            data-keep-white="true"
          >
            <div className="px-6 pt-5 pb-3">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#174D37]">
                {form.firstLoginTermsSchool}
              </p>
              <p className="mt-1 text-center text-[12px] font-medium text-slate-500">
                {form.firstLoginTermsSystem}
              </p>
              <h2
                id="first-login-terms-title"
                className="mt-2 text-center text-[17px] font-semibold tracking-[-0.02em] text-slate-900"
              >
                {form.firstLoginTermsTitle}
              </h2>
              <p className="mt-1 text-center text-[12px] italic text-slate-500">
                {form.firstLoginTermsEffective}
              </p>
              <div className="mt-3 h-px bg-[#174D37]" />
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-2">
              {(form.firstLoginTermsArticles ?? []).map((article) => (
                <section key={article.number} className="mb-4 last:mb-3">
                  <h3 className="text-[13px] font-bold text-slate-900">
                    {article.number}. {article.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-7 text-slate-600">
                    {article.body}
                  </p>
                </section>
              ))}
            </div>
            <div className="border-t border-slate-100 px-6 py-3">
              <button
                type="button"
                onClick={() => setTermsOpen(false)}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-xl bg-[#174D37] text-[12px] font-semibold text-white hover:bg-[#123D2C]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
