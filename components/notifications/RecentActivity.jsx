import { Zap } from "lucide-react";
import TimelineItem from "@/components/notifications/TimelineItem";

export default function RecentActivity({ title, items = [], loading = false }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-cnhs-orange">
          <Zap size={14} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
          {title}
        </h2>
      </div>

      {loading ? (
        <p className="px-1 py-6 text-center text-[12px] text-slate-400">
          Loading activity…
        </p>
      ) : items.length ? (
        <ol className="space-y-0">
          {items.map((item, index) => (
            <TimelineItem
              key={item.id}
              item={item}
              isLast={index === items.length - 1}
            />
          ))}
        </ol>
      ) : (
        <p className="px-1 py-6 text-center text-[12px] text-slate-400">
          No recent lesson plan activity yet.
        </p>
      )}
    </section>
  );
}
