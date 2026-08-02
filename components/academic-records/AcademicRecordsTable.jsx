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
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-400 text-[10px] font-semibold text-white">
        {row.original.initials}
      </span>
      <span className="whitespace-nowrap font-semibold text-slate-800">{row.original.studentName}</span>
    </div>
  );
}

export default function AcademicRecordsTable({ students = [] }) {
  const columns = useMemo(
    () => [
      columnHelper.accessor("studentNumber", {
        header: "Student Number",
        cell: (info) => <span className="whitespace-nowrap text-[11px] text-slate-400">{info.getValue()}</span>,
      }),
      columnHelper.display({
        id: "studentName",
        header: "Student Name",
        cell: StudentNameCell,
      }),
      columnHelper.accessor("gradeSection", {
        header: "Grade & Section",
        cell: (info) => <span className="whitespace-nowrap">{info.getValue()}</span>,
      }),
      columnHelper.accessor("generalAverage", {
        header: "General Average",
        cell: (info) => {
          const value = Number(info.getValue());
          if (!Number.isFinite(value)) {
            return <span className="font-semibold text-slate-400">—</span>;
          }
          return (
            <span className={value < 75 ? "font-semibold text-red-600" : "font-semibold text-cnhs-green-dark"}>
              {value.toFixed(2)}
            </span>
          );
        },
      }),
      columnHelper.accessor("weakSubject", {
        header: "Weak Subject",
        cell: (info) => <span className="whitespace-nowrap">{info.getValue() ?? "—"}</span>,
      }),
      columnHelper.accessor("riskLevel", {
        header: "Risk Level",
        cell: (info) => <RiskBadge value={info.getValue()} />,
      }),
      columnHelper.accessor("systemRecommendation", {
        header: "System Recommendation",
        cell: (info) => <RecommendationBadge value={info.getValue()} />,
      }),
      columnHelper.accessor("reviewStatus", {
        header: "Review Status",
        cell: (info) => <StatusBadge value={info.getValue()} />,
      }),
      columnHelper.display({
        id: "action",
        header: "Action",
        cell: () => (
          <button
            type="button"
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-[11px] font-semibold leading-3 text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
          >
            <Eye size={12} aria-hidden="true" />
            <span>
              View
              <br />
              Profile
            </span>
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
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Academic Records</h2>
        <p className="text-[10px] text-slate-400">{students.length} records</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left">
          <thead className="bg-slate-50/80">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <StudentTableRow key={row.id} row={row} />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center text-sm text-slate-400"
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
