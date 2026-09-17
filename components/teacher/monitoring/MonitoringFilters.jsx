"use client";

import { Search, X } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";

export default function MonitoringFilters({
  filters,
  search,
  grade,
  section,
  subject,
  intervention,
  status,
  onSearchChange,
  onGradeChange,
  onSectionChange,
  onSubjectChange,
  onInterventionChange,
  onStatusChange,
  onClear,
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search learner</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search learner..."
            className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              label: "Grade",
              value: grade,
              set: onGradeChange,
              options: filters.grades,
            },
            {
              label: "Section",
              value: section,
              set: onSectionChange,
              options: filters.sections,
            },
            {
              label: "Subject",
              value: subject,
              set: onSubjectChange,
              options: filters.subjects,
            },
            {
              label: "Intervention",
              value: intervention,
              set: onInterventionChange,
              options: filters.interventions,
            },
            {
              label: "Status",
              value: status,
              set: onStatusChange,
              options: filters.statuses,
            },
          ].map((filter) => (
            <AppSelect
              key={filter.label}
              label={filter.label}
              value={filter.value}
              onChange={filter.set}
              options={filter.options}
              size="field"
              triggerClassName="h-8 rounded-lg px-2.5 text-[11px]"
            />
          ))}

          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
          >
            <X size={12} />
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}
