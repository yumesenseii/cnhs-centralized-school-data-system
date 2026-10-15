"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  FileText,
  Eye,
  Download,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import AdvisoryTablePagination from "@/components/teacher/advisory/AdvisoryTablePagination";
import { formatDepEdLearnerName } from "@/lib/reports/sf9DataService";
import { downloadSingleStudentSf9Pdf } from "@/lib/reports/sf9PdfGenerator";
import { cn } from "@/lib/utils";

export default function AdvisorySf9Modal({
  isOpen,
  onClose,
  section,
  learners = [],
  totalSubjects = 8,
  onPreviewStudent,
  onBatchDownloadAll,
  isBatchDownloading = false,
  batchDownloadProgress = null,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const readyCount = useMemo(
    () => learners.filter((l) => l.isComplete).length,
    [learners]
  );
  const isAllFinalReady = learners.length > 0 && readyCount === learners.length;

  const filteredLearners = useMemo(() => {
    if (!searchQuery.trim()) return learners;
    const q = searchQuery.toLowerCase().trim();
    return learners.filter((l) => {
      const name = formatDepEdLearnerName(l).toLowerCase();
      const lrn = String(l.lrn || l.student_number || l.studentNumber || "").toLowerCase();
      return name.includes(q) || lrn.includes(q);
    });
  }, [learners, searchQuery]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  if (!isOpen) return null;

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLearners = filteredLearners.slice(
    startIndex,
    startIndex + pageSize
  );

  const handleDownloadSingleFinal = (learner) => {
    if (!learner.isComplete) return;
    downloadSingleStudentSf9Pdf(learner, section?.schoolYear);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sf9-modal-title"
    >
      <div className="flex flex-col w-full max-w-3xl max-h-[88vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-white/10 dark:bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-cnhs-green dark:bg-emerald-950/40 dark:text-emerald-300">
                <FileText size={14} />
              </span>
              <h2
                id="sf9-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                SF9 Report Cards
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Grade {section?.gradeLevel} &mdash; {section?.sectionName}
              <span className="mx-1.5 text-slate-300">•</span>
              SY {section?.schoolYear || "2026-2027"}
              <span className="mx-1.5 text-slate-300">•</span>
              <span>{learners.length} Enrolled Learners</span>
              <span className="mx-1.5 text-slate-300">•</span>
              <span className={isAllFinalReady ? "text-emerald-700 font-semibold dark:text-emerald-400" : "text-amber-700 font-semibold dark:text-amber-400"}>
                {readyCount} of {learners.length} Final-Ready
              </span>
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

        {/* Notice banner if grades are incomplete */}
        {!isAllFinalReady && (
          <div className="bg-amber-50/70 border-b border-amber-200/60 px-5 py-2.5 flex items-center gap-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-300">
            <AlertTriangle size={14} className="shrink-0 text-amber-600" />
            <span>
              Some subject grades are still pending. This is a preview and not yet the final SF9.
            </span>
          </div>
        )}

        {/* Toolbar: Search & Batch Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/40 dark:border-white/5 dark:bg-white/[0.01]">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search learner name or LRN..."
              className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-cnhs-green focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
          </div>

          <button
            type="button"
            onClick={onBatchDownloadAll}
            disabled={!isAllFinalReady || isBatchDownloading}
            title={
              isBatchDownloading
                ? "Generating PDF document, please wait..."
                : !isAllFinalReady
                ? "Batch download will be enabled once all subject grades are finalized."
                : "Download all finalized SF9 cards as a batch PDF"
            }
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-bold text-white shadow-xs hover:bg-[#1b5842] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isBatchDownloading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            <span>
              {isBatchDownloading
                ? `Compiling (${batchDownloadProgress?.percent ?? 0}%)`
                : "Batch Download All SF9"}
            </span>
          </button>
        </div>

        {/* Real-time batch PDF compilation progress */}
        {isBatchDownloading && batchDownloadProgress && (
          <div className="bg-emerald-50/80 border-b border-emerald-200/70 px-5 py-3 space-y-2 dark:bg-emerald-950/30 dark:border-emerald-800/40">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
              <span className="flex items-center gap-2">
                <Loader2 size={13} className="animate-spin text-cnhs-green" />
                <span>
                  Compiling SF9 Report Cards: Student {batchDownloadProgress.current} of {batchDownloadProgress.total}
                </span>
                {batchDownloadProgress.studentName ? (
                  <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-300">
                    ({batchDownloadProgress.studentName})
                  </span>
                ) : null}
              </span>
              <span>{batchDownloadProgress.percent}%</span>
            </div>
            <div className="w-full bg-emerald-100/80 rounded-full h-1.5 overflow-hidden dark:bg-emerald-900/40">
              <div
                className="bg-cnhs-green h-full rounded-full transition-all duration-150"
                style={{ width: `${batchDownloadProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {paginatedLearners.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {searchQuery ? "No matching learners found." : "No learners in class list."}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-100 dark:bg-white/[0.03] dark:border-white/5 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3.5 w-10 text-center">#</th>
                  <th className="py-2.5 px-3.5">Learner</th>
                  <th className="py-2.5 px-3.5 text-center">Grade Completion</th>
                  <th className="py-2.5 px-3.5 text-center">SF9 Status</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs dark:divide-white/5">
                {paginatedLearners.map((learner, idx) => {
                  const isReady = Boolean(learner.isComplete);
                  const availableSubjects = learner.publishedSubjectCount || 0;

                  return (
                    <tr
                      key={learner.id || idx}
                      className="hover:bg-slate-50/70 transition dark:hover:bg-white/[0.02]"
                    >
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {startIndex + idx + 1}
                      </td>

                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatDepEdLearnerName(learner)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          LRN: {learner.lrn || learner.student_number || "—"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-center text-slate-600 dark:text-slate-300">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {availableSubjects}/{totalSubjects}
                        </span>{" "}
                        subjects available
                      </td>

                      <td className="py-2.5 px-3.5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                            isReady
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          )}
                        >
                          {isReady ? (
                            <CheckCircle2 size={11} className="shrink-0" />
                          ) : (
                            <Clock size={11} className="shrink-0" />
                          )}
                          <span>{isReady ? "Ready" : "Incomplete"}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Preview is ALWAYS enabled per user rule */}
                          <button
                            type="button"
                            onClick={() => onPreviewStudent(learner)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                          >
                            <Eye size={12} className="text-slate-400" />
                            <span>Preview</span>
                          </button>

                          {/* Download Final SF9 is enabled only when ready */}
                          {isReady && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleFinal(learner)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] transition"
                            >
                              <Download size={12} />
                              <span>Download Final SF9</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 10-Row Pagination */}
        <AdvisoryTablePagination
          currentPage={currentPage}
          totalRecords={filteredLearners.length}
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
