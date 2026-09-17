"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Eye, FileText, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSROOM_REMEDIAL } from "@/lib/teacher/reportsConstants";

const remedialStyles = {
  [CLASSROOM_REMEDIAL.RECOMMENDED]: "bg-orange-50 text-cnhs-orange",
  [CLASSROOM_REMEDIAL.NOT_NEEDED]: "bg-green-50 text-cnhs-green-dark",
};

const MENU_WIDTH = 144;

function shortRemedialLabel(value) {
  if (value === CLASSROOM_REMEDIAL.RECOMMENDED) return "Remedial";
  if (value === CLASSROOM_REMEDIAL.NOT_NEEDED) return "OK";
  const text = String(value ?? "");
  if (/recommend/i.test(text)) return "Remedial";
  if (/not needed|ok/i.test(text)) return "OK";
  return text || "—";
}

function RowActionsMenu({ row, onPreview, onExport }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - 8
    );
    const top = Math.min(rect.bottom + 4, window.innerHeight - 8);
    setCoords({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    function onReposition() {
      updatePosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(event) {
      const target = event.target;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: coords.top, left: coords.left }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPreview?.(row);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye size={12} />
              Preview
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport?.(row);
              }}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={12} />
              Excel
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
      >
        <MoreHorizontal size={14} />
      </button>
      {menu}
    </>
  );
}

export default function ClassReportsTable({
  reports,
  onPreview,
  onExport,
  onGenerateSystemReport,
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] text-slate-400">
        {reports.length} {reports.length === 1 ? "class" : "classes"}
      </p>
      <div className="overflow-x-auto border-y border-slate-200 dark:border-white/10">
        <table className="min-w-[760px] w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Section
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Subject
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Students
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Avg
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                ARAL
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Status
              </th>
              <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Monitoring
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  No class reports match the selected filters.
                </td>
              </tr>
            ) : (
              reports.map((row) => {
                const aralDisplay =
                  row.aralScreeningDisplay ??
                  (row.aralEligible === false
                    ? "—"
                    : (row.aralScreening ?? row.intervention ?? 0));
                const remedialLabel = shortRemedialLabel(row.classroomRemedial);

                return (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3 text-[12px] text-slate-600">
                      {row.section ?? row.gradeSection}
                    </td>
                    <td className="px-3 py-3 text-[12px] font-semibold text-slate-800">
                      {row.subject}
                    </td>
                    <td className="px-3 py-3 text-center text-[12px] font-semibold text-slate-700">
                      {row.students}
                    </td>
                    <td className="px-3 py-3 text-right text-[12px] font-semibold text-cnhs-green-dark">
                      {row.averageGrade}
                    </td>
                    <td className="px-3 py-3 text-center text-[12px] font-semibold text-slate-600">
                      {aralDisplay}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold",
                          remedialStyles[row.classroomRemedial] ??
                            remedialStyles[CLASSROOM_REMEDIAL.NOT_NEEDED]
                        )}
                      >
                        {remedialLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-slate-500">
                      {row.monitoringStatus}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {onGenerateSystemReport ? (
                          <button
                            type="button"
                            onClick={() => onGenerateSystemReport(row)}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
                          >
                            <FileText size={12} />
                            Generate
                          </button>
                        ) : null}
                        <RowActionsMenu
                          row={row}
                          onPreview={onPreview}
                          onExport={onExport}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
