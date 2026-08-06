"use client";

/**
 * @param {{ title?: string, rows: Array<[string, string|number|null|undefined]> }} props
 */
export default function ReportSummaryMetrics({
  title = "Summary · read-only",
  rows = [],
}) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-800">
              {value == null || value === "" ? "—" : String(value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
