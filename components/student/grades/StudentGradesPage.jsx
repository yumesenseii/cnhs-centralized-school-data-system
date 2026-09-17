"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, FileDown, Filter, Loader2 } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import StudentSectionCard from "@/components/student/layout/StudentSectionCard";
import StudentFilterDropdown from "@/components/student/layout/StudentFilterDropdown";
import { Pill, gradeStatusStyles } from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { exportStudentGradesPdf } from "@/lib/student/gradesExport";
import { termLabel } from "@/lib/academic/termLabels";

const ALL = "all";

export default function StudentGradesPage() {
  const { data, loading, error } = useStudentPortal();
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [termFilter, setTermFilter] = useState(ALL);
  const [subjectFilter, setSubjectFilter] = useState(ALL);

  const termOptions = useMemo(() => {
    const set = new Set();
    for (const row of data?.allGrades ?? []) {
      if (row.quarter != null && row.quarter !== "") set.add(String(row.quarter));
    }
    const terms = [...set]
      .sort((a, b) => Number(a) - Number(b))
      .map((q) => ({ value: q, label: termLabel(q) }));
    return [{ value: ALL, label: "All terms" }, ...terms];
  }, [data?.allGrades]);

  const subjectOptions = useMemo(() => {
    const set = new Set();
    for (const row of data?.allGrades ?? []) {
      if (row.subject) set.add(row.subject);
    }
    const subjects = [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((subject) => ({ value: subject, label: subject }));
    return [{ value: ALL, label: "All subjects" }, ...subjects];
  }, [data?.allGrades]);

  const filteredGrades = useMemo(() => {
    const rows = data?.allGrades ?? [];
    return rows.filter((row) => {
      if (termFilter !== ALL && String(row.quarter) !== termFilter) return false;
      if (subjectFilter !== ALL && row.subject !== subjectFilter) return false;
      return true;
    });
  }, [data?.allGrades, termFilter, subjectFilter]);

  function handleExportPdf(event) {
    event?.preventDefault?.();
    if (!data) return;
    setExportError("");
    setExporting(true);
    try {
      exportStudentGradesPdf({
        profile: data.profile,
        period: data.period,
        summary: data.summary,
        grades: filteredGrades,
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
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pb-3"
    >
      <StudentPageHeader
        breadcrumb="Home / My Grades"
        title="My Grades"
        subtitle="Read-only ECR subject grades"
        actions={
          data ? (
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || !filteredGrades.length}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-cnhs-green-dark/40 bg-card px-3 text-[11px] font-semibold text-cnhs-green-dark shadow-sm transition-colors duration-200 hover:bg-muted active:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mb-2 rounded-xl border border-red-200/60 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {exportError ? (
        <div className="mb-2 rounded-xl border border-red-200/60 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {exportError}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-[13px] text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          Loading grades…
        </div>
      ) : (
        <StudentSectionCard
          icon={BookOpen}
          title="Grade records"
          subtitle={
            data.period.schoolYear
              ? `${data.period.schoolYear} · ${termLabel(data.period.quarter)}${
                  data.summary.average != null
                    ? ` · Avg ${data.summary.average}`
                    : ""
                }`
              : "No grading period yet"
          }
          actions={
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Filter size={12} />
              {filteredGrades.length} shown
            </span>
          }
          bodyClassName="p-0 sm:p-0"
        >
          <div className="relative z-10 flex flex-wrap items-end gap-2.5 border-b border-border bg-muted/30 px-3 py-2.5 sm:px-3.5">
            <StudentFilterDropdown
              label="Term"
              value={termFilter}
              options={termOptions}
              onChange={setTermFilter}
            />
            <StudentFilterDropdown
              label="Subject"
              value={subjectFilter}
              options={subjectOptions}
              onChange={setSubjectFilter}
              className="min-w-[160px] flex-[1.2]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="bg-muted/40">
                <tr className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="px-3 py-2.5 font-semibold sm:px-3.5">Subject</th>
                  <th className="px-3 py-2.5 font-semibold sm:px-3.5">School Year</th>
                  <th className="px-3 py-2.5 font-semibold sm:px-3.5">Term</th>
                  <th className="px-3 py-2.5 font-semibold sm:px-3.5">Final Grade</th>
                  <th className="px-3 py-2.5 font-semibold sm:px-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredGrades.length ? (
                    filteredGrades.map((row) => (
                      <motion.tr
                        key={row.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="border-t border-border text-[12px]"
                      >
                        <td className="px-3 py-2 font-medium text-card-foreground sm:px-3.5">
                          {row.subject}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground sm:px-3.5">
                          {row.schoolYear}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground sm:px-3.5">
                          {termLabel(row.quarter)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-card-foreground sm:px-3.5">
                          {row.finalGrade ?? "—"}
                        </td>
                        <td className="px-3 py-2 sm:px-3.5">
                          <Pill value={row.status} styles={gradeStatusStyles} />
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <motion.tr
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td
                        colSpan={5}
                        className="px-3 py-10 text-center text-[11px] text-muted-foreground"
                      >
                        No grades match the selected term and subject.
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </StudentSectionCard>
      )}
    </motion.div>
  );
}
