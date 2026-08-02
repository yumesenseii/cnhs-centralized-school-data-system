"use client";

import { motion } from "framer-motion";
import {
  Download,
  Eye,
  FilePenLine,
  Pencil,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles = {
  green: "bg-green-50 text-cnhs-green-dark ring-1 ring-green-100",
  orange: "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100",
  red: "bg-red-50 text-red-600 ring-1 ring-red-100",
};

const valueTones = {
  default: "text-slate-800",
  danger: "text-red-600",
  success: "text-cnhs-green-dark",
};

const secondaryBtn =
  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50";

export default function ReportCards({ cards, onView, onAction }) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {cards.map((card) => (
        <motion.section
          key={card.id}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
            <span
              className={cn(
                "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                statusStyles[card.statusTone] ?? statusStyles.green
              )}
            >
              {card.status}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
            {card.metrics.map((metric) => (
              <div key={metric.label}>
                <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  {metric.label}
                </dt>
                <dd
                  className={cn(
                    "mt-0.5 text-[13px] font-semibold",
                    valueTones[metric.tone] ?? valueTones.default
                  )}
                >
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-3">
            {card.actions.includes("view") ? (
              <button
                type="button"
                onClick={() => onView?.(card)}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
              >
                <Eye size={12} />
                View
              </button>
            ) : null}
            {card.actions.includes("modify") ? (
              <button
                type="button"
                onClick={() => onAction?.("modify", card)}
                className={secondaryBtn}
              >
                <Pencil size={12} />
                Modify
              </button>
            ) : null}
            {card.actions.includes("reupload") ? (
              <button
                type="button"
                onClick={() => onAction?.("reupload", card)}
                className={secondaryBtn}
              >
                <Upload size={12} />
                Re-upload
              </button>
            ) : null}
            {card.actions.includes("update") ? (
              <button
                type="button"
                onClick={() => onAction?.("update", card)}
                className={secondaryBtn}
              >
                <FilePenLine size={12} />
                Update Review
              </button>
            ) : null}
            {card.actions.includes("download") ? (
              <button
                type="button"
                onClick={() => onAction?.("download", card)}
                aria-label={`Download ${card.title}`}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Download size={13} />
              </button>
            ) : null}
          </div>
        </motion.section>
      ))}
    </div>
  );
}
