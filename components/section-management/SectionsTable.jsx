"use client";

import SectionRow from "@/components/section-management/SectionRow";

const columns = [
  "Grade Level",
  "Section Name",
  "School Year",
  "Adviser",
  "Status",
  "Actions",
];

export default function SectionsTable({
  sections,
  filters,
  schoolYears,
  onFiltersChange,
  onEdit,
  onArchive,
  onRestore,
  busy,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search sections</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
            placeholder="Search by section, grade, school year, or adviser"
            className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green-dark/40"
          />
        </label>
        <div className="flex shrink-0 flex-wrap gap-2 md:ml-auto">
          <SelectFilter
            label="School Year"
            value={filters.schoolYear}
            options={["All School Years", ...schoolYears]}
            onChange={(value) =>
              onFiltersChange({ ...filters, schoolYear: value })
            }
          />
          <SelectFilter
            label="Grade"
            value={filters.grade}
            options={[
              "All Grades",
              "Grade 7",
              "Grade 8",
              "Grade 9",
              "Grade 10",
            ]}
            onChange={(value) => onFiltersChange({ ...filters, grade: value })}
          />
          <SelectFilter
            label="Status"
            value={filters.status}
            options={["All Status", "Active", "Archived"]}
            onChange={(value) => onFiltersChange({ ...filters, status: value })}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 first:pl-4 last:pr-4"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-14 text-center text-sm text-slate-400"
                >
                  No sections found for the selected filters.
                </td>
              </tr>
            ) : (
              sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onRestore={onRestore}
                  busy={busy}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-600 shadow-sm">
      <span className="font-medium text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[140px] cursor-pointer bg-transparent font-semibold text-slate-700 outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
