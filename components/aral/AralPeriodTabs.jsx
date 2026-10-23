"use client";

import { ARAL_PERIOD_ORDER, aralPeriodLabel } from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

export default function AralPeriodTabs({ period, onChange }) {
  return (
    <div role="tablist" aria-label="Reading assessment period" className="flex gap-1 border-b border-slate-200 dark:border-white/10">
      {ARAL_PERIOD_ORDER.map((value) => (
        <button key={value} id={`aral-tab-${value}`} type="button" role="tab" aria-selected={period === value}
          aria-controls="aral-period-panel" title={aralPeriodLabel(value)} onClick={() => onChange(value)}
          className={cn("cursor-pointer border-b-2 px-5 py-3 text-sm font-semibold transition-colors",
            period === value ? "border-[#246f54] text-[#246f54] dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
          {value}
        </button>
      ))}
    </div>
  );
}
