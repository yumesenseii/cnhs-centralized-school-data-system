"use client";

import { cn } from "@/lib/utils";

export function StudentPanelCard({ title, actions, children, className }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-3.5">
          <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-card-foreground">
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
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="border-b border-border bg-cnhs-green-soft/25 px-3 py-2.5 dark:bg-cnhs-green/10 sm:px-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-cnhs-green-dark shadow-sm ring-1 ring-border">
                <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold text-card-foreground">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
      <div className={cn("p-3 sm:p-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}
