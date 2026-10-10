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

export default function ReportSummaryCards({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        return (
          <motion.section
            key={stat.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {stat.label}
              </p>
              <p className={cn("mt-1 text-2xl font-bold leading-none tracking-tight", tones[stat.tone] ?? tones.green)}>
                {stat.value}
              </p>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
