"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Shield, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  users: Users,
  teacher: UserRound,
  shield: Shield,
  check: CheckCircle2,
};

const tones = {
  teal: "bg-teal-50 text-teal-600",
  green: "bg-green-50 text-cnhs-green-dark",
  purple: "bg-amber-50 text-amber-700",
};

export default function SummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = icons[card.icon] ?? Users;

        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                tones[card.tone] ?? tones.green
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-xl font-semibold leading-none tracking-[-0.03em] text-slate-900">
                {card.count}
              </span>
              <span className="mt-1 block text-[10px] font-medium leading-4 text-slate-500">{card.label}</span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
