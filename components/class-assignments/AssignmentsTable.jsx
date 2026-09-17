"use client";

import AssignmentRow from "@/components/class-assignments/AssignmentRow";
import AppSelect from "@/components/shared/AppSelect";
import { formatPersonName } from "@/lib/admin/classAssignmentMappers";
import { TERM_ALL_LABEL, TERM_OPTIONS } from "@/lib/academic/termLabels";

const columns = [
  "Teacher",
  "Subject",
  "Grade Level",
  "Section",
  "School Year",
  "Term",
  "Actions",
];

export default function AssignmentsTable({
  assignments,
  filters,
  schoolYears,
  teachers,
  onFiltersChange,
  onEdit,
  onClearGrades,
  onDelete,
  busy,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search assignments</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
            placeholder="Search teacher, subject, section, or school year"
            className="h-9 w-full rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
          />
        </label>
        <div className="flex shrink-0 flex-wrap gap-2 lg:ml-auto">
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
            label="Term"
            value={filters.quarter}
            options={[TERM_ALL_LABEL, ...TERM_OPTIONS.map((opt) => opt.label)]}
            onChange={(value) =>
              onFiltersChange({ ...filters, quarter: value })
            }
          />
          <SelectFilter
            label="Teacher"
            value={filters.teacherId}
            options={[
              { value: "All Teachers", label: "All Teachers" },
              ...teachers.map((teacher) => ({
                value: teacher.id,
                label: formatPersonName(teacher),
              })),
            ]}
            onChange={(value) =>
              onFiltersChange({ ...filters, teacherId: value })
            }
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
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
            {assignments.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-14 text-center text-sm text-slate-400"
                >
                  No class assignments found for the selected filters.
                </td>
              </tr>
            ) : (
              assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onEdit={onEdit}
                  onClearGrades={onClearGrades}
                  onDelete={onDelete}
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
  const normalized = options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : option
  );

  return (
    <div className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white pl-3 pr-1 text-[11px] text-slate-600 shadow-sm">
      <span className="font-medium text-slate-400">{label}</span>
      <AppSelect
        label={label}
        value={value}
        onChange={onChange}
        options={normalized}
        size="pill"
        className="max-w-[150px]"
        triggerClassName="h-8 border-0 bg-transparent px-1 shadow-none font-semibold text-slate-700 hover:bg-transparent"
      />
    </div>
  );
}
