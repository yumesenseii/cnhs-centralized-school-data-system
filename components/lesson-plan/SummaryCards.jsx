"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  hourglass: Hourglass,
  check: CheckCircle2,
  alert: AlertCircle,
};

const tones = {
  orange: "bg-orange-50 text-cnhs-orange",
  green: "bg-green-50 text-cnhs-green-dark",
  red: "bg-red-50 text-red-500",
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
        const Icon = icons[card.icon] ?? Hourglass;

        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[56px] items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                tones[card.tone]
              )}
            >
              <Icon size={14} strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-5 tracking-[-0.03em] text-slate-900">
                {card.count}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-medium leading-3 text-slate-500">
                {card.label}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
