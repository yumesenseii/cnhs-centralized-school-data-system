import { cn } from "@/lib/utils";

export default function MonitoringProgress({ monitoring }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <h2 className="mb-2.5 text-sm font-semibold text-slate-900">Weekly Monitoring Progress</h2>

      <div className="grid grid-cols-3 gap-2.5">
        <SummaryChip label="Completed" value={monitoring.completed} tone="green" />
        <SummaryChip label="Pending" value={monitoring.pending} tone="orange" />
        <SummaryChip label="Overdue" value={monitoring.overdue} tone="red" />
      </div>

      <div className="mt-3 space-y-3.5">
        {monitoring.weeks.map((week) => (
          <div key={week.id}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">{week.label}</span>
              <span className="text-[11px] font-semibold text-cnhs-green-dark">{week.percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cnhs-green transition-all"
                style={{ width: `${week.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryChip({ label, value, tone }) {
  const tones = {
    green: "bg-green-50 text-cnhs-green-dark",
    orange: "bg-orange-50 text-cnhs-orange",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className={cn("rounded-xl px-3 py-2 text-center", tones[tone])}>
      <p className="text-lg font-semibold tracking-[-0.02em]">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] opacity-80">
        {label}
      </p>
    </div>
  );
}
