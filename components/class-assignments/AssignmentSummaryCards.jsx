"use client";

import { cn } from "@/lib/utils";

export default function AssignmentSummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        return (
          <section
            key={card.id}
            className="flex min-h-[64px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[var(--card)]"
          >
            <span>
              <span className="block text-2xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                {card.count}
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
            </span>
          </section>
        );
      })}
    </div>
  );
}
