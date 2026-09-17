"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const supabase = createClient();

export default function StudentSecurityCard() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFlags() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || !active) return;

      const { data } = await supabase
        .from("profiles")
        .select("must_change_password, temp_password")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!active || !data) return;
      const temp = String(data.temp_password ?? "").trim();
      const flag = Boolean(data.must_change_password) && Boolean(temp);
      setMustChange(flag);
      setTempPassword(flag ? temp : "");
    }
    loadFlags();
    return () => {
      active = false;
    };
  }, []);

  async function handleCopyTemp() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    const result = await changePassword({
      currentPassword,
      newPassword,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error.message || "Unable to change password.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMustChange(false);
    setTempPassword("");
    setSuccess("Password updated. Use it the next time you sign in.");
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <div className="mb-2.5 border-b border-border pb-2.5">
        <h2 className="text-[13px] font-semibold text-card-foreground">Security</h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          At least 8 characters. Confirm your current password first.
        </p>
      </div>

      {mustChange && tempPassword ? (
        <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-amber-700/80">
                Temporary password
              </p>
              <p className="mt-0.5 break-all font-mono text-[12px] font-semibold text-slate-800">
                {tempPassword}
              </p>
              <p className="mt-1 text-[10px] text-amber-800/80">
                Change this before continuing. It will disappear after you update
                your password.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyTemp}
              className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-amber-200 bg-card px-2 text-[10px] font-semibold text-card-foreground transition-colors duration-200 hover:bg-amber-50 dark:border-amber-800/50 dark:hover:bg-amber-950/40"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <form className="space-y-2.5" onSubmit={handleSubmit}>
        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
          autoComplete="current-password"
        />
        <PasswordField
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          autoComplete="new-password"
          minLength={8}
        />
        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          autoComplete="new-password"
          minLength={8}
        />

        {error ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-600">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-green-100 bg-green-50 px-2.5 py-2 text-[11px] font-medium text-cnhs-green-dark">
            {success}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark text-[11px] font-semibold text-white transition-colors duration-200 hover:bg-[#246f54] active:bg-[#1f5f48] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <KeyRound size={13} />
          )}
          Update Password
        </button>
      </form>
    </section>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  minLength,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-600">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-9 text-[12px] text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className={cn(
            "absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors duration-200 hover:bg-muted hover:text-card-foreground"
          )}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </label>
  );
}
