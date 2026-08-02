const barColors = {
  green: "bg-cnhs-green",
  orange: "bg-cnhs-orange",
  red: "bg-red-500",
};

export default function QuarterSummary({ summary }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h2 className="text-sm font-semibold text-slate-800">This Quarter</h2>
      <div className="mt-4 space-y-3">
        {summary.map((item) => (
          <div key={item.label} className="grid grid-cols-[1fr_86px_18px] items-center gap-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barColors[item.tone]}`} style={{ width: `${item.percent}%` }} />
            </div>
            <span className="text-right text-[11px] text-slate-500">{item.label}</span>
            <span className="text-right text-[11px] font-semibold text-slate-700">{item.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
