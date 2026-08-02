"use client";

import { cn } from "@/lib/utils";

export default function AcademicPerformanceSummary({ academic }) {
  const rows = [
    ["Class Average", academic.classAverage, "text-cnhs-green-dark"],
    ["Passing Rate", academic.passingRate, "text-cnhs-green-dark"],
    ["Highest Performing Subject", academic.highestSubject, "text-cnhs-green-dark"],
    ["Lowest Performing Subject", academic.lowestSubject, "text-red-600"],
    ["Learners Requiring Intervention", academic.requiringIntervention, "text-red-600"],
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Academic Performance Summary <span className="font-normal">· read-only</span>
      </h3>
      <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
        {rows.map(([label, value, tone]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 bg-white px-3 py-2.5"
          >
            <dt className="text-[12px] text-slate-600">{label}</dt>
            <dd className={cn("text-[12px] font-semibold", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
