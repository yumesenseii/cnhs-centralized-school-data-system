"use client";

/**
 * Dense label/value summary (Admin Reports → Summary tab).
 * @param {{ title?: string, rows: Array<[string, string|number|null|undefined]> }} props
 */
export default function ReportSummaryMetrics({
  title = "Summary · read-only",
  rows = [],
}) {
  return (
    <section>
      <h3 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {title}
      </h3>
      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0 rounded-lg border border-slate-100 bg-white px-3 py-1 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-3 border-b border-slate-50 py-1.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
          >
            <span className="min-w-0 text-[11px] text-slate-500">{label}</span>
            <strong className="shrink-0 text-[12px] font-semibold text-slate-800">
              {value == null || value === "" ? "—" : String(value)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}
