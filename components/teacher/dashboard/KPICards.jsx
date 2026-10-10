"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  green: "text-emerald-700",
  blue: "text-blue-700",
  orange: "text-amber-800",
  red: "text-red-700",
};

/**
 * Slim horizontal KPI strip — matches Admin Academic Records SummaryCard.
 */
export default function KPICards({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        return (
          <motion.section
            key={kpi.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative flex min-h-[56px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
          >
            {kpi.alert ? (
              <span
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cnhs-orange"
                aria-hidden="true"
              />
            ) : null}
            <span className="min-w-0">
              <span className={cn("block text-base font-bold leading-5 tracking-tight", tones[kpi.tone] ?? tones.green)}>
                {kpi.value}
              </span>
              <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {kpi.label}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-3 text-slate-400">
                {kpi.description}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
