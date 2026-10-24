"use client";

import { cn } from "@/lib/utils";

function CompactStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-slate-900",
          tone
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
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
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
 * Lesson plan + monitoring follow-up overview for Submissions module.
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
          <div className="border-y border-slate-200 py-3 dark:border-white/10">
            <p className="text-[13px] font-semibold text-slate-700">
              No lesson plans for this term yet
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Submit a lesson plan to track approval and revisions here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-slate-200 py-2 dark:border-white/10 sm:grid-cols-4">
              <CompactStat label="Submitted" value={total} />
              <CompactStat
                label="Approved"
                value={approved}
                tone="text-cnhs-green-dark"
              />
              <CompactStat
                label="Pending review"
                value={pending}
                tone={pending > 0 ? "text-cnhs-orange" : undefined}
              />
              <CompactStat
                label="Needs revision"
                value={needsRevision}
                tone={needsRevision > 0 ? "text-cnhs-red" : undefined}
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
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Academic & Reading Intervention Monitoring
          </p>
          {summary?.interventionProgress?.improvementRate > 0 ? (
            <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {summary.interventionProgress.improvementRate}% Improved
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 border-y border-slate-200 py-2 dark:border-white/10">
          <CompactStat label="Under monitoring" value={underMonitoring} />
          <CompactStat
            label="Monitoring completed"
            value={monitoringCompleted}
            tone="text-cnhs-green-dark"
          />
          <CompactStat
            label="Learners Improved"
            value={summary?.interventionProgress?.improvedCount ?? 0}
            tone="text-emerald-700"
          />
          <CompactStat
            label="Average Point Gain"
            value={
              summary?.interventionProgress?.averagePointChange != null
                ? `${summary.interventionProgress.averagePointChange > 0 ? "+" : ""}${summary.interventionProgress.averagePointChange} pts`
                : "—"
            }
            tone={
              (summary?.interventionProgress?.averagePointChange ?? 0) >= 0
                ? "text-cnhs-green-dark"
                : "text-rose-600"
            }
          />
        </div>

        {summary?.interventionProgress?.learnerProgress?.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 dark:border-white/5">
            <div className="bg-slate-50/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/[0.02]">
              Observed Performance (Baseline vs Current Grade)
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs dark:divide-white/5">
              {summary.interventionProgress.learnerProgress.slice(0, 8).map((lp) => (
                <div key={lp.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50/50">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate dark:text-slate-200">
                      {lp.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {lp.section} · {lp.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-right shrink-0">
                    <div>
                      <span className="text-[10px] text-slate-400">Baseline </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {lp.baselineGrade ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Current </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {lp.currentGrade ?? "—"}
                      </span>
                    </div>
                    {lp.difference != null ? (
                      <span
                        className={`text-[11px] font-bold ${
                          lp.difference > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : lp.difference < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-slate-500"
                        }`}
                      >
                        {lp.difference > 0 ? `+${lp.difference}` : lp.difference}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {hasLatest ? (
        <p className="text-[12px] text-slate-500">
          Latest lesson plan:{" "}
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
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-transparent px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/6"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
