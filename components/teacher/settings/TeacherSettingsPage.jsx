"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import ThemeSettingsCard from "@/components/settings/ThemeSettingsCard";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { cn } from "@/lib/utils";

function displayName(teacher, profile) {
  const parts = [
    teacher?.first_name,
    teacher?.middle_name,
    teacher?.last_name,
  ].filter(Boolean);
  return parts.join(" ").trim() || profile?.full_name || "Teacher";
}

function initialsFromName(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "T"
  );
}

function statusLabel(value) {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "inactive") return "Inactive";
  return "Active";
}

export default function TeacherSettingsPage() {
  const { changePassword } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [session, setSession] = useState(null);

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

  useEffect(() => {
    let active = true;
    async function load() {
      setProfileLoading(true);
      setProfileError("");
      const result = await getCurrentTeacherSession();
      if (!active) return;
      if (result.error) {
        setProfileError(result.error.message || "Unable to load profile.");
        setSession(null);
      } else {
        setSession(result.data);
      }
      setProfileLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const profileView = useMemo(() => {
    if (!session) return null;
    const { profile, teacher } = session;
    const name = displayName(teacher, profile);
    const tempPassword = String(profile?.temp_password ?? "").trim();
    const mustChange = Boolean(profile?.must_change_password) && Boolean(tempPassword);
    return {
      name,
      initials: initialsFromName(name),
      role: "Teacher",
      employeeId: teacher?.employee_number || "—",
      email: teacher?.email || "—",
      learningArea: teacher?.learning_area || "—",
      phone: teacher?.contact_number || "—",
      status: statusLabel(
        profile?.is_active === false ? "inactive" : teacher?.status
      ),
      mustChangePassword: mustChange,
      tempPassword: mustChange ? tempPassword : "",
    };
  }, [session]);

  async function handleCopyTemp() {
    if (!profileView?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(profileView.tempPassword);
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
    setSuccess("Password updated. Use it the next time you sign in.");
    setSession((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              must_change_password: false,
              temp_password: null,
            },
          }
        : prev
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3">
        <p className="text-[10px] font-medium text-slate-400">Home / Settings</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
          Settings
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Review your profile and update account security.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
          <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="mb-3 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Read-only. Ask the Head Teacher to update details in User
                Management.
              </p>
            </div>

            {profileLoading ? (
              <div className="flex items-center gap-2 py-6 text-[12px] text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading profile…
              </div>
            ) : profileError ? (
              <div className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-600">
                {profileError}
              </div>
            ) : profileView ? (
              <>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cnhs-green-soft text-[11px] font-semibold text-cnhs-green-dark">
                    {profileView.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-900">
                      {profileView.name}
                    </p>
                    <p className="text-[11px] text-slate-500">{profileView.role}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {[
                    ["Employee ID", profileView.employeeId],
                    ["Email", profileView.email],
                    ["Learning Area", profileView.learningArea],
                    ["Phone", profileView.phone],
                    ["Status", profileView.status],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 px-2.5 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                        {label}
                      </dt>
                      <dd className="mt-0.5 break-words text-[12px] font-medium text-slate-700">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="mb-3 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">Security</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                At least 8 characters. Confirm your current password first.
              </p>
            </div>

            {profileView?.mustChangePassword ? (
              <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-amber-700/80">
                      Temporary password
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[12px] font-semibold text-slate-800">
                      {profileView.tempPassword}
                    </p>
                    <p className="mt-1 text-[10px] text-amber-800/80">
                      Change this before continuing. It will disappear after you
                      update your password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyTemp}
                    className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-amber-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-amber-50"
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
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
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
        </div>

        <ThemeSettingsCard description="Choose how CNHS Learn looks on this browser. The theme stays after logout and when you return." />

        <section className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <div className="mb-3 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              About & Guidelines
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Cambaog National High School · CNHS Learn
            </p>
          </div>
          <ul className="space-y-2 text-[12px] leading-5 text-slate-600">
            <li>
              Use <span className="font-medium text-slate-800">My Classes</span>,{" "}
              <span className="font-medium text-slate-800">Input Grades</span>,{" "}
              <span className="font-medium text-slate-800">Lesson Plans</span>,
              monitoring, attendance, and reports for day-to-day work.
            </li>
            <li>
              Class assignments are set by the Head Teacher under{" "}
              <span className="font-medium text-slate-800">
                Classes & Sections
              </span>
              .
            </li>
            <li>
              Change the default temporary password after first login and do not
              share your credentials.
            </li>
            <li>
              Profile corrections (name, email, contact) must be requested from
              the Head Teacher.
            </li>
          </ul>
        </section>
      </div>
    </motion.div>
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
            "absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600"
          )}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>
    </label>
  );
}
