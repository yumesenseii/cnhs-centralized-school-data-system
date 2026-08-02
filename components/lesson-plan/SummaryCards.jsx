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

export default function SummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const Icon = icons[card.icon] ?? Hourglass;

        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[64px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          >
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", tones[card.tone])}>
              <Icon size={16} strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-xl font-semibold leading-none tracking-[-0.03em] text-slate-900">
                {card.count}
              </span>
              <span className="mt-1 block text-[11px] font-medium text-slate-500">{card.label}</span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
