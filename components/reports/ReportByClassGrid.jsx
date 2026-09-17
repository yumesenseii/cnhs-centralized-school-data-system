"use client";

import { FileText } from "lucide-react";

/**
 * @param {{
 *   reports: Array<Record<string, unknown>>,
 *   onDetails: (row: Record<string, unknown>) => void,
 *   onGenerateSystemReport?: (row: Record<string, unknown>) => void,
 *   mapRow?: (row: Record<string, unknown>) => {
 *     id: string,
 *     title: string,
 *     subtitle?: string,
 *     metric: string|number,
 *     metricLabel?: string,
 *     needsLabel?: string,
 *     passingRate?: string,
 *   },
 * }} props
 */
export default function ReportByClassGrid({
  reports = [],
  onDetails,
  onGenerateSystemReport,
  mapRow,
}) {
  if (!reports.length) {
    return (
      <p className="py-8 text-center text-xs text-slate-500">
        No classes match the selected filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-y border-slate-200 py-3 dark:border-white/10 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((raw) => {
        const row = mapRow
          ? mapRow(raw)
          : {
              id: raw.id,
              title: raw.className || raw.gradeSection || raw.section || "Class",
              subtitle: raw.subject,
              metric: raw.averageGrade ?? "—",
              metricLabel: "Average grade",
              needsLabel:
                raw.highRisk != null
                  ? `${raw.highRisk} high risk`
                  : `${raw.aralScreening ?? raw.requiringIntervention ?? 0} need follow-up`,
            };

        return (
          <article key={row.id} className="min-w-0">
            <p className="text-[11px] font-semibold text-cnhs-green-dark">
              {row.title}
            </p>
            {row.subtitle ? (
              <p className="mt-0.5 text-[11px] text-slate-500">{row.subtitle}</p>
            ) : null}
            <p className="mt-2 text-[22px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-slate-900">
              {row.metric}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {row.metricLabel || "Average grade"}
              {row.passingRate ? ` · Passing ${row.passingRate}` : ""}
            </p>
            <p className="mt-2 text-[11px] text-slate-500">{row.needsLabel}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onDetails?.(raw)}
                className="cursor-pointer text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
              >
                Preview →
              </button>
              {onGenerateSystemReport ? (
                <button
                  type="button"
                  onClick={() => onGenerateSystemReport(raw)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  <FileText size={11} />
                  Generate report
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
