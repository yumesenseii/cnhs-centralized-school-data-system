"use client";

import { Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSROOM_REMEDIAL } from "@/lib/teacher/reportsConstants";

const remedialStyles = {
  [CLASSROOM_REMEDIAL.RECOMMENDED]: "bg-orange-50 text-cnhs-orange",
  [CLASSROOM_REMEDIAL.NOT_NEEDED]: "bg-green-50 text-cnhs-green-dark",
};

export default function ClassReportsTable({ reports, onPreview, onExport }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">My Class Reports</h2>
          <span className="text-[11px] font-medium text-slate-400">
            {reports.length} classes
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Section",
                "Subject",
                "Students",
                "Average Grade",
                "ARAL Learners",
                "Classroom Remedial",
                "Monitoring Status",
                "Actions",
              ].map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  No class reports match the selected filters.
                </td>
              </tr>
            ) : (
              reports.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    {row.section ?? row.gradeSection}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">
                    {row.subject}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-700">
                    {row.students}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-cnhs-green-dark">
                    {row.averageGrade}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-red-600">
                    {row.aralScreeningDisplay ??
                      (row.aralEligible === false
                        ? "—"
                        : (row.aralScreening ?? row.intervention ?? 0))}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex max-w-[220px] rounded-full px-2.5 py-1 text-[10px] font-semibold",
                        remedialStyles[row.classroomRemedial] ??
                          remedialStyles[CLASSROOM_REMEDIAL.NOT_NEEDED]
                      )}
                    >
                      {row.classroomRemedial}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">
                    {row.monitoringStatus}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPreview(row)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
                      >
                        <Eye size={11} />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => onExport(row)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <Download size={11} />
                        Export
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
