"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

export default function ConfirmModal({
  open,
  title = "Confirm",
  message = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") onCancel?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(VIEW_MODAL_BACKDROP, "z-[100]")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div className="relative z-10 w-[min(22rem,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id="confirm-modal-title"
                className="text-[16px] font-semibold tracking-tight text-slate-900"
              >
                {title}
              </h2>
              {message ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                  {message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3.5 text-[12px] font-semibold text-white hover:bg-[#246f54]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
