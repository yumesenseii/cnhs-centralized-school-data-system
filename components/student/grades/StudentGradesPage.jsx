"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileDown, Loader2, BookOpen } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import StudentSectionCard from "@/components/student/layout/StudentSectionCard";
import { Pill, gradeStatusStyles } from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { exportStudentGradesPdf } from "@/lib/student/gradesExport";
import { termLabel } from "@/lib/academic/termLabels";

export default function StudentGradesPage() {
  const { data, loading, error } = useStudentPortal();
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  function handleExportPdf() {
    if (!data) return;
    setExportError("");
    setExporting(true);
    try {
      exportStudentGradesPdf({
        profile: data.profile,
        period: data.period,
        summary: data.summary,
        grades: data.allGrades,
      });
    } catch (err) {
      setExportError(err?.message ?? "Unable to export PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <StudentPageHeader
        breadcrumb="Home / My Grades"
        title="My Grades"
        subtitle="Read-only subject grades from imported E-Class records"
        actions={
          data ? (
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || !data.allGrades.length}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileDown size={13} />
              )}
              Export PDF
            </button>
          ) : null
        }
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {exportError ? (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {exportError}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading grades…
        </div>
      ) : (
        <StudentSectionCard
          icon={BookOpen}
          title="Grade records"
          subtitle={
            data.period.schoolYear
              ? `Showing ${data.period.schoolYear} · ${termLabel(data.period.quarter)}${
                  data.summary.average != null
                    ? ` · Average ${data.summary.average}`
                    : ""
                }`
              : "No grading period available yet"
          }
          actions={
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || !data.allGrades.length}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green/30 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:bg-cnhs-green/10 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
            >
              <FileDown size={13} />
              Export PDF
            </button>
          }
          bodyClassName="p-0 sm:p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-slate-50/80">
                <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Subject</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">School Year</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Term</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Final Grade</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.allGrades.length ? (
                  data.allGrades.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 text-[12px]"
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-700 sm:px-5">
                        {row.subject}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 sm:px-5">
                        {row.schoolYear}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 sm:px-5">
                        {termLabel(row.quarter)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800 sm:px-5">
                        {row.finalGrade ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 sm:px-5">
                        <Pill value={row.status} styles={gradeStatusStyles} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-xs text-slate-400 sm:px-5"
                    >
                      No enrolled subjects or grades yet for your account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </StudentSectionCard>
      )}
    </motion.div>
  );
}
