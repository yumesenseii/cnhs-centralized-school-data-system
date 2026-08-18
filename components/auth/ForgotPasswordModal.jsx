"use client";

import { useEffect, useId, useState } from "react";
import { Mail, X } from "lucide-react";
import LoginButton from "@/components/auth/LoginButton";
import LoginInput from "@/components/auth/LoginInput";
import { loginContent } from "@/lib/constants/loginContent";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordModal({ open, onClose }) {
  const { form, validation } = loginContent;
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    setEmail("");
    setError("");
    setSent(false);
    setLoading(false);

    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError(validation.emailRequired);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      // Redirect URL must be listed in Supabase Auth → URL Configuration
      // (Site URL + Redirect URLs), e.g. http://localhost:3000/login/reset-password
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/login/reset-password`,
      });
    } catch {
      // Keep the generic success message so we do not leak whether the email exists.
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[360px] rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:p-6"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="text-lg font-bold tracking-[-0.03em] text-[#174D37]"
          >
            {form.forgotTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label={form.forgotClose}
          >
            <X size={16} />
          </button>
        </div>

        {sent ? (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] font-medium leading-5 text-cnhs-green-dark">
            {form.forgotSent}
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <p className="mb-3 text-[12px] leading-5 text-slate-500">
              {form.forgotHint}
            </p>
            <LoginInput
              id="forgot-email"
              name="forgot-email"
              type="email"
              label={form.forgotEmailLabel}
              placeholder={form.forgotEmailPlaceholder}
              icon={Mail}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError("");
              }}
              autoComplete="email"
              required
              error={error}
            />
            <div className="pt-1">
              <LoginButton loading={loading}>{form.forgotSubmit}</LoginButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
