export default function SummaryStatistics({ stats }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        Summary Statistics
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-center"
          >
            <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">{item.value}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
