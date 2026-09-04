const colors = {
  green: "bg-cnhs-green",
  orange: "bg-cnhs-orange",
  red: "bg-red-500",
};

export default function ValidationSummary({
  summary,
  lastValidated = "—",
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <h2 className="text-[13px] font-semibold text-slate-800">
        Validation Summary
      </h2>
      <p className="mt-0.5 text-[9px] text-slate-400">
        Last updated: {lastValidated}
      </p>

      <div className="mt-2.5 space-y-2">
        {summary.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-semibold text-slate-700">{item.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${colors[item.tone]}`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
