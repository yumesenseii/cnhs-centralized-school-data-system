"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  book: BookOpen,
  users: Users,
  file: FileText,
  clipboard: ClipboardList,
  alert: AlertTriangle,
  trend: TrendingUp,
  check: CheckCircle2,
};

const toneStyles = {
  green: "bg-green-50 text-cnhs-green-dark",
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-cnhs-orange",
  red: "bg-red-50 text-red-500",
  teal: "bg-teal-50 text-teal-600",
};

export function SummaryKpiCards({ kpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.icon] ?? BookOpen;
        return (
          <section
            key={kpi.id}
            className="relative min-h-[72px] rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            {kpi.alert ? (
              <span
                className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500"
                aria-hidden="true"
              />
            ) : null}
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  toneStyles[kpi.tone] ?? toneStyles.green
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                  {kpi.value}
                </p>
                <p className="mt-1 text-[12px] font-semibold text-slate-600">{kpi.label}</p>
              </div>
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
