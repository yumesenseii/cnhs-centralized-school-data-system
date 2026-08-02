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
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h2 className="text-base font-semibold text-slate-800">Validation Summary</h2>
      <p className="mt-1 text-xs text-slate-400">Last updated: {lastValidated}</p>

      <div className="mt-4 space-y-3">
        {summary.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-500">{item.label}</span>
              <span className="font-semibold text-slate-700">{item.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${colors[item.tone]}`} style={{ width: `${item.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
