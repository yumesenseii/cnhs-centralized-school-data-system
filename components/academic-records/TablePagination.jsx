"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export const ACADEMIC_RECORDS_PAGE_SIZE = 50;

/**
 * Real pagination for Academic Records learners table.
 */
export default function TablePagination({
  page = 1,
  pageSize = ACADEMIC_RECORDS_PAGE_SIZE,
  total = 0,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <p className="text-[11px] font-medium text-slate-500">
        Showing{" "}
        <span className="font-semibold tabular-nums text-slate-700">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="font-semibold tabular-nums text-slate-700">{total}</span>
        {pageSize ? (
          <span className="text-slate-400"> · {pageSize} per page</span>
        ) : null}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={safePage <= 1 || total === 0}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={13} aria-hidden="true" />
          Previous
        </button>
        <span className="min-w-[4.5rem] text-center text-[11px] font-semibold tabular-nums text-slate-600">
          {total === 0 ? "0 / 0" : `${safePage} / ${totalPages}`}
        </span>
        <button
          type="button"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={safePage >= totalPages || total === 0}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
