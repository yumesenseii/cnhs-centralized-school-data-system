"use client";

import {
  formatSessionRate,
  sessionRatePercent,
} from "@/lib/attendance/dailyAnalytics";
import { monthLabel } from "@/lib/attendance/constants";
import MultiYearCaseloadTrendCard from "@/components/admin/reports/MultiYearCaseloadTrendCard";
import { cn } from "@/lib/utils";

function hasDailyRecords(row = {}) {
  const present = Number(row.present || 0);
  const absent = Number(row.absent || 0);
  const marked = Number(row.learnersMarked || 0);
  return present > 0 || absent > 0 || marked > 0;
}

function SectionHeader({ title, actionLabel, onAction }) {
  return (
    <div className="flex min-h-[1.25rem] flex-wrap items-center justify-between gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {title}
      </h3>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="cursor-pointer text-[11px] font-semibold text-cnhs-green-dark underline-offset-2 hover:underline"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

/**
 * HT Reports Overview: action strip, learner monitoring, sections/classes
 * needing attention, attendance, lesson plans — formal school wording.
 */
export default function AdminReportsOverviewExtras({
  schoolYear = "",
  quarterLabel = "All Terms",
  actionCounts = {},
  monitoringHealth = {},
  hotspots = {},
  lessonSummary = null,
  daily = null,
  onGoMonitoring,
  onGoAttendance,
  onGoLessonPlans,
  onOpenClassesTab,
  onPreviewClass,
}) {
  const pendingFiles = Number(actionCounts.pendingFiles) || 0;
  const pendingApprovals = Number(actionCounts.pendingAralApprovals) || 0;
  const unassigned = Number(actionCounts.unassignedFacilitators) || 0;
  const hasActions =
    pendingFiles > 0 || pendingApprovals > 0 || unassigned > 0;

  const dailyRows = daily?.rows ?? [];
  const sectionsWithMarks = dailyRows.filter((row) => hasDailyRecords(row))
    .length;
  const sectionsTotal = dailyRows.length;
  const sectionsWaiting = Math.max(0, sectionsTotal - sectionsWithMarks);
  const present = dailyRows.reduce((sum, row) => sum + (row.present || 0), 0);
  const absent = dailyRows.reduce((sum, row) => sum + (row.absent || 0), 0);
  const dailyRate =
    daily?.sessionRate ?? sessionRatePercent({ present, absent });
  const monthName =
    daily?.monthName ||
    (daily?.month ? monthLabel(Number(daily.month)) : "This month");

  const sections = hotspots.sections ?? [];
  const weakClasses = hotspots.weakClasses ?? [];

  return (
    <div className="space-y-4">
      {/* Year-over-Year Intervention Progress & Caseload Comparison */}
      <MultiYearCaseloadTrendCard />

      {/* Intervention Progress Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-[var(--card)]">
        <SectionHeader
          title="Current Academic Year Intervention Status"
          actionLabel="View in Academic Monitoring →"
          onAction={() => onGoMonitoring?.("students")}
        />
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: "Active Intervention",
              value: monitoringHealth.underMonitoring ?? 0,
            },
            {
              label: "Completed / Exited",
              value: monitoringHealth.completed ?? 0,
            },
            {
              label: "Needs Follow-up",
              value: monitoringHealth.ongoing ?? 0,
            },
            {
              label: "Program Exit Rate",
              value: `${monitoringHealth.completionRate ?? 0}%`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-white/5 dark:bg-white/[0.03]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {(sections.length > 0 || weakClasses.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
          {sections.length > 0 ? (
            <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-white/5 dark:bg-[var(--card)]">
              <SectionHeader
                title="Sections needing attention"
                actionLabel="Open Academic Monitoring"
                onAction={() => onGoMonitoring?.("students")}
              />
              <ul className="mt-2.5 flex-1 divide-y divide-slate-100 dark:divide-white/5">
                {sections.map((row) => {
                  const parts = [];
                  if (row.aral > 0) {
                    parts.push(
                      `${row.aral} ARAL learner${row.aral === 1 ? "" : "s"}`
                    );
                  }
                  if (row.atRisk > 0) {
                    parts.push(
                      `${row.atRisk} learner${row.atRisk === 1 ? "" : "s"} needing support`
                    );
                  }
                  return (
                    <li
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 py-2 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => onGoMonitoring?.("students")}
                        className="min-w-0 cursor-pointer truncate text-left font-semibold text-slate-800 hover:text-cnhs-green-dark dark:text-slate-100"
                      >
                        {row.label}
                      </button>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                        {parts.join(" · ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {weakClasses.length > 0 ? (
            <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-white/5 dark:bg-[var(--card)]">
              <SectionHeader
                title="Classes needing attention"
                actionLabel="View by class"
                onAction={() => onOpenClassesTab?.()}
              />
              <ul className="mt-2.5 flex-1 divide-y divide-slate-100 dark:divide-white/5">
                {weakClasses.map((row) => {
                  const parts = [];
                  if (row.passRate != null) {
                    parts.push(`${row.passRate}% passing`);
                  }
                  if (row.needingSupport > 0) {
                    parts.push(
                      `${row.needingSupport} needing support`
                    );
                  }
                  return (
                    <li
                      key={row.id}
                      className="flex items-baseline justify-between gap-3 py-2 text-[12px]"
                    >
                      <button
                        type="button"
                        onClick={() => onPreviewClass?.(row.id)}
                        className="min-w-0 cursor-pointer truncate text-left font-semibold text-slate-800 hover:text-cnhs-green-dark dark:text-slate-100"
                      >
                        {row.label}
                      </button>
                      <span className="shrink-0 text-right text-[11px] tabular-nums text-slate-500">
                        {parts.join(" · ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-white/5 dark:bg-[var(--card)]">
        <SectionHeader
          title={`Attendance — ${monthName}`}
          actionLabel="Open Attendance Monitoring"
          onAction={() => onGoAttendance?.()}
        />
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-stretch">
          <div className="flex min-h-[4.25rem] flex-col justify-center rounded-lg bg-cnhs-green-soft/60 px-2.5 py-2.5 dark:bg-cnhs-green-soft">
            <p className="text-[10px] font-medium text-slate-500">
              School attendance rate
            </p>
            <p className="mt-1 text-[15px] font-semibold text-cnhs-green-dark">
              {sectionsTotal ? formatSessionRate(dailyRate) : "—"}
            </p>
          </div>
          <div className="flex min-h-[4.25rem] flex-col justify-center rounded-lg bg-slate-50/80 px-2.5 py-2.5 dark:bg-white/[0.03]">
            <p className="text-[10px] font-medium text-slate-500">
              Sections with attendance
            </p>
            <p className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {sectionsTotal ? `${sectionsWithMarks} / ${sectionsTotal}` : "—"}
            </p>
          </div>
          <div
            className={cn(
              "flex min-h-[4.25rem] flex-col justify-center rounded-lg px-2.5 py-2.5",
              sectionsWaiting > 0
                ? "bg-cnhs-orange-soft"
                : "bg-slate-50/80 dark:bg-white/[0.03]"
            )}
          >
            <p className="text-[10px] font-medium text-slate-500">
              Sections without attendance
            </p>
            <p
              className={cn(
                "mt-1 text-[15px] font-semibold tabular-nums",
                sectionsWaiting > 0
                  ? "text-cnhs-orange"
                  : "text-slate-900 dark:text-slate-100"
              )}
            >
              {sectionsTotal ? sectionsWaiting : "—"}
            </p>
          </div>
        </div>
        <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
          Based on Morning and Afternoon attendance recorded by advisers.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-white/5 dark:bg-[var(--card)]">
        <SectionHeader
          title="Lesson plans"
          actionLabel="Open Lesson Plan Review"
          onAction={() => onGoLessonPlans?.()}
        />
        <p className="mt-2.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {lessonSummary?.total ?? 0}
          </span>{" "}
          submitted
          <span className="text-slate-300 dark:text-slate-600"> · </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {lessonSummary?.approved ?? 0}
          </span>{" "}
          approved
          <span className="text-slate-300 dark:text-slate-600"> · </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {lessonSummary?.needsRevision ?? 0}
          </span>{" "}
          for revision
          <span className="text-slate-300 dark:text-slate-600"> · </span>
          <button
            type="button"
            onClick={() => onGoLessonPlans?.()}
            className="cursor-pointer font-semibold text-cnhs-green-dark underline-offset-2 hover:underline"
          >
            {lessonSummary?.pending ?? 0} pending review
          </button>
        </p>
      </section>
    </div>
  );
}
