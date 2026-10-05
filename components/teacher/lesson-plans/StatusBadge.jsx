"use client";

import { cn } from "@/lib/utils";

const statusStyles = {
  Approved:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Pending Review":
    "border border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  "Under Review":
    "border border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  "Needs Revision":
    "border border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-300",
  Draft:
    "border border-slate-200/80 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-400",
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
        statusStyles[status] ?? "bg-slate-100 text-slate-500",
        className
      )}
    >
      {status}
    </span>
  );
}
