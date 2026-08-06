"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const toneStyles = {
  green: {
    value: "text-cnhs-green-dark",
    badge: "bg-cnhs-green-soft text-cnhs-green-dark",
  },
  orange: {
    value: "text-cnhs-orange",
    badge: "bg-cnhs-orange-soft text-cnhs-orange",
  },
  red: {
    value: "text-cnhs-red",
    badge: "bg-cnhs-red-soft text-cnhs-red",
  },
  blue: {
    value: "text-sky-700",
    badge: "bg-sky-50 text-sky-700",
  },
  slate: {
    value: "text-slate-900",
    badge: "bg-slate-100 text-slate-600",
  },
};

/**
 * @param {{ items: Array<{ id: string, label: string, value: string|number, hint?: string, badge?: string, tone?: string }> }} props
 */
export default function ReportKpiStrip({ items = [] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const tone = toneStyles[item.tone] ?? toneStyles.slate;
        return (
          <motion.section
            key={item.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                {item.label}
              </p>
              {item.badge ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    tone.badge
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 text-[28px] font-semibold leading-none tracking-[-0.03em]",
                tone.value
              )}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-2 text-[11px] text-slate-400">{item.hint}</p>
            ) : null}
          </motion.section>
        );
      })}
    </div>
  );
}
