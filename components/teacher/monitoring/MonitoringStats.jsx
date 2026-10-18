"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: institutional school software — white card, dark neutral number
const tones = {
  default: "text-slate-900 dark:text-slate-100",
  blue: "text-slate-900 dark:text-slate-100",
  orange: "text-slate-900 dark:text-slate-100",
  amber: "text-slate-900 dark:text-slate-100",
  green: "text-slate-900 dark:text-slate-100",
  red: "text-slate-900 dark:text-slate-100",
};

export default function MonitoringStats({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        return (
          <section
            key={kpi.id}
            className="relative min-h-[88px] rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-[var(--card)] dark:hover:border-white/20"
          >
            {kpi.alert ? (
              <span
                className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-red-500"
                aria-hidden="true"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
              <p className={cn("mt-1 text-2xl font-bold leading-none tracking-tight", tones[kpi.tone] ?? tones.default)}>
                {kpi.value}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">{kpi.description}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
