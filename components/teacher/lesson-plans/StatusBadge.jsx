"use client";

import { cn } from "@/lib/utils";

const statusStyles = {
  Approved: "bg-green-50 text-cnhs-green-dark",
  "Pending Review": "bg-orange-50 text-cnhs-orange",
  "Under Review": "bg-sky-50 text-sky-700",
  "Needs Revision": "bg-red-50 text-red-600",
  Draft: "bg-slate-100 text-slate-500",
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
