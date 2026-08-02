"use client";

import { cn } from "@/lib/utils";

const statusStyles = {
  red: "bg-red-50 text-red-600",
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-500",
  green: "bg-green-50 text-cnhs-green-dark",
};

export default function WeeklyMonitoring({ weeks }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Weekly Monitoring</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {weeks.map((week) => (
          <article
            key={week.id}
            className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-[12px] font-semibold text-slate-800">{week.week}</h4>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  statusStyles[week.statusTone] ?? statusStyles.slate
                )}
              >
                {week.status}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-[11px]">
              <div>
                <dt className="font-medium text-slate-400">Observation</dt>
                <dd className="mt-0.5 text-slate-700">{week.observation}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Participation</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">{week.participation}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Assessment Score</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">
                  {week.assessmentScore ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Progress</dt>
                <dd className="mt-0.5 font-semibold text-slate-700">{week.progress}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-400">Submitted</dt>
                <dd className="mt-0.5 text-slate-600">{week.submittedDate ?? "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
