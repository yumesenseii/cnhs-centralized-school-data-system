"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  book: BookOpen,
  chart: BarChart3,
  users: Users,
  clipboard: ClipboardList,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-cnhs-orange",
  violet: "bg-violet-50 text-violet-600",
};

export default function ReportSummaryCards({ cards }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = icons[card.icon] ?? BookOpen;
        return (
          <motion.section
            key={card.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  tones[card.tone] ?? tones.green
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[12px] font-semibold text-slate-800">{card.title}</h3>
                <dl className="mt-3 space-y-2">
                  {card.metrics.map((metric) => (
                    <div key={metric.label} className="flex items-baseline justify-between gap-2">
                      <dt className="text-[10px] text-slate-400">{metric.label}</dt>
                      <dd className="text-[12px] font-semibold text-slate-800">{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
