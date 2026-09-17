"use client";

/**
 * Dense label/value summary (Admin Reports → Summary tab).
 * @param {{ title?: string, rows: Array<[string, string|number|null|undefined]> }} props
 */
export default function ReportSummaryMetrics({
  title = "",
  rows = [],
}) {
  return (
    <section>
      {title ? (
        <h3 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {title}
        </h3>
      ) : null}
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0 rounded-lg border border-slate-100 bg-white px-3 py-1 dark:border-white/5 dark:bg-[var(--card)] sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-slate-50 py-1.5 last:border-b-0 dark:border-white/5 sm:[&:nth-last-child(2)]:border-b-0"
          >
            <span className="min-w-0 text-[11px] text-slate-500">{label}</span>
            <strong className="shrink-0 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {value == null || value === "" ? "—" : String(value)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
