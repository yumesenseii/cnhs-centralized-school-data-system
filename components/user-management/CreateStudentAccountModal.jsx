"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Search, UserRound } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import { cn } from "@/lib/utils";

function PreviewField({ label, value }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-b-0 dark:border-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}

function LearnerPreview({ selected }) {
  if (!selected) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <UserRound size={22} strokeWidth={1.6} />
        </span>
        <p className="mt-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          Select a learner to preview
        </p>
        <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-slate-400 dark:text-slate-500">
          Choose a name from the list on the right to review details before
          creating a portal account.
        </p>
      </div>
    );
  }

  const learnerStatus = String(selected.learnerStatus ?? "active");
  const statusLabel =
    learnerStatus.charAt(0).toUpperCase() + learnerStatus.slice(1).toLowerCase();

  return (
    <div className="flex h-full flex-col px-5 py-5 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
        Learner preview
      </p>

      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cnhs-green-soft text-[13px] font-semibold text-cnhs-green-dark dark:bg-cnhs-green-dark/30 dark:text-emerald-200">
          {selected.initials || "—"}
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.02em] text-slate-900 dark:text-white">
            {selected.fullName}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {selected.studentNumber}
          </p>
        </div>
      </div>

      <div className="mt-5 flex-1">
        <PreviewField label="Student number (LRN)" value={selected.studentNumber} />
        <PreviewField label="Grade · Section" value={selected.gradeSection} />
        <PreviewField label="Portal link" value={selected.linkLabel || "Not linked"} />
        <PreviewField label="Learner status" value={statusLabel} />
      </div>

      <p className="mt-4 text-[10px] leading-4 text-slate-400 dark:text-slate-500">
        This learner already exists in class records. Creating an account only
        adds a portal login.
      </p>
    </div>
  );
}

export default function CreateStudentAccountModal({
  open,
  students = [],
  onClose,
  onSubmit,
}) {
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);

  const unlinked = useMemo(
    () => (students ?? []).filter((row) => !row.linked),
    [students]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unlinked.slice(0, 25);
    return unlinked
      .filter((row) => {
        const hay = `${row.fullName} ${row.studentNumber} ${row.gradeSection ?? ""}`
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 25);
  }, [query, unlinked]);

  const selected = unlinked.find((row) => row.id === studentId) ?? null;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setStudentId("");
    setEmail("");
    setError("");
    setDone(null);
    setCopied(false);
    setSaving(false);
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!studentId) {
      setError("Select an existing learner (LRN / name).");
      return;
    }
    if (!email.trim()) {
      setError("Email is required to deliver sign-in details.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await onSubmit?.({
      studentId,
      email: email.trim(),
    });
    setSaving(false);

    if (result?.error) {
      setError(result.error.message || "Unable to create student account.");
      return;
    }

    setDone(result?.data ?? { ok: true });
  }

  async function handleCopyPassword() {
    const password = done?.temporaryPassword;
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <AnimatedModal
      open={open}
      onClose={saving ? undefined : onClose}
      labelledBy="create-student-account-title"
      zClassName="z-[60]"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      className="bg-slate-900/50"
      panelClassName={
        done
          ? "w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
          : "w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
      }
    >
      {done ? (
        <div className="space-y-3 px-5 py-5">
          <h2
            id="create-student-account-title"
            className="text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white"
          >
            Account created
          </h2>
          <AnimatedBanner
            message={
              done.emailSent
                ? `Temporary password sent to ${done.user?.email || email}.`
                : `Email could not be sent${
                    done.emailError ? ` (${done.emailError})` : ""
                  }. Copy the temporary password below.`
            }
            tone={done.emailSent ? "success" : "info"}
          />
          {done.temporaryPassword ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-3 dark:border-amber-800/50 dark:bg-amber-950/40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800 dark:text-amber-200">
                Temporary password (show once)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-amber-900/40 dark:bg-slate-950 dark:text-amber-100">
                  {done.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-[11px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 cursor-pointer items-center rounded-full bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white hover:bg-[#246f54]"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[0.92fr_1.08fr]">
          <aside className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50 md:border-b-0 md:border-r">
            <LearnerPreview selected={selected} />
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
              <h2
                id="create-student-account-title"
                className="text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white"
              >
                Create student account
              </h2>
              <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">
                Link an existing learner to a portal login. Emails come from the
                school contact list — ECR has no email. Students cannot
                self-register.
              </p>
            </div>

            <form
              className="flex flex-1 flex-col px-5 py-4 sm:px-6"
              onSubmit={handleSubmit}
            >
              {error ? (
                <div className="mb-3">
                  <AnimatedBanner message={error} tone="error" />
                </div>
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Find learner (LRN or name)
                </span>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search unlinked learners…"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:ring-2 focus:ring-cnhs-green/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>
              </label>

              <div className="mt-3 max-h-[200px] flex-1 overflow-y-auto rounded-lg bg-slate-50/40 dark:bg-slate-950/40">
                {matches.length ? (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {matches.map((row) => {
                      const active = row.id === studentId;
                      return (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => setStudentId(row.id)}
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-between gap-3 border-l-2 px-3 py-2.5 text-left transition-colors",
                              active
                                ? "border-l-cnhs-green bg-cnhs-green-soft/80 text-cnhs-green-dark dark:bg-cnhs-green-dark/25 dark:text-emerald-100"
                                : "border-l-transparent text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-900/80"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-semibold">
                                {row.fullName}
                              </span>
                              {row.gradeSection && row.gradeSection !== "—" ? (
                                <span className="mt-0.5 block truncate text-[10px] font-medium opacity-70">
                                  {row.gradeSection}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] opacity-80">
                              {row.studentNumber}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-3 py-8 text-center text-[12px] text-slate-400 dark:text-slate-500">
                    {unlinked.length
                      ? "No matches."
                      : "All listed learners already have accounts."}
                  </p>
                )}
              </div>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Email (parent / learner)
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@email.com"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:ring-2 focus:ring-cnhs-green/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>

              <div className="mt-auto flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !studentId || !email.trim()}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {saving ? "Creating…" : "Create account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AnimatedModal>
  );
}
