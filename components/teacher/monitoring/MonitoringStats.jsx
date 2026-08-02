"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Clock3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  users: Users,
  clock: Clock3,
  book: BookOpen,
  alert: AlertTriangle,
};

const tones = {
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-cnhs-orange",
  green: "bg-green-50 text-cnhs-green-dark",
  red: "bg-red-50 text-red-500",
};

export default function MonitoringStats({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = icons[kpi.icon] ?? Users;
        return (
          <motion.section
            key={kpi.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative min-h-[88px] rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            {kpi.alert ? (
              <span
                className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-red-500"
                aria-hidden="true"
              />
            ) : null}
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  tones[kpi.tone] ?? tones.blue
                )}
              >
                <Icon size={15} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-semibold tracking-[-0.03em] text-slate-900">
                  {kpi.value}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-700">{kpi.label}</p>
                <p className="mt-0.5 text-[10px] leading-3.5 text-slate-400">{kpi.description}</p>
              </div>
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
