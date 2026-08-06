"use client";

import { cn } from "@/lib/utils";

export default function AcademicPerformanceSummary({ academic }) {
  const tiles = [
    {
      label: "Class Average",
      value: academic.classAverage,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Passing Rate",
      value: academic.passingRate,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Highest Performing Subject",
      value: academic.highestSubject,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Lowest Performing Subject",
      value: academic.lowestSubject,
      tone: "text-red-600",
    },
    {
      label: "Learners Requiring Intervention",
      value: academic.requiringIntervention,
      tone: "text-red-600",
    },
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Academic Performance Summary{" "}
        <span className="font-normal">· read-only</span>
      </h3>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {item.label}
            </p>
            <p className={cn("mt-1 text-[12px] font-semibold", item.tone)}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
