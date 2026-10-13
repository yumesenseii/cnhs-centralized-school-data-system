"use client";

import { Pencil, Trash2 } from "lucide-react";

export default function AssignmentRow({
  assignment,
  onEdit,
  onDelete,
  busy,
}) {
  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
      <td className="px-4 py-3 pl-5 text-[13px] font-semibold text-slate-900">
        {assignment.teacherName}
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-800">
        {assignment.subjectName}
        {assignment.subjectCode ? (
          <span className="ml-1 text-[12px] text-slate-400">({assignment.subjectCode})</span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-600">
        {assignment.gradeLabel}
      </td>
      <td className="px-4 py-3 text-[13px] font-medium text-slate-800">
        {assignment.sectionName}
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-600">
        {assignment.schoolYear}
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-600">
        {assignment.quarterLabel}
      </td>
      <td className="px-4 py-3 pr-5">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onEdit?.(assignment)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil size={12} />
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete?.(assignment)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
