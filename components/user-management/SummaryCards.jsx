"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  default: "text-slate-900 dark:text-slate-100",
  green: "text-slate-900 dark:text-slate-100",
  teal: "text-slate-900 dark:text-slate-100",
  purple: "text-slate-900 dark:text-slate-100",
  amber: "text-slate-900 dark:text-slate-100",
  red: "text-slate-900 dark:text-slate-100",
};

export default function SummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        return (
          <section
            key={card.id}
            className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-[var(--card)] dark:hover:border-white/20"
          >
            <span>
              <span className={cn("block text-2xl font-bold leading-none tracking-tight", tones[card.tone] ?? tones.default)}>
                {card.count}
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</span>
            </span>
          </section>
        );
      })}
    </div>
  );
}
