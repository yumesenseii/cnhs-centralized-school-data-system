"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  book: BookOpen,
  chart: BarChart3,
  alert: AlertTriangle,
  clock: Clock3,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-cnhs-orange",
  red: "bg-red-50 text-red-500",
};

export default function ReportSummaryCards({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = icons[stat.icon] ?? BookOpen;
        return (
          <motion.section
            key={stat.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  tones[stat.tone] ?? tones.green
                )}
              >
                <Icon size={15} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-0.5 text-[22px] font-semibold leading-none tracking-[-0.03em] text-slate-900">
                  {stat.value}
                </p>
              </div>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
