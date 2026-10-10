"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  blue: "text-blue-700",
  orange: "text-amber-800",
  green: "text-emerald-700",
  red: "text-red-700",
};

export default function MonitoringStats({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        return (
          <motion.section
            key={kpi.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative min-h-[88px] rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            {kpi.alert ? (
              <span
                className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-red-500"
                aria-hidden="true"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
              <p className={cn("mt-1 text-2xl font-bold leading-none tracking-tight", tones[kpi.tone] ?? tones.blue)}>
                {kpi.value}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">{kpi.description}</p>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
