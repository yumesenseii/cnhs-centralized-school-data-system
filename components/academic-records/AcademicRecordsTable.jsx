"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import StudentTableRow from "@/components/academic-records/StudentTableRow";

const columnHelper = createColumnHelper();

function formatGrade(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return <span className="text-[11px] font-medium text-slate-400">—</span>;
  }
  return (
    <span
      className={
        n < 75
          ? "text-[12px] font-semibold tabular-nums text-red-600"
          : "text-[12px] font-semibold tabular-nums text-slate-800"
      }
    >
      {n.toFixed(0)}
    </span>
  );
}

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
  title = "Class list",
  recordCount,
  termHeader = "Term grade",
}) {
  const displayCount =
    typeof recordCount === "number" ? recordCount : students.length;
  const columns = useMemo(() => {
    const cols = [
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
      columnHelper.accessor("gender", {
        header: "Gender",
        cell: (info) => (
          <span className="whitespace-nowrap text-[11px] text-slate-600">
            {info.getValue() || "—"}
          </span>
        ),
      }),
      columnHelper.accessor("term1", {
        header: "Term 1",
        cell: (info) => formatGrade(info.getValue()),
      }),
      columnHelper.accessor("term2", {
        header: "Term 2",
        cell: (info) => formatGrade(info.getValue()),
      }),
      columnHelper.accessor("term3", {
        header: "Term 3",
        cell: (info) => formatGrade(info.getValue()),
      }),
      columnHelper.accessor("final", {
        header: "Final",
        cell: (info) => formatGrade(info.getValue()),
      }),
    ];
    if (termHeader) {
      cols.push(
        columnHelper.accessor("termGrade", {
          header: termHeader,
          cell: (info) => formatGrade(info.getValue()),
        })
      );
    }
    return cols;
  }, [termHeader]);

  const table = useReactTable({
    data: students,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <section className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-50 px-3 py-2">
        <h2 className="text-[13px] font-semibold text-slate-800">{title}</h2>
        <p className="text-[10px] tabular-nums text-slate-400">
          {typeof recordCount === "number"
            ? `${students.length} on page · ${displayCount} in list`
            : `${students.length} records`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
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
                  Open a class card to view the full ECR class list.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
