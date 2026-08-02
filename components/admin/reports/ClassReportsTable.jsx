"use client";

import { BookOpen, Download, Eye, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const iconTones = {
  blue: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  brown: "bg-orange-50 text-orange-700",
  green: "bg-green-50 text-cnhs-green-dark",
  gold: "bg-amber-50 text-amber-600",
  pink: "bg-pink-50 text-pink-600",
};

const statusStyles = {
  Available: "bg-green-50 text-cnhs-green-dark ring-1 ring-green-100",
  "Not Generated": "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100",
  Generating: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  Approved: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
};

export default function ClassReportsTable({
  reports,
  onPreview,
  onExport,
  onExportAll,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-nowrap items-center justify-between gap-3 overflow-x-auto border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <h2 className="text-sm font-semibold whitespace-nowrap text-slate-900">
            Class Performance Reports
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {reports.length} classes
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Filter size={12} />
            Filter
          </button>
          <button
            type="button"
            onClick={onExportAll}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Download size={12} />
            Export All
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Class",
                "Subject",
                "Students",
                "Avg Grade",
                "At Intervention",
                "Latest Upload",
                "Status",
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
            {reports.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        iconTones[row.iconTone] ?? iconTones.blue
                      )}
                    >
                      <BookOpen size={13} />
                    </span>
                    <span className="text-[12px] font-semibold text-slate-800">
                      {row.className}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-600">
                  {row.subject}
                </td>
                <td className="px-3 py-2 text-[12px] font-semibold text-slate-700">
                  {row.students}
                </td>
                <td className="px-3 py-2 text-[12px] font-semibold text-cnhs-green-dark">
                  {row.averageGrade}
                </td>
                <td className="px-3 py-2 text-[12px] font-semibold text-red-600">
                  {row.requiringIntervention}
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-500">
                  {row.latestUpload}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      statusStyles[row.reportStatus] ??
                        statusStyles["Not Generated"]
                    )}
                  >
                    {row.reportStatus}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPreview(row)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Eye size={12} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => onExport(row)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Download size={12} />
                      Export PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
