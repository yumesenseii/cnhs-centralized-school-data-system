"use client";

import { cn } from "@/lib/utils";

export default function AcademicPerformanceSummary({ academic }) {
  const tiles = [
    {
      label: "Class Average",
      value: academic.classAverage,
      hint: "Graded learners only",
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Passing Rate",
      value: academic.passingRate,
      hint: academic.passingRateDetail,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Below 75",
      value: academic.belowPassingCount,
      hint:
        academic.gradedCount > 0
          ? `${academic.belowPassingPercent}% of graded`
          : "No graded learners",
      tone: "text-red-600",
    },
    {
      label: "Graded",
      value: academic.gradedCount,
      hint: `${academic.rosterSize} in roster`,
      tone: "text-slate-800",
    },
    {
      label: "Ungraded",
      value: academic.ungradedCount,
      hint: "Empty E-Record this term",
      tone: "text-slate-600",
    },
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Academic Performance
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
            {item.hint ? (
              <p className="mt-0.5 text-[10px] text-slate-400">{item.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
