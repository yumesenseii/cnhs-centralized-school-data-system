"use client";

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

  const metrics = [
    { label: "Submitted", value: total },
    { label: "Approved", value: approved, tone: "text-cnhs-green-dark" },
    { label: "Pending review", value: pending, tone: "text-cnhs-orange" },
    { label: "Needs revision", value: needsRevision, tone: "text-cnhs-red" },
    {
      label: "Under monitoring",
      value: summary?.learnersUnderMonitoring ?? 0,
    },
    {
      label: "Monitoring completed",
      value: summary?.monitoringCompleted ?? 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {item.label}
            </p>
            <p
              className={`mt-1 text-[18px] font-semibold tracking-[-0.02em] ${item.tone || "text-slate-800"}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {lessonSummary?.latestTitle ? (
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
