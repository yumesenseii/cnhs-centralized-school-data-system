"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "lucide-react";
import HelpFooter from "@/components/auth/HelpFooter";
import LoginButton from "@/components/auth/LoginButton";
import LoginInput from "@/components/auth/LoginInput";
import PasswordInput from "@/components/auth/PasswordInput";
import RememberMe from "@/components/auth/RememberMe";
import { useAuth } from "@/hooks/useAuth";
import { loginContent } from "@/lib/constants/loginContent";

function resolveRedirect(role) {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "admin" || normalized === "administrator") {
    return "/dashboard";
  }
  if (normalized === "teacher") {
    return "/teacher/dashboard";
  }
  if (normalized === "student") {
    return "/student/dashboard";
  }
  return null;
}

export default function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { form, errors, validation } = loginContent;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  function validateFields() {
    const nextErrors = { email: "", password: "" };
    const trimmedEmail = email.trim();

    if (!trimmedEmail) nextErrors.email = validation.emailRequired;
    if (!password) nextErrors.password = validation.passwordRequired;

    setFieldErrors(nextErrors);

    if (!trimmedEmail || !password) {
      setServerError(validation.emptyFields);
      return false;
    }

    setServerError("");
    return true;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError("");

    if (!validateFields()) return;

    setLoading(true);

    try {
      const result = await signIn({
        email: email.trim(),
        password,
        rememberMe,
      });

      if (result?.error || !result?.data) {
        setServerError(errors.invalidCredentials);
        return;
      }

      const destination = resolveRedirect(result.data.role);
      if (!destination) {
        setServerError("Unauthorized account.");
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setServerError(errors.networkError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-panel relative flex h-full flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:w-[52%] lg:px-12">
      <div
        className="deco-form-br pointer-events-none absolute bottom-4 right-4 sm:bottom-6 sm:right-6"
        aria-hidden="true"
      >
        <span className="mosaic mosaic--g1 absolute right-0 top-2 h-8 w-8 rounded-md bg-[#174D37]" />
        <span className="mosaic mosaic--y1 absolute right-7 top-0 h-6 w-6 rounded-full bg-[#F4C430]" />
        <span className="mosaic mosaic--g2 absolute right-3 top-10 h-7 w-7 rounded-full border-[3px] border-[#2F7D5F]" />
        <span className="mosaic mosaic--g4 absolute right-12 top-8 h-5 w-5 rounded-sm bg-[#86C5A5]" />
        <span className="absolute right-10 top-14 h-4 w-4 rounded-full bg-[#F4C430]/80" />
        <span className="absolute right-16 top-4 h-3 w-3 rounded-full bg-white shadow-sm" />
        <span className="absolute right-1 top-14 h-3 w-3 rounded-sm bg-[#F4C430]" />
      </div>

      <motion.div
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.08 }}
        className="form-card mx-auto w-full max-w-[360px] rounded-2xl border border-slate-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <header className="portal-form__header mb-6">
          <h2 className="text-[28px] font-bold tracking-[-0.03em] text-[#174D37]">
            {form.title}
          </h2>
          <p className="mt-1 text-[13px] text-slate-400">{form.subtitle}</p>
        </header>

        <AnimatePresence>
          {serverError ? (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="login-server-error mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600"
              role="alert"
            >
              {serverError}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <form
          id="loginForm"
          className="portal-form__body space-y-1"
          method="post"
          onSubmit={handleSubmit}
          noValidate
        >
          <LoginInput
            id="email"
            name="email"
            label={form.usernameLabel}
            placeholder={form.usernamePlaceholder}
            icon={User}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (fieldErrors.email) {
                setFieldErrors((prev) => ({ ...prev, email: "" }));
              }
            }}
            autoComplete="username"
            required
            error={fieldErrors.email}
          />

          <PasswordInput
            id="password"
            name="password"
            label={form.passwordLabel}
            placeholder={form.passwordPlaceholder}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (fieldErrors.password) {
                setFieldErrors((prev) => ({ ...prev, password: "" }));
              }
            }}
            required
            error={fieldErrors.password}
          />

          <div className="options-row py-2">
            <RememberMe
              checked={rememberMe}
              onChange={setRememberMe}
              label={form.rememberMe}
              forgotLabel={form.forgotPassword}
              onForgot={() => {
                // UI only — password reset will connect later.
              }}
            />
          </div>

          <div className="pt-1">
            <LoginButton loading={loading}>{form.submit}</LoginButton>
          </div>
        </form>

        <div className="mt-4">
          <HelpFooter text={form.help} />
        </div>
      </motion.div>
    </div>
  );
}
