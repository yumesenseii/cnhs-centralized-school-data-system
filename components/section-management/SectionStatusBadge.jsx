"use client";

import { cn } from "@/lib/utils";

const statusStyles = {
  Active: "bg-green-50 text-cnhs-green-dark",
  Archived: "bg-slate-100 text-slate-500",
};

export default function SectionStatusBadge({ value, className }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
        statusStyles[value] ?? "bg-slate-100 text-slate-500",
        className
      )}
    >
      {value}
    </span>
  );
}
