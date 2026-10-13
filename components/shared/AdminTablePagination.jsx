"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_ADMIN_PAGE_SIZE = 10;

/**
 * Standardized Pagination component for CNHS Learn Principal/Admin tables.
 *
 * Rules:
 * - 10 records per page.
 * - When total <= 10, shows only the record count and hides navigation buttons.
 * - When total === 0, returns null (empty state displayed inside table body).
 * - Previous/Next buttons are large, clear, and easy to click for middle-aged users.
 */
export default function AdminTablePagination({
  page = 1,
  pageSize = DEFAULT_ADMIN_PAGE_SIZE,
  total = 0,
  onPageChange,
  itemLabel = "records",
  className,
}) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const isMultiPage = totalPages > 1;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        className
      )}
    >
      {/* Record Counter (Bottom Left) */}
      <p className="text-[12px] font-medium text-slate-500">
        Showing{" "}
        <span className="font-semibold tabular-nums text-slate-800">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="font-semibold tabular-nums text-slate-800">{total}</span>{" "}
        {itemLabel}
      </p>

      {/* Navigation Controls (Bottom Right - only when multiple pages) */}
      {isMultiPage ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange?.(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Previous
          </button>

          <span className="min-w-[6.5rem] text-center text-[12px] font-semibold tabular-nums text-slate-700">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange?.(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700"
          >
            Next
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
