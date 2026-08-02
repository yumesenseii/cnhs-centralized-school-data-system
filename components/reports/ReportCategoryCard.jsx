"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
  FileText,
  School,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  chart: BarChart3,
  alert: AlertTriangle,
  users: UsersRound,
  file: FileText,
  school: School,
  trend: TrendingUp,
};

export default function ReportCategoryCard({ category }) {
  const Icon = icons[category.icon] ?? FileText;

  return (
    <motion.section
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex min-h-[140px] flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-sm font-semibold tracking-[-0.02em] text-slate-800">{category.title}</h3>
      <p className="mt-2 flex-1 text-[11px] leading-4 text-slate-500">{category.description}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {category.formats.map((format) => (
            <span
              key={format}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                format === "PDF" ? "bg-red-50 text-red-600" : "bg-green-50 text-cnhs-green-dark"
              )}
            >
              {format === "PDF" ? <FileText size={10} /> : <FileSpreadsheet size={10} />}
              {format}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#1f5c46]"
        >
          Generate
          <ArrowRight size={12} />
        </button>
      </div>
    </motion.section>
  );
}
