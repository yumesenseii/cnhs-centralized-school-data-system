"use client";

import { useEffect, useId, useState } from "react";
import { Mail, X } from "lucide-react";
import { motion } from "framer-motion";
import LoginButton from "@/components/auth/LoginButton";
import LoginInput from "@/components/auth/LoginInput";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { loginContent } from "@/lib/constants/loginContent";
import { requestPasswordResetEmail } from "@/lib/supabase/queries/passwordReset";

/**
 * Forgot password — Edge Function → Brevo API (same BREVO_* secrets as welcome email).
 *
 * Operator checklist if mail does not arrive:
 * - Deploy: supabase functions deploy request-password-reset
 * - Secrets: BREVO_API_KEY, BREVO_SENDER_EMAIL, APP_ORIGIN (same as admin-create-user)
 * - Email must exist under Authentication → Users
 * - Brevo Transactional logs should show “CNHS Learn · Reset your password”
 * - Fallback: HT → User Management → Reset Password
 */
export default function ForgotPasswordModal({ open, onClose }) {
  const { form, validation } = loginContent;
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setError("");
    setSent(false);
    setLoading(false);
  }, [open]);

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
      await requestPasswordResetEmail(trimmed);
    } catch (err) {
      console.warn("[forgot-password] unexpected:", err);
    } finally {
      // Always the same success surface — do not reveal whether the account exists.
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      zClassName="z-[70]"
      className="bg-slate-900/40"
      panelClassName="cnhs-force-light-panel w-full max-w-[360px] rounded-2xl border border-slate-100 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:p-6"
      panelProps={{
        "data-force-light": "true",
        "data-keep-white": "true",
        style: {
          backgroundColor: "#ffffff",
          colorScheme: "light",
        },
      }}
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
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="space-y-3"
        >
          <div
            role="status"
            className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3.5 text-xs leading-5 text-[#174D37]"
            style={{
              backgroundColor: "#f0fdf4",
              borderColor: "#bbf7d0",
              color: "#174D37",
            }}
          >
            <p className="font-medium">{form.forgotSent}</p>
          </div>
          <p className="text-[12px] leading-5 text-slate-500">
            {form.forgotSentRetry}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {form.forgotClose}
            </button>
          </div>
        </motion.div>
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
    </AnimatedModal>
  );
}
