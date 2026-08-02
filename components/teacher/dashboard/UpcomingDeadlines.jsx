import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  red: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-600",
  },
  orange: {
    dot: "bg-cnhs-orange",
    badge: "bg-orange-50 text-cnhs-orange",
  },
  slate: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-500",
  },
};

export default function UpcomingDeadlines({ deadlines }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <CalendarDays size={14} />
        </span>
        <h2 className="text-sm font-semibold text-slate-900">Upcoming Deadlines</h2>
      </div>

      <ul className="space-y-3">
        {deadlines.length ? deadlines.map((item) => {
          const tone = tones[item.tone] ?? tones.slate;

          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden="true" />
                <span className="truncate text-[12px] font-semibold text-slate-700">{item.title}</span>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold", tone.badge)}>
                {item.when}
              </span>
            </li>
          );
        }) : (
          <li className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-8 text-center text-xs text-slate-500">
            No deadlines are configured in the current data.
          </li>
        )}
      </ul>
    </section>
  );
}
