"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

/**
 * Builds a compact page list with ellipsis for large page counts.
 * Example: 1 … 4 5 6 … 12
 */
function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 3) {
    items.add(2);
    items.add(3);
    items.add(4);
  }
  if (currentPage >= totalPages - 2) {
    items.add(totalPages - 3);
    items.add(totalPages - 2);
    items.add(totalPages - 1);
  }

  const sorted = [...items].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const result = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  }

  return result;
}

export { PAGE_SIZE };

export default function MonitoringTablePagination({
  page,
  pageSize = PAGE_SIZE,
  total,
  onPageChange,
}) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const pageItems = buildPageItems(safePage, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-[11px] font-medium text-slate-500">
        Showing{" "}
        <span className="font-semibold text-slate-700">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-slate-700">{total}</span> students
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={13} />
          Previous
        </button>

        <div className="flex items-center gap-1">
          {pageItems.map((item, index) => {
            if (item === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-[11px] font-medium text-slate-400"
                >
                  …
                </span>
              );
            }

            const isActive = item === safePage;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition-colors",
                  isActive
                    ? "bg-cnhs-green-dark text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
