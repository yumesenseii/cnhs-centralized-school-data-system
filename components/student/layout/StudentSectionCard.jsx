"use client";

import { cn } from "@/lib/utils";

export function StudentPanelCard({ title, actions, children, className }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
            {title}
          </h3>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default function StudentSectionCard({
  icon: Icon,
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="border-b border-slate-100 bg-cnhs-green-soft/30 px-4 py-3.5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {Icon ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
