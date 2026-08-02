"use client";

const tones = {
  violet: "bg-violet-50 text-violet-600",
  blue: "bg-sky-50 text-sky-600",
  green: "bg-green-50 text-cnhs-green-dark",
  orange: "bg-orange-50 text-cnhs-orange",
  red: "bg-red-50 text-red-500",
};

export default function MonitoringRecentActivity({ activities }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
      <ul className="mt-4 space-y-3">
        {activities.map((item) => (
          <li key={item.id} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${tones[item.tone] ?? tones.blue}`}
            >
              {item.title.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-slate-800">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{item.description}</p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">{item.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
