"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Collapsible report section with optional pill tabs (OneData-style / CNHS theme).
 *
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   icon?: import('react').ReactNode,
 *   open?: boolean,
 *   onOpenChange?: (next: boolean) => void,
 *   tabs?: Array<{ id: string, label: string }>,
 *   activeTab?: string,
 *   onTabChange?: (id: string) => void,
 *   children?: import('react').ReactNode,
 *   footer?: import('react').ReactNode,
 *   accent?: 'green' | 'orange' | 'sky' | 'slate',
 * }} props
 */
export default function ReportModule({
  title,
  subtitle,
  icon,
  open = true,
  onOpenChange,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  footer,
  accent = "green",
} = {}) {
  const accents = {
    green: "bg-cnhs-green-soft/50",
    orange: "bg-cnhs-orange-soft/60",
    sky: "bg-sky-50/80",
    slate: "bg-slate-50",
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => onOpenChange?.(!open)}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition-colors sm:px-5",
          accents[accent] ?? accents.green,
          open ? "border-b border-slate-100/80" : ""
        )}
      >
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "mt-1 shrink-0 text-slate-400 transition-transform",
            open ? "rotate-180" : ""
          )}
        />
      </button>

      {open ? (
        <div className="px-4 py-4 sm:px-5">
          {tabs.length > 0 ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {tabs.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-cnhs-green-soft text-cnhs-green-dark ring-1 ring-green-100"
                        : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {children}

          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
