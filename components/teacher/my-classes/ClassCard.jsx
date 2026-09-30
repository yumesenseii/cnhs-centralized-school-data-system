"use client";

import Link from "next/link";
import {
  BookOpen,
  FileSpreadsheet,
  Loader2,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconTones = {
  blue: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
  green: "bg-green-50 text-cnhs-green-dark dark:bg-emerald-950/50 dark:text-emerald-400",
  gold: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  brown: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  pink: "bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400",
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400",
};

const btnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors";

export default function ClassCard({
  classItem,
  onUploadRecord,
  onGenerateReport,
  generating = false,
}) {
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
    <article className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
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
              <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {classItem.subject}
              </h3>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {classItem.quarterLabel ||
                classItem.currentQuarter ||
                classItem.quarter}
            </span>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/50">
        {metaRows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[10px] font-medium text-slate-400">
              {row.label}
            </dt>
            <dd className="mt-0.5 truncate text-[12px] font-semibold text-slate-800 dark:text-slate-200">
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
              "cursor-pointer border border-cnhs-orange/40 bg-white text-cnhs-orange hover:bg-orange-50 dark:bg-slate-800 dark:hover:bg-slate-750"
            )}
          >
            <Upload size={12} />
            Upload Record
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => onGenerateReport?.(classItem)}
            title="Create/refresh this class report file in Academic Monitoring"
            className={cn(
              btnBase,
              "cursor-pointer border border-cnhs-green-dark/35 bg-white text-cnhs-green-dark hover:bg-green-50 dark:border-emerald-700/50 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-slate-750 disabled:opacity-60"
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
              "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
            )}
          >
            <Users size={12} />
            View Students
          </Link>
        </div>
      </div>
    </article>
  );
}
