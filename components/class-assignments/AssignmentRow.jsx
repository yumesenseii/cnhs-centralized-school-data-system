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
      <td className="px-3 py-2 pl-4 text-[12px] font-semibold text-slate-800">
        {assignment.teacherName}
      </td>
      <td className="px-3 py-2 text-[12px] text-slate-700">
        {assignment.subjectName}
        {assignment.subjectCode ? (
          <span className="ml-1 text-slate-400">({assignment.subjectCode})</span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-[12px] text-slate-600">
        {assignment.gradeLabel}
      </td>
      <td className="px-3 py-2 text-[12px] font-medium text-slate-700">
        {assignment.sectionName}
      </td>
      <td className="px-3 py-2 text-[12px] text-slate-600">
        {assignment.schoolYear}
      </td>
      <td className="px-3 py-2 text-[12px] text-slate-600">
        {assignment.quarterLabel}
      </td>
      <td className="px-3 py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onEdit?.(assignment)}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <Pencil size={11} />
            Edit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete?.(assignment)}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
          >
            <Trash2 size={11} />
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
