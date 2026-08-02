"use client";

import { cn } from "@/lib/utils";

export default function AcademicSummary({ summary }) {
  const columnLabel = summary.columnLabel || "Term";

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">
        {summary.quarterLabel || "Grades per Term"}
      </h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {columnLabel}
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.subjects?.length ? (
              summary.subjects.map((row) => (
                <tr
                  key={`${row.quarter ?? row.subject}-${row.id ?? row.subject}`}
                  className="border-t border-slate-100"
                >
                  <td className="px-3 py-2.5 text-[12px] font-medium text-slate-700">
                    <span className="inline-flex items-center gap-2">
                      {row.subject}
                      {row.weak ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Weak
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right text-[12px] font-semibold",
                      row.grade < 75 ? "text-red-600" : "text-slate-700"
                    )}
                  >
                    {row.grade}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t border-slate-100">
                <td colSpan={2} className="px-3 py-2 text-[12px] text-slate-400">
                  No quarterly grades imported yet.
                </td>
              </tr>
            )}
            <tr className="border-t border-slate-200 bg-slate-50/60">
              <td className="px-3 py-2.5 text-[12px] font-semibold text-slate-800">
                General Average
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right text-[12px] font-semibold",
                  summary.generalAverage !== null &&
                    summary.generalAverage !== undefined &&
                    summary.generalAverage < 75
                    ? "text-red-600"
                    : "text-slate-800"
                )}
              >
                {summary.generalAverage ?? "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
