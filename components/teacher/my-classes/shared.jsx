"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const toneStyles = {
  green: "text-emerald-700",
  blue: "text-blue-700",
  orange: "text-amber-800",
  red: "text-red-700",
  teal: "text-teal-700",
};

export function SummaryKpiCards({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        return (
          <section
            key={kpi.id}
            className="relative min-h-[72px] rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            {kpi.alert ? (
              <span
                className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500"
                aria-hidden="true"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
              <p className={cn("mt-1 text-2xl font-bold leading-none tracking-tight", toneStyles[kpi.tone] ?? toneStyles.green)}>
                {kpi.value}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export const academicStatusStyles = {
  "Pending Upload": "bg-orange-50 text-cnhs-orange",
  Pending: "bg-orange-50 text-cnhs-orange",
  Submitted: "bg-green-50 text-cnhs-green-dark",
  Approved: "bg-green-50 text-cnhs-green-dark",
  "Needs Revision": "bg-red-50 text-red-600",
  Active: "bg-green-50 text-cnhs-green-dark",
  Flagged: "bg-red-50 text-red-600",
};

export const riskStyles = {
  Priority: "bg-red-50 text-red-600",
  "High Risk": "bg-red-50 text-red-600",
  Moderate: "bg-amber-50 text-amber-700",
  "Moderate Risk": "bg-amber-50 text-amber-700",
  Low: "bg-green-50 text-cnhs-green-dark",
  "Low Risk": "bg-green-50 text-cnhs-green-dark",
};

export const interventionStyles = {
  "ARAL Learners": "bg-sky-50 text-sky-700",
  "Recommended for ARAL Learners": "bg-sky-50 text-sky-700",
  "Recommended for ARAL Screening": "bg-sky-50 text-sky-700",
  "Classroom Remediation": "bg-violet-50 text-violet-700",
  "Potential ARAL Learners": "bg-sky-50 text-sky-700",
  "Potential ARAL Screening": "bg-sky-50 text-sky-700",
  "Teacher-Based Intervention": "bg-violet-50 text-violet-700",
  None: "bg-slate-100 text-slate-500",
};

export function StatusPill({ value, styles = academicStatusStyles }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
        styles[value] ?? "bg-slate-100 text-slate-500"
      )}
    >
      {value}
    </span>
  );
}

export function PageBreadcrumb({ items }) {
  return (
    <p className="text-[10px] font-medium text-slate-400">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="text-slate-300"> &gt; </span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-slate-600">
              {item.label}
            </Link>
          ) : (
            <span className={index === items.length - 1 ? "font-semibold text-slate-600" : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
