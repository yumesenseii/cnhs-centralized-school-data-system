"use client";

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import SectionStatusBadge from "@/components/section-management/SectionStatusBadge";

export default function SectionRow({
  section,
  onEdit,
  onArchive,
  onRestore,
  busy,
}) {
  const isArchived = section.statusValue === "archived";

  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
      <td className="px-3 py-2 pl-4 text-[12px] font-medium text-slate-800">
        {section.gradeLabel}
      </td>
      <td className="px-3 py-2 text-[12px] font-semibold text-slate-800">
        {section.sectionName}
      </td>
      <td className="px-3 py-2 text-[12px] text-slate-600">{section.schoolYear}</td>
      <td className="px-3 py-2 text-[12px] text-slate-600">{section.adviserName}</td>
      <td className="px-3 py-2">
        <SectionStatusBadge value={section.status} />
      </td>
      <td className="px-3 py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={busy || isArchived}
            onClick={() => onEdit?.(section)}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil size={11} />
            Edit
          </button>
          {isArchived ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRestore?.(section)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-cnhs-green-dark/30 bg-green-50 px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArchiveRestore size={11} />
              Restore
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onArchive?.(section)}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Archive size={11} />
              Archive
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
