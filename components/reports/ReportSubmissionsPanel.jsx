"use client";

import { cn } from "@/lib/utils";

function MetricCard({ label, value, tone, emphasize = false }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        emphasize
          ? "border-orange-200 bg-orange-50/60"
          : "border-slate-100 bg-slate-50/70"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-[-0.02em]",
          emphasize ? "text-[20px]" : "text-[18px]",
          tone || "text-slate-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function LessonPlanStatusBar({ approved, pending, needsRevision, total }) {
  if (!total) return null;
  const segments = [
    { key: "approved", value: approved, className: "bg-cnhs-green-dark" },
    { key: "pending", value: pending, className: "bg-cnhs-orange" },
    { key: "revision", value: needsRevision, className: "bg-cnhs-red" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={cn("h-full", seg.className)}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cnhs-green-dark" />
          Approved {approved}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cnhs-orange" />
          Pending {pending}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cnhs-red" />
          Revision {needsRevision}
        </span>
      </div>
    </div>
  );
}

/**
 * Lesson plan + monitoring follow-up snapshot for Submissions module.
 */
export default function ReportSubmissionsPanel({
  lessonSummary = null,
  summary = null,
  onLessonPlanAction,
  actionLabel = "Open Lesson Plan Review",
}) {
  const approved = lessonSummary?.approved ?? 0;
  const pending = lessonSummary?.pending ?? 0;
  const needsRevision = lessonSummary?.needsRevision ?? 0;
  const total = lessonSummary?.total ?? approved + pending + needsRevision;
  const underMonitoring = summary?.learnersUnderMonitoring ?? 0;
  const monitoringCompleted = summary?.monitoringCompleted ?? 0;
  const hasLessonPlans = total > 0;
  const hasLatest = Boolean(lessonSummary?.latestTitle);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Lesson plans
        </p>
        {!hasLessonPlans ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
            <p className="text-[13px] font-semibold text-slate-700">
              No lesson plans for this term yet
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Submit a lesson plan to track approval and revisions here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard label="Submitted" value={total} />
              <MetricCard
                label="Approved"
                value={approved}
                tone="text-cnhs-green-dark"
              />
              <MetricCard
                label="Pending review"
                value={pending}
                tone="text-cnhs-orange"
                emphasize={pending > 0}
              />
              <MetricCard
                label="Needs revision"
                value={needsRevision}
                tone="text-cnhs-red"
                emphasize={needsRevision > 0}
              />
            </div>
            <LessonPlanStatusBar
              approved={approved}
              pending={pending}
              needsRevision={needsRevision}
              total={total}
            />
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Monitoring
        </p>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Under monitoring" value={underMonitoring} />
          <MetricCard
            label="Monitoring completed"
            value={monitoringCompleted}
            tone="text-cnhs-green-dark"
          />
        </div>
      </div>

      {hasLatest ? (
        <p className="text-[12px] text-slate-500">
          Latest:{" "}
          <span className="font-semibold text-slate-700">
            {lessonSummary.latestTitle}
          </span>
          {lessonSummary.latestStatus
            ? ` · ${lessonSummary.latestStatus}`
            : ""}
          {lessonSummary.latestDate ? ` · ${lessonSummary.latestDate}` : ""}
        </p>
      ) : null}

      {onLessonPlanAction ? (
        <button
          type="button"
          onClick={onLessonPlanAction}
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
