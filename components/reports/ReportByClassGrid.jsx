"use client";

import { motion } from "framer-motion";

/**
 * @param {{
 *   reports: Array<Record<string, unknown>>,
 *   onDetails: (row: Record<string, unknown>) => void,
 *   mapRow?: (row: Record<string, unknown>) => {
 *     id: string,
 *     title: string,
 *     subtitle?: string,
 *     metric: string|number,
 *     metricLabel?: string,
 *     needsLabel?: string,
 *   },
 * }} props
 */
export default function ReportByClassGrid({
  reports = [],
  onDetails,
  mapRow,
}) {
  if (!reports.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-xs text-slate-500">
        No classes match the selected filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          <motion.article
            key={row.id}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cnhs-green-dark">
              {row.title}
            </p>
            {row.subtitle ? (
              <p className="mt-0.5 text-[11px] text-slate-500">{row.subtitle}</p>
            ) : null}
            <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.03em] text-cnhs-green-dark">
              {row.metric}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {row.metricLabel || "Average grade"}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-500">{row.needsLabel}</span>
              <button
                type="button"
                onClick={() => onDetails?.(raw)}
                className="cursor-pointer text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
              >
                Details →
              </button>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
