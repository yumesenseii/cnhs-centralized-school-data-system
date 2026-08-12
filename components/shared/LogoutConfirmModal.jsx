"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

const LOGOUT_MESSAGE =
  "Are you sure you want to log out? You will need to sign in again to continue.";

/**
 * Centered logout confirmation for Teacher / Admin / Student sidebars.
 * Portaled to document.body so it sits above mobile sheet / sidebar stacking.
 */
export default function LogoutConfirmModal({
  open,
  onCancel,
  onConfirm,
  confirming = false,
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

  return createPortal(
    <div
      className={cn(VIEW_MODAL_BACKDROP, "z-[100]")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onCancel?.();
      }}
    >
      <div className="relative z-10 w-[min(22rem,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cnhs-green/10 text-cnhs-green-dark">
              <LogOut size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id="logout-confirm-title"
                className="text-[16px] font-semibold tracking-tight text-slate-900"
              >
                Log out
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                {LOGOUT_MESSAGE}
              </p>
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
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
          >
            <LogOut size={14} />
            {confirming ? "Logging out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
