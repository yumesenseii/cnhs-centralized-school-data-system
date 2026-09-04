"use client";

import { Info } from "lucide-react";

/**
 * @param {{
 *   text?: string | null,
 *   actionLabel?: string,
 *   onAction?: () => void,
 * }} props
 */
export default function ReportInsightCallout({
  text,
  actionLabel,
  onAction,
}) {
  if (!text) return null;

  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-green-100 bg-cnhs-green-soft/80 px-3 py-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-white">
        <Info size={12} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium leading-relaxed text-cnhs-green-dark">
          {text}
        </p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-1.5 inline-flex cursor-pointer text-[11px] font-semibold text-cnhs-green-dark underline-offset-2 hover:underline"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
