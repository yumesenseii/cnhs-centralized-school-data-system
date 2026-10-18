"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  default: "text-slate-900 dark:text-slate-100",
  green: "text-slate-900 dark:text-slate-100",
  amber: "text-slate-900 dark:text-slate-100",
  orange: "text-slate-900 dark:text-slate-100",
  blue: "text-slate-900 dark:text-slate-100",
  red: "text-slate-900 dark:text-slate-100",
};

/**
 * Slim horizontal KPI strip — matches institutional school admin styling.
 */
export default function KPICards({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        return (
          <section
            key={kpi.id}
            className="relative flex min-h-[56px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-[var(--card)] dark:hover:border-white/20"
          >
            {kpi.alert ? (
              <span
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
            ) : null}
            <span className="min-w-0">
              <span className={cn("block text-base font-bold leading-5 tracking-tight", tones[kpi.tone] ?? tones.default)}>
                {kpi.value}
              </span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {kpi.label}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-3 text-slate-400">
                {kpi.description}
              </span>
            </span>
          </section>
        );
      })}
    </div>
  );
}
