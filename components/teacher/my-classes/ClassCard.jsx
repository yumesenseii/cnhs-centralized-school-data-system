"use client";

import Link from "next/link";
import { BookOpen, FileSpreadsheet, Loader2, Trash2, Upload, Users } from "lucide-react";
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

export default function ClassCard({
  classItem,
  onUploadRecord,
  onGenerateReport,
  onRequestDelete,
  generating = false,
}) {
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

      <dl className="mt-4 space-y-2.5 rounded-xl bg-slate-50/80 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-medium text-slate-400">
            Grade & Section
          </dt>
          <dd className="text-right text-[12px] font-semibold text-slate-800">
            {classItem.gradeSection}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-medium text-slate-400">School Year</dt>
          <dd className="text-right text-[12px] font-semibold text-slate-800">
            {classItem.schoolYear || "—"}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-medium text-slate-400">Term</dt>
          <dd className="text-right text-[12px] font-semibold text-slate-800">
            {classItem.quarterLabel || classItem.currentQuarter || "—"}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-medium text-slate-400">Students</dt>
          <dd className="text-right text-[12px] font-semibold text-slate-800">
            {classItem.students}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link
          href={`/teacher/my-classes/${classItem.id}`}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <BookOpen size={12} />
          Open Class
        </Link>
        <button
          type="button"
          onClick={onUploadRecord}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cnhs-orange/40 bg-white px-3 text-[11px] font-semibold text-cnhs-orange transition-colors hover:bg-orange-50"
        >
          <Upload size={12} />
          Upload Record
        </button>
        <button
          type="button"
          disabled={generating}
          onClick={() => onGenerateReport?.(classItem)}
          title="Create/refresh this class report file in Academic Monitoring"
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50 disabled:opacity-60"
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
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Users size={12} />
          View Students
        </Link>
        <button
          type="button"
          onClick={() => onRequestDelete?.(classItem, "ecr")}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
        >
          Request clear ECR
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete?.(classItem, "class")}
          className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          <Trash2 size={12} />
          Request delete
        </button>
      </div>
    </article>
  );
}
