"use client";

import { useMemo, useState } from "react";
import { ChevronDown, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ActionRequiredCard from "@/components/lesson-plan/ActionRequiredCard";
import QuarterSummary from "@/components/lesson-plan/QuarterSummary";
import RecentActivity from "@/components/lesson-plan/RecentActivity";

/**
 * Closed-by-default shell for Recent Activity / Quarter / Action Required.
 * Keeps the lesson table as the primary viewport.
 */
export default function ReviewContextAccordion({
  recentActivity = [],
  quarterSummary = [],
  actionRequired,
}) {
  const [open, setOpen] = useState(false);

  const pending = Number(actionRequired?.pending ?? 0);
  const needsRevision = Number(actionRequired?.needsRevision ?? 0);
  const activityCount = recentActivity.length;

  const subtitle = useMemo(() => {
    const parts = [];
    if (activityCount) {
      parts.push(
        `${activityCount} recent update${activityCount === 1 ? "" : "s"}`
      );
    } else {
      parts.push("No recent activity");
    }
    if (pending > 0) parts.push(`${pending} pending`);
    if (needsRevision > 0) parts.push(`${needsRevision} needs revision`);
    return parts.join(" · ");
  }, [activityCount, pending, needsRevision]);

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 sm:px-4",
          open ? "border-b border-slate-100 bg-cnhs-green-soft/30" : "bg-slate-50/50"
        )}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
          <PanelRight size={15} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-slate-900">
            Review context
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {open
              ? "Recent activity, quarter progress, and action required"
              : subtitle}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={cn(
            "mt-1 shrink-0 text-slate-400 transition-transform",
            open ? "rotate-180" : ""
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="grid grid-cols-1 gap-2.5 p-2.5 sm:p-3 lg:grid-cols-3">
          <RecentActivity items={recentActivity} />
          <QuarterSummary summary={quarterSummary} />
          <ActionRequiredCard action={actionRequired} />
        </div>
      ) : null}
    </section>
  );
}
