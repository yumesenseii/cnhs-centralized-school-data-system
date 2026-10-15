"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function BulkActionConfirmModal({
  isOpen,
  action, // "remedial" | "monitoring"
  count = 0,
  working = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && !working) onCancel?.();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, working, onCancel]);

  if (!isOpen) return null;

  const isRemedial = action === "remedial";
  const title = isRemedial
    ? `Start Class Remedial for ${count} learner${count === 1 ? "" : "s"}?`
    : `Continue Monitoring for ${count} learner${count === 1 ? "" : "s"}?`;
  const message = isRemedial
    ? "This will place the selected learners under class support."
    : "The selected learners will remain under teacher monitoring.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-action-modal-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-150"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl transition-all duration-150 dark:border-white/10 dark:bg-[#1a1f26]"
      >
        <h3
          id="bulk-action-modal-title"
          className="text-base font-bold text-slate-900 dark:text-white"
        >
          {title}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {message}
        </p>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={working}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#1b5842] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working ? <Loader2 size={13} className="animate-spin" /> : null}
            <span>Confirm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
