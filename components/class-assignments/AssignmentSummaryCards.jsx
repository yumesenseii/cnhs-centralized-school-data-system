"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  green: "text-emerald-700",
  blue: "text-blue-700",
  teal: "text-teal-700",
  violet: "text-violet-700",
};

export default function AssignmentSummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[72px] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <span>
              <span className={cn("block text-2xl font-bold leading-none tracking-tight", tones[card.tone] ?? tones.green)}>
                {card.count}
              </span>
              <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
