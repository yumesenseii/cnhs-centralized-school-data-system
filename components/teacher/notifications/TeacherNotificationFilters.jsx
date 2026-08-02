"use client";

import { Search, X } from "lucide-react";

export default function TeacherNotificationFilters({
  filters,
  search,
  type,
  priority,
  status,
  onSearchChange,
  onTypeChange,
  onPriorityChange,
  onStatusChange,
  onClear,
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search notifications</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search notifications..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Type", value: type, set: onTypeChange, options: filters.types },
            {
              label: "Priority",
              value: priority,
              set: onPriorityChange,
              options: filters.priorities,
            },
            {
              label: "Status",
              value: status,
              set: onStatusChange,
              options: filters.statuses,
            },
          ].map((filter) => (
            <label key={filter.label}>
              <span className="sr-only">{filter.label}</span>
              <select
                value={filter.value}
                onChange={(event) => filter.set(event.target.value)}
                className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 pr-7 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
              >
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
          >
            <X size={12} />
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
