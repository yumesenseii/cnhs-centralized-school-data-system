"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";

export default function ReportCards({ cards, onView }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {cards.map((card) => (
        <motion.section
          key={card.id}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
        >
          <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {card.metrics.map((metric) => (
              <div key={metric.label}>
                <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  {metric.label}
                </dt>
                <dd className="mt-1 text-[13px] font-semibold text-slate-800">{metric.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onView?.(card)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
            >
              <Eye size={12} />
              View Report
            </button>
          </div>
        </motion.section>
      ))}
    </div>
  );
}
