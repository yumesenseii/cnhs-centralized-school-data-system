"use client";

import { BookOpen, Download, Eye } from "lucide-react";
import { termLabel } from "@/lib/academic/termLabels";
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

const cell = "px-2 py-1.5 text-[12px] align-middle";
const thCell =
  "px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400";

function rowTermLabel(row) {
  const source = row?.quarter ?? row?.quarterNumber;
  if (source === null || source === undefined || source === "") return "—";
  return termLabel(source);
}

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
        <button
          type="button"
          onClick={onExportAll}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <Download size={12} />
          Export All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50/80">
              <th className={thCell}>Class</th>
              <th className={cn(thCell, "whitespace-nowrap")}>Subject</th>
              <th className={cn(thCell, "whitespace-nowrap")}>Term</th>
              <th className={thCell}>Teacher</th>
              <th className={cn(thCell, "whitespace-nowrap text-center")}>
                Students
              </th>
              <th className={cn(thCell, "whitespace-nowrap text-center")}>
                Avg Grade
              </th>
              <th className={cn(thCell, "whitespace-nowrap text-center")}>
                At Interv.
              </th>
              <th className={cn(thCell, "whitespace-nowrap")}>Upload</th>
              <th className={cn(thCell, "whitespace-nowrap")}>Status</th>
              <th className={cn(thCell, "text-right")}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
              >
                <td className={cell}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                        iconTones[row.iconTone] ?? iconTones.blue
                      )}
                    >
                      <BookOpen size={12} />
                    </span>
                    <span className="truncate text-[12px] font-semibold text-slate-800">
                      {row.className}
                    </span>
                  </div>
                </td>
                <td className={cn(cell, "whitespace-nowrap text-slate-600")}>
                  {row.subject}
                </td>
                <td className={cn(cell, "whitespace-nowrap text-slate-600")}>
                  {rowTermLabel(row)}
                </td>
                <td className={cn(cell, "text-slate-600")}>
                  <span className="line-clamp-2 break-words">
                    {row.teacherName || "—"}
                  </span>
                </td>
                <td
                  className={cn(
                    cell,
                    "whitespace-nowrap text-center font-semibold text-slate-700"
                  )}
                >
                  {row.students}
                </td>
                <td
                  className={cn(
                    cell,
                    "whitespace-nowrap text-center font-semibold text-cnhs-green-dark"
                  )}
                >
                  {row.averageGrade}
                </td>
                <td
                  className={cn(
                    cell,
                    "whitespace-nowrap text-center font-semibold text-red-600"
                  )}
                >
                  {row.requiringIntervention}
                </td>
                <td
                  className={cn(
                    cell,
                    "truncate whitespace-nowrap text-slate-500"
                  )}
                  title={row.latestUpload || undefined}
                >
                  {row.latestUpload || "—"}
                </td>
                <td className={cell}>
                  <span
                    className={cn(
                      "inline-flex whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      statusStyles[row.reportStatus] ??
                        statusStyles["Not Generated"]
                    )}
                  >
                    {row.reportStatus}
                  </span>
                </td>
                <td className={cn(cell, "text-right")}>
                  <div className="inline-flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onPreview(row)}
                      title="Preview"
                      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Eye size={11} />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onExport(row)}
                      title="Export PDF"
                      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Download size={11} />
                      PDF
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
