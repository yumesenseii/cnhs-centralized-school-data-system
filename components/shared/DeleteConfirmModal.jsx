"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Eraser, Send, Trash2 } from "lucide-react";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

const ICONS = {
  delete: Trash2,
  clear: Eraser,
  request: Send,
};

/**
 * Confirm overlay for admin delete/clear and teacher delete requests.
 * Cancel | action only — no type-to-confirm.
 */
export default function DeleteConfirmModal({
  open,
  title = "Delete",
  itemLabel = "",
  consequence = "",
  confirmLabel = "Delete",
  confirming = false,
  confirmingLabel = "Working…",
  tone = "danger",
  icon = "delete",
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape" && !confirming) onCancel?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, confirming, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const Icon = ICONS[icon] ?? Trash2;
  const isRequest = tone === "request";

  return createPortal(
    <div
      className={cn(VIEW_MODAL_BACKDROP, "z-[100]")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onCancel?.();
      }}
    >
      <div className="relative z-10 w-[min(22rem,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                isRequest
                  ? "bg-cnhs-green/10 text-cnhs-green-dark"
                  : "bg-red-50 text-red-600"
              )}
            >
              <Icon size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id="delete-confirm-title"
                className="text-[16px] font-semibold tracking-tight text-slate-900"
              >
                {title}
              </h2>
              {itemLabel ? (
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-800">
                  {itemLabel}
                </p>
              ) : null}
              {consequence ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                  {consequence}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center rounded-lg px-3.5 text-[12px] font-semibold text-white disabled:opacity-50",
              isRequest
                ? "bg-cnhs-green-dark hover:bg-[#246f54]"
                : "bg-red-600 hover:bg-red-700"
            )}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
