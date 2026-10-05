"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  learners: Users,
  "lesson-plans": FileText,
  attendance: AlertCircle,
  grades: FileSpreadsheet,
};

const TONES = {
  danger: {
    bg: "bg-red-50/70 border-red-200/80 text-red-900",
    iconWrap: "bg-red-100/90 text-red-700",
    badge: "bg-red-100 text-red-700",
    button: "border-red-300 bg-white text-red-700 hover:bg-red-50",
  },
  warning: {
    bg: "bg-amber-50/70 border-amber-200/80 text-amber-900",
    iconWrap: "bg-amber-100/90 text-amber-700",
    badge: "bg-amber-100 text-amber-800",
    button: "border-amber-300 bg-white text-amber-800 hover:bg-amber-50",
  },
  orange: {
    bg: "bg-orange-50/70 border-orange-200/80 text-orange-900",
    iconWrap: "bg-orange-100/90 text-cnhs-orange",
    badge: "bg-orange-100 text-orange-800",
    button: "border-orange-300 bg-white text-cnhs-orange hover:bg-orange-50",
  },
  default: {
    bg: "bg-slate-50 border-slate-200 text-slate-800",
    iconWrap: "bg-slate-200 text-slate-700",
    badge: "bg-slate-100 text-slate-700",
    button: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  },
};

export default function WhatNeedsAttention({ items = [], earlyWarningCount = 0 }) {
  const hasItems = items.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
            {hasItems || earlyWarningCount > 0 ? (
              <AlertTriangle size={15} className="text-amber-600" />
            ) : (
              <CheckCircle2 size={15} className="text-cnhs-green-dark" />
            )}
          </span>
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
            Action Center
          </h2>
          {earlyWarningCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {earlyWarningCount} early warning{earlyWarningCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {hasItems ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
            {items.length} {items.length === 1 ? "Action Needed" : "Actions Needed"}
          </span>
        ) : null}
      </div>

      <div className="p-3 sm:p-4">
        {hasItems ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
            {items.map((item) => {
              const tone = TONES[item.tone] ?? TONES.default;
              const Icon = ICONS[item.type] ?? AlertTriangle;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex min-w-[280px] sm:min-w-[320px] lg:min-w-0 flex-1 shrink-0 snap-start items-center justify-between gap-3 rounded-xl border p-2.5 sm:px-3 transition-all duration-150 hover:shadow-sm",
                    tone.bg
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        tone.iconWrap
                      )}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <h3 className="truncate text-xs font-semibold leading-tight text-slate-900">
                        {item.title}
                      </h3>
                      <p className="truncate text-[11px] text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {item.href ? (
                    <Link
                      href={item.href}
                      title={item.actionLabel || "View"}
                      className={cn(
                        "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition-colors",
                        tone.button
                      )}
                    >
                      <span>{item.actionLabel || "View"}</span>
                      <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cnhs-green-soft text-cnhs-green-dark">
              <CheckCircle2 size={24} strokeWidth={2.2} />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              You&apos;re all caught up.
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              No immediate action is needed. All grades, lesson plans, and learner monitoring are up to date.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
