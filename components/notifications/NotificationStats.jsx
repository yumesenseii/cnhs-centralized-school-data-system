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
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = icons[card.icon] ?? Bell;

        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -1 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex min-h-0 items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]"
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                tones[card.tone] ?? tones.green
              )}
            >
              <Icon size={15} strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold leading-none tracking-[-0.03em] text-slate-900">
                {card.count}
              </span>
              <span className="mt-1 block truncate text-[10px] font-medium text-slate-500">
                {card.label}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
