"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const tones = {
  teal: "text-teal-700",
  green: "text-emerald-700",
  purple: "text-amber-800",
};

export default function SummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[68px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]"
          >
            <span>
              <span className={cn("block text-2xl font-bold leading-none tracking-tight", tones[card.tone] ?? tones.green)}>
                {card.count}
              </span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
