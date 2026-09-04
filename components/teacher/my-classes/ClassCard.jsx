"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Eraser,
  FileSpreadsheet,
  Loader2,
  MoreHorizontal,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconTones = {
  blue: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  green: "bg-green-50 text-cnhs-green-dark",
  gold: "bg-amber-50 text-amber-600",
  brown: "bg-orange-50 text-orange-700",
  pink: "bg-pink-50 text-pink-600",
  teal: "bg-teal-50 text-teal-600",
};

const btnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors";

export default function ClassCard({
  classItem,
  onUploadRecord,
  onGenerateReport,
  onRequestDelete,
  generating = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handlePointerDown(event) {
      if (
        !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function runRequest(kind) {
    setMenuOpen(false);
    onRequestDelete?.(classItem, kind);
  }

  const metaRows = [
    { label: "Grade & Section", value: classItem.gradeSection },
    { label: "School Year", value: classItem.schoolYear || "—" },
    {
      label: "Term",
      value: classItem.quarterLabel || classItem.currentQuarter || "—",
    },
    { label: "Students", value: classItem.students },
  ];

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconTones[classItem.iconTone] ?? iconTones.blue
          )}
        >
          <BookOpen size={18} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Subject
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                {classItem.subject}
              </h3>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {classItem.quarterLabel ||
                classItem.currentQuarter ||
                classItem.quarter}
            </span>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50/80 px-3 py-2.5">
        {metaRows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[10px] font-medium text-slate-400">
              {row.label}
            </dt>
            <dd className="mt-0.5 truncate text-[12px] font-semibold text-slate-800">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto space-y-2 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/teacher/my-classes/${classItem.id}`}
            className={cn(
              btnBase,
              "bg-cnhs-green-dark text-white hover:bg-[#246f54]"
            )}
          >
            <BookOpen size={12} />
            Open Class
          </Link>
          <button
            type="button"
            onClick={onUploadRecord}
            className={cn(
              btnBase,
              "cursor-pointer border border-cnhs-orange/40 bg-white text-cnhs-orange hover:bg-orange-50"
            )}
          >
            <Upload size={12} />
            Upload Record
          </button>
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => onGenerateReport?.(classItem)}
            title="Create/refresh this class report file in Academic Monitoring"
            className={cn(
              btnBase,
              "cursor-pointer border border-cnhs-green-dark/35 bg-white text-cnhs-green-dark hover:bg-green-50 disabled:opacity-60"
            )}
          >
            {generating ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={12} />
            )}
            Generate report
          </button>
          <Link
            href={`/teacher/my-classes/${classItem.id}/students`}
            className={cn(
              btnBase,
              "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <Users size={12} />
            View Students
          </Link>

          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              aria-label={`More actions for ${classItem.subject}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen ? (
              <div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label={`Requests for ${classItem.subject}`}
                className="absolute right-0 bottom-full z-20 mb-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.14)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runRequest("ecr")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <Eraser size={13} aria-hidden="true" />
                  Request clear ECR
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runRequest("class")}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Request delete
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
