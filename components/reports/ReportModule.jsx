"use client";

import { ChevronDown } from "lucide-react";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import { cn } from "@/lib/utils";

/**
 * Reports section card. Optional collapse + Dashboard-style pill tabs.
 * `icon` / `accent` kept so callers do not break; they are not rendered.
 */
export default function ReportModule({
  title,
  subtitle,
  open = true,
  onOpenChange,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  footer,
  className,
} = {}) {
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none",
        className
      )}
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {onOpenChange ? (
            <button
              type="button"
              onClick={() => onOpenChange(!open)}
              className="flex w-full cursor-pointer items-start gap-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
                ) : null}
              </span>
              <ChevronDown
                size={16}
                className={cn(
                  "mt-0.5 shrink-0 text-slate-400 transition-transform",
                  open ? "rotate-180" : ""
                )}
              />
            </button>
          ) : (
            <>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
              ) : null}
            </>
          )}
        </div>

        {open && hasTabs ? (
          <div
            role="tablist"
            aria-label={`${title} views`}
            className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/5 dark:bg-[var(--card)]"
          >
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  id={`report-module-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`report-module-panel-${tab.id}`}
                  onClick={() => onTabChange?.(tab.id)}
                  className={cn(
                    "min-w-max cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
                    active
                      ? "bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green/20 dark:text-cnhs-green"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {open ? (
        <div
          id={
            hasTabs && activeTab
              ? `report-module-panel-${activeTab}`
              : undefined
          }
          role={hasTabs ? "tabpanel" : undefined}
          aria-labelledby={
            hasTabs && activeTab
              ? `report-module-tab-${activeTab}`
              : undefined
          }
          className="p-4 sm:p-5"
        >
          {hasTabs ? (
            <TabSwitchPanel activeKey={activeTab}>{children}</TabSwitchPanel>
          ) : (
            children
          )}
          {footer ? <div className="pt-3">{footer}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
