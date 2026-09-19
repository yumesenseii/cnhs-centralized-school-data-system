"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  clipboard: ClipboardList,
  clock: Clock3,
  check: CheckCircle2,
  alert: AlertTriangle,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark dark:bg-cnhs-green/15 dark:text-cnhs-green",
  blue: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  orange: "bg-orange-50 text-cnhs-orange dark:bg-cnhs-orange/15 dark:text-cnhs-orange",
  red: "bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300",
};

export default function LessonPlanStats({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = icons[kpi.icon] ?? ClipboardList;
        return (
          <motion.section
            key={kpi.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative min-h-[72px] rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none"
          >
            {kpi.alert ? (
              <span
                className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500"
                aria-hidden="true"
              />
            ) : null}
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  tones[kpi.tone] ?? tones.green
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                  {kpi.value}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                  {kpi.label}
                </p>
              </div>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
