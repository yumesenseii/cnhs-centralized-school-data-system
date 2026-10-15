"use client";

import React, { useState } from "react";
import { X, Calendar, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import AdvisoryTablePagination from "@/components/teacher/advisory/AdvisoryTablePagination";
import { deriveSchoolYearAttendanceMonths } from "@/lib/attendance/constants";
import { cn } from "@/lib/utils";

export default function AdvisoryAttendanceModal({
  isOpen,
  onClose,
  section,
  attendanceMonths = [],
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  if (!isOpen) return null;

  // Process rows dynamically aligned with active section school year
  const calendarMonths = deriveSchoolYearAttendanceMonths(section?.schoolYear);
  const rows = calendarMonths.map((cal) => {
    const found = (attendanceMonths || []).find((dbM) => {
      const dbName = String(dbM.month || "").toLowerCase();
      const calName = cal.month.toLowerCase().split(" ")[0];
      return dbName.includes(calName);
    });

    const totalAtt = found ? Number(found.total_attendance || found.att || 0) : 0;
    const absences = found ? Number(found.absences || found.abs || 0) : 0;
    const hasData = Boolean(found?.isRecorded) || totalAtt > 0 || absences > 0;
    const rate = hasData && totalAtt + absences > 0
      ? `${((totalAtt / (totalAtt + absences)) * 100).toFixed(1)}%`
      : "—";

    return {
      month: cal.month,
      rate,
      absences: hasData ? absences : "—",
      status: hasData ? "Recorded" : "Pending",
    };
  });

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
    >
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-white/10 dark:bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-cnhs-green dark:bg-emerald-950/40 dark:text-emerald-300">
                <Calendar size={14} />
              </span>
              <h2
                id="attendance-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Monthly Attendance Summary
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Grade {section?.gradeLevel} &mdash; {section?.sectionName}
              <span className="mx-1.5 text-slate-300">•</span>
              SY {section?.schoolYear || "2026-2027"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Read-only info banner */}
        <div className="bg-slate-50/80 px-5 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 dark:bg-white/[0.02] dark:border-white/5 dark:text-slate-300">
          <span>
            Section attendance rates and recorded monthly absences.
          </span>
          <Link
            href="/teacher/attendance"
            className="inline-flex items-center gap-1 font-semibold text-cnhs-green hover:underline"
          >
            <span>Daily Attendance</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-100 dark:bg-white/[0.03] dark:border-white/5 dark:text-slate-300">
              <tr>
                <th className="py-3 px-4">School Month</th>
                <th className="py-3 px-4 text-center">Attendance Rate</th>
                <th className="py-3 px-4 text-center">Absences</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs dark:divide-white/5">
              {paginatedRows.map((row, idx) => {
                const isRecorded = row.status === "Recorded";
                return (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/70 transition dark:hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {row.month}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                      {row.rate}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-300">
                      {row.absences}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                          isRecorded
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        )}
                      >
                        {isRecorded ? (
                          <CheckCircle2 size={11} className="shrink-0" />
                        ) : (
                          <Clock size={11} className="shrink-0" />
                        )}
                        <span>{row.status}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 10-Row Pagination */}
        <AdvisoryTablePagination
          currentPage={currentPage}
          totalRecords={rows.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 flex justify-end dark:border-white/5 dark:bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
