"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";

function makeTempPassword() {
  return `CNHS-Tmp-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function ResetPasswordModal({
  open,
  user,
  onClose,
  onReset,
}) {
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(makeTempPassword);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGenerated(makeTempPassword());
    setCopied(false);
    setError("");
    setDone(false);
    setSaving(false);
  }, [open, user?.id]);

  function handleGenerate() {
    if (done) return;
    setGenerated(makeTempPassword());
    setCopied(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generated);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleConfirmReset() {
    if (!user?.authUserId) {
      setError("This account has no Auth user id to reset.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await onReset?.({
      authUserId: user.authUserId,
      temporaryPassword: generated,
    });
    setSaving(false);

    if (result?.error) {
      setError(result.error.message || "Unable to reset password.");
      return;
    }

    if (result?.data?.temporaryPassword) {
      setGenerated(result.data.temporaryPassword);
    }
    setDone(true);
    setCopied(false);
  }

  return (
    <AnimatedModal
      open={open && Boolean(user)}
      onClose={saving ? undefined : onClose}
      labelledBy="reset-password-title"
      zClassName="z-[60]"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      className="bg-slate-900/40"
      panelClassName="w-full max-w-[440px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
    >
      {user ? (
        <>
          <div className="border-b border-slate-100 px-4 py-3.5">
            <h2
              id="reset-password-title"
              className="text-lg font-semibold tracking-[-0.02em] text-slate-900"
            >
              Reset Password
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Set a temporary password for {user.fullName}. Share it securely;
              they should change it after login.
            </p>
          </div>

          <div className="space-y-3 px-4 py-3.5">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Confirm password reset for{" "}
              <span className="font-semibold">
                {user.email || "this account"}
              </span>
              .
              {done
                ? " Password has been updated in Auth."
                : " This will replace their current password immediately."}
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-slate-600">
                Temporary Password
              </p>
              <div className="flex items-center gap-2">
                <code className="flex h-10 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold tracking-wide text-slate-800">
                  {generated}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!done && !generated}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <AnimatedBanner message={error} tone="error" />

            <AnimatedBanner
              message={
                done
                  ? "Password reset successful. Copy and share the temporary password now — it will not be shown again later."
                  : ""
              }
              tone="success"
            />

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              {!done ? (
                <>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={saving}
                    className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    <KeyRound size={14} />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReset}
                    disabled={saving}
                    className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    Confirm Reset
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 cursor-pointer rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </AnimatedModal>
  );
}
