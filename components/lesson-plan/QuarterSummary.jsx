const barColors = {
  green: "bg-cnhs-green",
  orange: "bg-cnhs-orange",
  red: "bg-red-500",
};

export default function QuarterSummary({ summary = [] }) {
  return (
    <section className="h-fit rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none">
      <h2 className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
        This Quarter
      </h2>
      <div className="mt-2 space-y-2">
        {summary.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[1fr_78px_16px] items-center gap-2"
          >
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div
                className={`h-full rounded-full ${barColors[item.tone]}`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
            <span className="text-right text-[10px] text-slate-500 dark:text-slate-400">
              {item.label}
            </span>
            <span className="text-right text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
