"use client";

import { cn } from "@/lib/utils";

const toneSwatch = {
  green: "bg-green-50 dark:bg-cnhs-green/25",
  orange: "bg-orange-50 dark:bg-cnhs-orange/25",
  red: "bg-red-50 dark:bg-cnhs-red/25",
  blue: "bg-sky-50 dark:bg-sky-500/25",
  slate: "bg-slate-100 dark:bg-white/10",
};

/**
 * @param {{ items: Array<{ id: string, label: string, value: string|number, hint?: string, badge?: string, tone?: string }> }} props
 */
export default function ReportKpiStrip({ items = [] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative min-w-0 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {item.label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.03em] text-slate-900 dark:text-slate-100">
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              {item.hint}
            </p>
          ) : null}
          <span
            className={cn(
              "absolute right-2 top-2 h-6 w-6 rounded-md opacity-80",
              toneSwatch[item.tone] ?? toneSwatch.slate
            )}
            aria-hidden
          />
        </div>
      ))}
    </div>
  );
}
