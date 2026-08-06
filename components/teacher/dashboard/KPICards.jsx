"use client";

import { motion } from "framer-motion";
import { BookOpen, ClipboardList, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  book: BookOpen,
  users: Users,
  file: FileText,
  clipboard: ClipboardList,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  blue: "bg-indigo-50 text-indigo-600",
  orange: "bg-orange-50 text-cnhs-orange",
  red: "bg-red-50 text-red-600",
};

/**
 * Slim horizontal KPI strip — matches Admin Academic Records SummaryCard.
 */
export default function KPICards({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = icons[kpi.icon] ?? BookOpen;

        return (
          <motion.section
            key={kpi.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative flex min-h-[56px] items-center gap-2.5 rounded-xl border border-slate-100 bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-shadow hover:shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
          >
            {kpi.alert ? (
              <span
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cnhs-orange"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                tones[kpi.tone] ?? tones.green
              )}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold leading-5 tracking-[-0.03em] text-slate-900">
                {kpi.value}
              </span>
              <span className="mt-0.5 block text-[10px] font-medium leading-3 text-slate-500">
                {kpi.label}
              </span>
              <span className="mt-0.5 block truncate text-[9px] leading-3 text-slate-400">
                {kpi.description}
              </span>
            </span>
          </motion.section>
        );
      })}
    </div>
  );
}
