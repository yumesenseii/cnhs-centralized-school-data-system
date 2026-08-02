"use client";

import { motion } from "framer-motion";
import { Bell, CheckCircle2, CircleAlert, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  bell: Bell,
  mail: Mail,
  alert: CircleAlert,
  check: CheckCircle2,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  purple: "bg-violet-50 text-violet-600",
  red: "bg-red-50 text-red-500",
  teal: "bg-teal-50 text-teal-600",
};

export default function NotificationStats({ cards }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = icons[card.icon] ?? Bell;

        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex min-h-[72px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                tones[card.tone] ?? tones.green
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-2xl font-semibold leading-none tracking-[-0.03em] text-slate-900">
                {card.count}
              </span>
              <span className="mt-1.5 block text-[11px] font-medium text-slate-500">
                {card.label}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
