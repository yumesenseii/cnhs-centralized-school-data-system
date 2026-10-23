export default function AralCorrectionHistory({ learner }) {
  const corrections = (learner?.rawPayload?.auditTrail || []).filter((entry) => entry.action === "assessment_corrected");
  return <>
    {learner?.readingCorrectionNeedsReview && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      An earlier assessment was corrected. Review this period’s saved results. Its results and intervention progress have been kept.
    </p>}
    {corrections.length > 0 && <details className="rounded-lg border border-slate-200 p-3 text-xs dark:border-white/10">
      <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">Correction History ({corrections.length})</summary>
      <ul className="mt-2 space-y-2 text-slate-600 dark:text-slate-300">{corrections.map((entry, index) => <li key={`${entry.timestamp}_${index}`}>
        <p>{entry.reason}</p>
        <p className="text-[11px] text-slate-500">Previously: GST {entry.previousScore ?? "not recorded"} · {entry.previousReadingLevel || "Not assessed"}</p>
        <time className="text-[11px] text-slate-500">{entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-PH") : ""}</time>
      </li>)}</ul>
    </details>}
  </>;
}
