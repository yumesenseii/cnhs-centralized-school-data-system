"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTermNumber, termLabel } from "@/lib/academic/termLabels";

export default function QuarterStatusStrip({
  classItem = {},
  termOptions = [],
  allTermGradeRows = [],
  currentQuarter = 1,
  onSelectQuarter,
}) {
  // Use dynamically available terms from termOptions or classItem
  const terms = (termOptions?.length ? termOptions : [
    { value: 1, label: "Term 1" },
    { value: 2, label: "Term 2" },
    { value: 3, label: "Term 3" },
    { value: 4, label: "Final Grade" },
  ]).map((opt) => {
    const val = Number(opt.value);
    const rows = (allTermGradeRows ?? []).filter((r) => parseTermNumber(r.quarter) === val);
    const isComplete = rows.length > 0;
    const isCurrent = val === Number(currentQuarter);
    return {
      value: val,
      label: opt.label.replace("Grade / Average", "").trim(),
      isComplete,
      isCurrent,
    };
  });

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
          Quarter Status
        </h2>

        {/* Compact Horizontal Terms Strip */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {terms.map((term) => (
            <button
              key={term.value}
              type="button"
              onClick={() => onSelectQuarter?.(term.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition cursor-pointer border",
                term.isCurrent
                  ? "border-[#246f54] bg-emerald-50 text-[#246f54] dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-[#246f54]/20"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
              )}
            >
              {term.isComplete ? (
                <CheckCircle2 size={12} className="text-[#246f54] dark:text-emerald-400 shrink-0" />
              ) : (
                <Clock size={12} className="text-slate-400 shrink-0" />
              )}
              <span>{term.label}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {term.isComplete ? "Complete" : "Pending"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
