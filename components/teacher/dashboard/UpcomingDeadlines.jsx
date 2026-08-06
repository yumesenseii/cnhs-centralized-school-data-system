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
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <CalendarDays size={11} />
        </span>
        <h2 className="text-sm font-semibold text-slate-900">
          Upcoming Deadlines
        </h2>
      </div>

      <ul className="divide-y divide-slate-100">
        {deadlines.length ? (
          deadlines.map((item) => {
            const tone = tones[item.tone] ?? tones.slate;

            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 px-3 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[11px] font-semibold text-slate-700">
                    {item.title}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    tone.badge
                  )}
                >
                  {item.when}
                </span>
              </li>
            );
          })
        ) : (
          <li className="px-3 py-5 text-center text-[11px] text-slate-500">
            No deadlines are configured in the current data.
          </li>
        )}
      </ul>
    </section>
  );
}
