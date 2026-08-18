"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RecordsBrowseBar({
  search = "",
  onSearchChange,
  statusFilter = "all",
  onStatusChange,
  counts = {},
  extraFilters = null,
  showGradePills = false,
}) {
  const pills = showGradePills
    ? [
        { id: "all", label: "All", count: counts.all ?? 0 },
        { id: "graded", label: "Has grades", count: counts.graded ?? 0 },
        { id: "ungraded", label: "No grades", count: counts.ungraded ?? 0 },
      ]
    : [];

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={
              showGradePills
                ? "Search learners by name or student number…"
                : "Search is available after you open a class list"
            }
            disabled={!showGradePills}
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-[12px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        {extraFilters}
      </div>

      {pills.length ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pills.map((pill) => {
              const active = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => onStatusChange?.(pill.id)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-cnhs-green-dark text-white"
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {pill.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
