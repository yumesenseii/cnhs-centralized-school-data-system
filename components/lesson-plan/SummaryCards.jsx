"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  orange: "text-amber-800",
  green: "text-emerald-700",
  red: "text-red-700",
};

/** OneData-style slim KPI strip (4-up when 4 cards). */
export default function SummaryCards({ cards = [] }) {
  const count = cards.length;
  const gridClass =
    count >= 4
      ? "grid-cols-2 gap-2 sm:grid-cols-4"
      : "grid-cols-1 gap-2 sm:grid-cols-3";

  return (
    <div className={cn("grid", gridClass)}>
      {cards.map((card) => {
        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[56px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
          >
            <span className="min-w-0">
              <span className={cn("block text-base font-bold leading-5 tracking-tight", tones[card.tone] ?? tones.green)}>
                {card.count}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
