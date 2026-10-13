"use client";

import { cn } from "@/lib/utils";

const statusStyles = {
  Active: "bg-green-50 text-cnhs-green-dark border-emerald-200/80",
  Archived: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function SectionStatusBadge({ value, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        statusStyles[value] ?? "bg-slate-100 text-slate-600 border-slate-200",
        className
      )}
    >
      {value}
    </span>
  );
}
