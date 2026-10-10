"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  green: "text-emerald-700",
  blue: "text-blue-700",
  orange: "text-amber-800",
  violet: "text-violet-700",
};

export default function ReportSummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const valueTone = tones[card.tone] ?? tones.green;
        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="min-w-0">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.title}</h3>
              <dl className="mt-3 space-y-2">
                {card.metrics.map((metric) => (
                  <div key={metric.label} className="flex items-baseline justify-between gap-2">
                    <dt className="text-[10px] text-slate-400">{metric.label}</dt>
                    <dd className={cn("text-[12px] font-bold", valueTone)}>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
