"use client";

import React from "react";
import {
  School,
  BookOpen,
  Calendar,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const btnBase =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors";

export default function AdvisorySectionCard({
  section,
  learnersCount = 0,
  maleCount = 0,
  femaleCount = 0,
  publishedCount = 0,
  totalCount = 8,
  onOpenWorkspace,
  onOpenSf9,
  onOpenAttendance,
  onManageSection,
}) {
  const isAllPublished = totalCount > 0 && publishedCount >= totalCount;
  const pendingCount = (totalCount || 8) - publishedCount;

  const metaRows = [
    {
      label: "Grade & Section",
      value: `Grade ${section?.gradeLevel || 7} — ${section?.sectionName || "Section"}`,
    },
    {
      label: "School Year",
      value: `SY ${section?.schoolYear || "2026-2027"}`,
    },
    {
      label: "Enrolled Learners",
      value: `${learnersCount} Students (${maleCount}M / ${femaleCount}F)`,
    },
    {
      label: "Subject Publishing",
      value: isAllPublished
        ? `${publishedCount}/${totalCount} (All Ready)`
        : `${publishedCount}/${totalCount} (${pendingCount} Pending)`,
      highlight: !isAllPublished,
    },
  ];

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
      {/* Top Header */}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark dark:bg-emerald-950/50 dark:text-emerald-400">
          <School size={18} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Official Advisory Class
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                Grade {section?.gradeLevel || 7} — {section?.sectionName || "Section"}
              </h3>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              SY {section?.schoolYear || "2026-2027"}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata 2x2 Grid */}
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/50">
        {metaRows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-[10px] font-medium text-slate-400">
              {row.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 truncate text-[12px] font-semibold",
                row.highlight
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-800 dark:text-slate-200"
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Advisory Status Pill Banner */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-1.5 text-[11px] dark:border-slate-800 dark:bg-slate-800/30">
        <div className="flex items-center gap-1.5">
          {isAllPublished ? (
            <CheckCircle2 size={13} className="text-cnhs-green dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="text-slate-600 dark:text-slate-300">
            {isAllPublished ? (
              <span>Ready for SF9 batch generation</span>
            ) : (
              <span>{pendingCount} subject{pendingCount === 1 ? "" : "s"} awaiting upload</span>
            )}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-slate-400">
          Adviser: {section?.adviserName || "Class Adviser"}
        </span>
      </div>

      {/* 2x2 Action Buttons Matching ClassCard */}
      <div className="mt-auto space-y-2 pt-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenWorkspace}
            className={cn(
              btnBase,
              "cursor-pointer bg-cnhs-green-dark text-white hover:bg-[#246f54]"
            )}
          >
            <BookOpen size={12} />
            <span>Open Class</span>
          </button>

          <button
            type="button"
            onClick={onOpenSf9}
            className={cn(
              btnBase,
              "cursor-pointer border border-cnhs-orange/40 bg-white text-cnhs-orange hover:bg-orange-50 dark:bg-slate-800 dark:hover:bg-slate-750"
            )}
          >
            <FileSpreadsheet size={12} />
            <span>SF9 Report Cards</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenAttendance}
            title="View SF2 Section Monthly Attendance"
            className={cn(
              btnBase,
              "cursor-pointer border border-cnhs-green-dark/35 bg-white text-cnhs-green-dark hover:bg-green-50 dark:border-emerald-700/50 dark:bg-slate-800 dark:text-emerald-400 dark:hover:bg-slate-750"
            )}
          >
            <Calendar size={12} />
            <span>SF2 Attendance</span>
          </button>

          <button
            type="button"
            onClick={onManageSection}
            className={cn(
              btnBase,
              "cursor-pointer border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750"
            )}
          >
            <Users size={12} />
            <span>Manage Section</span>
          </button>
        </div>
      </div>
    </article>
  );
}
