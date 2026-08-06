"use client";

import { useMemo } from "react";
import { Eye } from "lucide-react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import RecommendationBadge from "@/components/academic-records/RecommendationBadge";
import RiskBadge from "@/components/academic-records/RiskBadge";
import StatusBadge from "@/components/academic-records/StatusBadge";
import StudentTableRow from "@/components/academic-records/StudentTableRow";

const columnHelper = createColumnHelper();

function StudentNameCell({ row }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cnhs-green text-[8px] font-semibold text-white">
        {row.original.initials}
      </span>
      <span className="whitespace-nowrap text-[12px] font-semibold text-slate-800">
        {row.original.studentName}
      </span>
    </div>
  );
}

export default function AcademicRecordsTable({
  students = [],
  title = "Academic Records",
  recordCount,
}) {
  const displayCount =
    typeof recordCount === "number" ? recordCount : students.length;
  const columns = useMemo(
    () => [
      columnHelper.accessor("studentNumber", {
        header: "Student No.",
        cell: (info) => (
          <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-400">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: "studentName",
        header: "Learner",
        cell: StudentNameCell,
      }),
      columnHelper.accessor("gradeSection", {
        header: "Grade / Section",
        cell: (info) => (
          <span className="whitespace-nowrap text-[11px] text-slate-600">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("generalAverage", {
        header: "GA",
        cell: (info) => {
          const value = Number(info.getValue());
          if (!Number.isFinite(value)) {
            return (
              <span className="text-[11px] font-medium text-slate-400">—</span>
            );
          }
          return (
            <span
              className={
                value < 75
                  ? "text-[12px] font-semibold tabular-nums text-red-600"
                  : "text-[12px] font-semibold tabular-nums text-cnhs-green-dark"
              }
            >
              {value.toFixed(2)}
            </span>
          );
        },
      }),
      columnHelper.accessor("weakSubject", {
        header: "Weak Subj.",
        cell: (info) => (
          <span className="whitespace-nowrap text-[11px]">
            {info.getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("riskLevel", {
        header: "Risk",
        cell: (info) => <RiskBadge value={info.getValue()} dense />,
      }),
      columnHelper.accessor("systemRecommendation", {
        header: "Rec.",
        cell: (info) => <RecommendationBadge value={info.getValue()} dense />,
      }),
      columnHelper.accessor("reviewStatus", {
        header: "Status",
        cell: (info) => <StatusBadge value={info.getValue()} dense />,
      }),
      columnHelper.display({
        id: "action",
        header: "",
        cell: () => (
          <button
            type="button"
            title="View profile"
            aria-label="View profile"
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-2 text-[10px] font-semibold text-white transition-colors duration-200 hover:bg-[#246f54]"
          >
            <Eye size={12} aria-hidden="true" />
            View
          </button>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-50 px-3 py-2">
        <h2 className="text-[13px] font-semibold text-slate-800">{title}</h2>
        <p className="text-[10px] tabular-nums text-slate-400">
          {typeof recordCount === "number"
            ? `${students.length} on page · ${displayCount} filtered`
            : `${students.length} records`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-slate-50/90">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <StudentTableRow key={row.id} row={row} dense />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  No learners for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
