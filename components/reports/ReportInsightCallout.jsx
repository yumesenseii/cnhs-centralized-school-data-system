"use client";

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
    <p className="text-[12px] leading-relaxed text-slate-500">
      {text}
      {actionLabel && onAction ? (
        <>
          {" "}
          <button
            type="button"
            onClick={onAction}
            className="inline cursor-pointer font-semibold text-cnhs-green-dark underline-offset-2 hover:underline"
          >
            {actionLabel}
          </button>
        </>
      ) : null}
    </p>
  );
}
