"use client";

import { Search, X } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";

export default function LessonPlanFilters({
  filters,
  search,
  status,
  subject,
  quarter,
  onSearchChange,
  onStatusChange,
  onSubjectChange,
  onQuarterChange,
  onClear,
  resultCount,
  totalCount,
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search lesson plans</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title or subject..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            label="Status"
            value={status}
            onChange={onStatusChange}
            options={filters.statuses}
            size="field"
            triggerClassName="h-9 rounded-lg text-[11px]"
          />

          <AppSelect
            label="Subject"
            value={subject}
            onChange={onSubjectChange}
            options={filters.subjects}
            size="field"
            triggerClassName="h-9 rounded-lg text-[11px]"
          />

          <AppSelect
            label="Quarter"
            value={quarter}
            onChange={onQuarterChange}
            options={filters.quarters}
            size="field"
            triggerClassName="h-9 rounded-lg text-[11px]"
          />

          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
          >
            <X size={12} />
            Clear
          </button>

          <span className="text-[11px] font-medium text-slate-400 lg:ml-1">
            {resultCount} of {totalCount} plans
          </span>
        </div>
      </div>
    </section>
  );
}
