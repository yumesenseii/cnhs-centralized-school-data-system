"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  default: "text-slate-900 dark:text-slate-100",
  green: "text-slate-900 dark:text-slate-100",
  orange: "text-slate-900 dark:text-slate-100",
  amber: "text-slate-900 dark:text-slate-100",
  red: "text-slate-900 dark:text-slate-100",
  blue: "text-slate-900 dark:text-slate-100",
};

export default function SummaryCard({ card }) {
  return (
    <section
      className="flex min-h-[56px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-[var(--card)] dark:hover:border-white/20"
    >
      <span className="min-w-0">
        <span className={cn("block text-base font-bold leading-5 tracking-tight", tones[card.tone] ?? tones.default)}>
          {card.value}
        </span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</span>
        <span className="mt-0.5 block truncate text-[9px] leading-3 text-slate-400">{card.subtext}</span>
      </span>
    </section>
  );
}
