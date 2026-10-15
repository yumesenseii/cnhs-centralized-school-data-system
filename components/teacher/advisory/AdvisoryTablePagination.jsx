"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Reusable 10-row pagination bar used across all Advisory Section modals.
 */
export default function AdvisoryTablePagination({
  currentPage = 1,
  totalRecords = 0,
  pageSize = 10,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startIndex = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalRecords);

  if (totalRecords <= pageSize && currentPage === 1) {
    // Show simple record count when under 10 records
    return (
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-transparent text-xs text-slate-500 dark:text-slate-400">
        <span>
          Showing {totalRecords} {totalRecords === 1 ? "record" : "records"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60 dark:border-white/5 dark:bg-transparent text-xs text-slate-500 dark:text-slate-400">
      <span>
        Showing {startIndex}–{endIndex} of {totalRecords} records
      </span>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <ChevronLeft size={13} />
          <span>Previous</span>
        </button>

        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 px-1">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <span>Next</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
