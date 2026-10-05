"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileDown,
  Filter,
  Loader2,
} from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import AppSelect from "@/components/shared/AppSelect";
import { Pill, gradeStatusStyles } from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { exportStudentGradesPdf } from "@/lib/student/gradesExport";
import { downloadSingleStudentSf9Pdf } from "@/lib/reports/sf9PdfGenerator";
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

  // Rows scoped by term filter for summary cards
  const periodRows = useMemo(() => {
    const all = data?.allGrades ?? [];
    if (termFilter === ALL) return all;
    return all.filter((r) => String(r.quarter) === String(termFilter));
  }, [data?.allGrades, termFilter]);

  // Authoritative dynamic summary KPI metrics
  const summaryMetrics = useMemo(() => {
    if (!periodRows.length) {
      return {
        average: "—",
        recordedRatio: "0 / 0",
        below75Count: "—",
        gradePeriod:
          termFilter === ALL
            ? "ALL TERMS"
            : termLabel(termFilter).toUpperCase(),
      };
    }

    const recorded = periodRows.filter(
      (r) =>
        r.finalGrade !== null &&
        r.finalGrade !== undefined &&
        r.finalGrade !== "" &&
        Number.isFinite(Number(r.finalGrade))
    );
    const numericGrades = recorded.map((r) => Number(r.finalGrade));

    const avg =
      numericGrades.length > 0
        ? Math.round(
            (numericGrades.reduce((sum, g) => sum + g, 0) /
              numericGrades.length) *
              100
          ) / 100
        : null;

    const below75 =
      recorded.length > 0
        ? recorded.filter((r) => Number(r.finalGrade) < 75).length
        : null;

    let periodText = "ALL TERMS";
    if (termFilter !== ALL) {
      periodText = termLabel(termFilter).toUpperCase();
    } else {
      const distinctQuarters = [
        ...new Set(periodRows.map((r) => r.quarter).filter(Boolean)),
      ];
      if (distinctQuarters.length === 1) {
        periodText = termLabel(distinctQuarters[0]).toUpperCase();
      }
    }

    return {
      average: avg != null ? String(avg) : "—",
      recordedRatio: `${recorded.length} / ${periodRows.length}`,
      below75Count: below75 != null ? String(below75) : "—",
      gradePeriod: periodText,
    };
  }, [periodRows, termFilter]);

  // Final filtered list for table display
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
        summary: {
          ...data.summary,
          average:
            summaryMetrics.average !== "—"
              ? Number(summaryMetrics.average)
              : null,
        },
        grades: filteredGrades,
        allGrades: data.allGrades,
        termFilter,
      });
    } catch (err) {
      setExportError(err?.message ?? "Unable to export PDF.");
    } finally {
      setExporting(false);
    }
  }

  // Header grade/section and school year text
  const gradeLevelSection =
    [data?.profile?.gradeLevel, data?.profile?.sectionName]
      .filter(Boolean)
      .join(" • ") ||
    data?.profile?.gradeSection ||
    "—";

  const schoolYearDisplay =
    data?.period?.schoolYear || data?.profile?.schoolYear || "SY 2026–2027";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pb-5"
    >
      {/* 2.1 PAGE HEADER — Matching Admin and Teacher portal hierarchy */}
      <StudentPageHeader
        breadcrumb="Home / My Grades"
        title="MY GRADES"
        subtitle={
          <div className="mt-1 space-y-0.5">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {gradeLevelSection}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {schoolYearDisplay}
            </p>
          </div>
        }
        actions={
          data ? (
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || !filteredGrades.length}
              title="Download formal Student Academic Progress Report (PDF)"
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-[12px] font-semibold text-cnhs-green-dark shadow-sm transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
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
        <div className="mb-3 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {exportError ? (
        <div className="mb-3 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {exportError}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-[13px] text-slate-500 shadow-sm dark:border-white/5 dark:bg-card dark:text-slate-400">
          <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
          Loading grades…
        </div>
      ) : (
        <>
          {/* Official DepEd School Form 9 (SF9) Released Report Card */}
          {data?.releasedSf9 && (
            <div className="mb-4 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cnhs-green text-white shadow-xs">
                    <FileDown size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Official DepEd School Form 9 (SF9) Report Card
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-cnhs-green-dark dark:bg-emerald-900/60 dark:text-emerald-300">
                        <CheckCircle2 size={11} />
                        Released
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                      Official Learner Progress Report Card for {data?.releasedSf9?.school_year || "SY 2026-2027"}. Released on {new Date(data?.releasedSf9?.released_at || Date.now()).toLocaleDateString()}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (data?.releasedSf9?.snapshot_data) {
                        downloadSingleStudentSf9Pdf(
                          data.releasedSf9.snapshot_data,
                          data.releasedSf9.school_year
                        );
                      }
                    }}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-cnhs-green px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#115a3e] active:bg-[#0c432e] transition-colors"
                  >
                    <FileDown size={14} />
                    <span>Download Official SF9 (PDF)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2.2 ACADEMIC SUMMARY — Unified with Admin/Teacher KPI Cards */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-2.5 sm:p-3 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {/* OVERALL AVERAGE */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Award size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Overall Average
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-cnhs-green-dark dark:text-emerald-300 sm:text-2xl">
                    {summaryMetrics.average}
                  </p>
                </div>
              </div>

              {/* RECORDED SUBJECTS */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <CheckCircle2 size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Recorded Subjects
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {summaryMetrics.recordedRatio}
                  </p>
                </div>
              </div>

              {/* SUBJECTS BELOW 75 */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    summaryMetrics.below75Count !== "0" &&
                    summaryMetrics.below75Count !== "—"
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                  }`}
                >
                  <AlertTriangle size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Subjects Below 75
                  </p>
                  <p
                    className={`mt-0.5 text-xl font-bold tracking-tight sm:text-2xl ${
                      summaryMetrics.below75Count !== "0" &&
                      summaryMetrics.below75Count !== "—"
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {summaryMetrics.below75Count}
                  </p>
                </div>
              </div>

              {/* GRADE PERIOD */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Calendar size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Grade Period
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {summaryMetrics.gradePeriod}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2.3 FILTERS & 2.4 GRADE TABLE — Standard CNHS LEARN Table Card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
            {/* Card Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-cnhs-green-dark dark:text-emerald-300" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Grade Records
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    View your subject performance and official grade descriptors.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Filter size={12} />
                {filteredGrades.length} records shown
              </span>
            </div>

            {/* Filter Section using shared AppSelect */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/30 p-3 sm:px-4 dark:border-white/5 dark:bg-white/[0.01]">
              <AppSelect
                label="Term"
                value={termFilter}
                onChange={setTermFilter}
                options={termOptions}
                className="w-full sm:w-[160px]"
                triggerClassName="h-9 rounded-lg text-[11px] font-medium"
              />
              <AppSelect
                label="Subject"
                value={subjectFilter}
                onChange={setSubjectFilter}
                options={subjectOptions}
                className="w-full sm:w-[220px]"
                triggerClassName="h-9 rounded-lg text-[11px] font-medium"
              />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
                  <tr className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5">School Year</th>
                    <th className="px-4 py-2.5">Term</th>
                    <th className="px-4 py-2.5 text-center">Final Grade</th>
                    <th className="px-4 py-2.5">Descriptor / Status</th>
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
                          className="border-t border-slate-100 text-[12px] transition-colors hover:bg-slate-50/60 dark:border-white/5 dark:hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                            {row.subject}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                            {row.schoolYear || schoolYearDisplay}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                            {termLabel(row.quarter)}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold text-slate-900 dark:text-white">
                            {row.finalGrade != null && row.finalGrade !== ""
                              ? row.finalGrade
                              : ""}
                          </td>
                          <td className="px-4 py-2.5">
                            {row.finalGrade != null &&
                            row.finalGrade !== "" &&
                            (row.descriptor || row.status) ? (
                              <Pill
                                value={row.descriptor || row.status}
                                styles={gradeStatusStyles}
                              />
                            ) : null}
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
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="mx-auto max-w-sm space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {data?.allGrades?.length === 0
                                ? "No grade records available"
                                : "No grade records match the selected filter"}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {data?.allGrades?.length === 0
                                ? "Your academic records will appear here once grades are available."
                                : "Try selecting a different term or subject filter above."}
                            </p>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
