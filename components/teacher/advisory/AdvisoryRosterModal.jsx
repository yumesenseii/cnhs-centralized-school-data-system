"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  CloudUpload,
  FileSpreadsheet,
  Loader2,
  Users,
  X,
  AlertCircle,
  Search,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import AdvisoryTablePagination from "@/components/teacher/advisory/AdvisoryTablePagination";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import { importOfficialSectionRoster } from "@/lib/supabase/queries/advisoryRoster";
import { useAppToast } from "@/components/shared/AppToast";
import { formatDepEdLearnerName } from "@/lib/reports/sf9DataService";
import { cn } from "@/lib/utils";

export default function AdvisoryRosterModal({
  isOpen,
  onClose,
  section,
  learners = [],
  onSuccess,
  initialTab = "roster",
}) {
  // Mode: "view" (Current Class List) vs "upload" (Upload / Update Class List)
  const [mode, setMode] = useState("view");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [parsedLearners, setParsedLearners] = useState([]);
  const [showAllPreview, setShowAllPreview] = useState(false);

  const inputRef = useRef(null);
  const { showToast } = useAppToast();

  useEffect(() => {
    if (isOpen) {
      setMode(initialTab === "upload" ? "upload" : "view");
      setSearchQuery("");
      setCurrentPage(1);
      setError("");
      setFile(null);
      setParsedLearners([]);
      setShowAllPreview(false);
    }
  }, [isOpen, initialTab]);

  const maleCount = useMemo(
    () =>
      learners.filter((l) =>
        (l.sex || l.gender || "").toLowerCase().startsWith("m")
      ).length,
    [learners]
  );
  const femaleCount = useMemo(
    () =>
      learners.filter((l) =>
        (l.sex || l.gender || "").toLowerCase().startsWith("f")
      ).length,
    [learners]
  );

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

  const handleFileSelected = async (selected) => {
    if (!selected) return;
    setFile(selected);
    setError("");
    setParsing(true);
    setParsedLearners([]);

    try {
      const buffer = await selected.arrayBuffer();
      const parsed = await parseEClassRecord(selected, {
        arrayBuffer: buffer,
        includeGrades: false,
      });

      if (!parsed.ok && (!parsed.learners || parsed.learners.length === 0)) {
        throw new Error(
          parsed.error ||
            "Unable to read learners from this file. Ensure it is a valid DepEd Class List or E-Record (.xlsx)."
        );
      }

      setParsedLearners(parsed.learners || []);
    } catch (err) {
      setError(err?.message || "Failed to parse class list file.");
      setParsedLearners([]);
    } finally {
      setParsing(false);
    }
  };

  const handleSaveRoster = async () => {
    if (!parsedLearners.length || !section?.id) return;
    setSaving(true);
    setError("");

    try {
      const result = await importOfficialSectionRoster(
        section.id,
        parsedLearners
      );
      showToast(
        `Class list saved: ${result.totalRoster} learners established for Grade ${section.gradeLevel} — ${section.sectionName}.`
      );
      await onSuccess?.();
      setMode("view");
      setFile(null);
      setParsedLearners([]);
    } catch (err) {
      setError(err?.message || "Failed to save class list.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLearners = filteredLearners.slice(
    startIndex,
    startIndex + pageSize
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-list-modal-title"
    >
      <div className="flex flex-col w-full max-w-3xl max-h-[88vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-white/10 dark:bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-cnhs-green dark:bg-emerald-950/40 dark:text-emerald-300">
                <Users size={14} />
              </span>
              <h2
                id="class-list-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Class List Setup
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Grade {section?.gradeLevel} &mdash; {section?.sectionName}
              <span className="mx-1.5 text-slate-300">•</span>
              SY {section?.schoolYear || "2026-2027"}
              <span className="mx-1.5 text-slate-300">•</span>
              <span>{learners.length} Learners Enrolled</span>
              {learners.length > 0 ? (
                <span> ({maleCount} Male, {femaleCount} Female)</span>
              ) : null}
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

        {/* VIEW MODE: Current Class List */}
        {mode === "view" ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {learners.length === 0 ? (
              /* Empty state when no learners */
              <div className="p-8 sm:p-12 text-center my-auto">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Users size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Class List Yet
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  No learners have been added to this section yet. Upload the official class list to begin.
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setMode("upload")}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cnhs-green-dark px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1b5842] transition"
                  >
                    <CloudUpload size={14} />
                    <span>Upload Official Class List</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Toolbar */}
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
                      placeholder="Search by learner name or LRN..."
                      className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-cnhs-green focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                    />
                  </div>

                  {/* Secondary Action: Upload / Update Class List */}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("upload");
                      setError("");
                    }}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <CloudUpload size={13} className="text-cnhs-green" />
                    <span>Upload / Update Class List</span>
                  </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                  {paginatedLearners.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No matching learners found.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-100 dark:bg-white/[0.03] dark:border-white/5 dark:text-slate-300">
                        <tr>
                          <th className="py-2.5 px-3.5 w-10 text-center">#</th>
                          <th className="py-2.5 px-3.5">Learner</th>
                          <th className="py-2.5 px-3.5 font-mono">LRN</th>
                          <th className="py-2.5 px-3.5 text-center">Sex</th>
                          <th className="py-2.5 px-3.5">Active Support / Remedial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-white/5">
                        {paginatedLearners.map((learner, idx) => (
                          <tr
                            key={learner.id || idx}
                            className="hover:bg-slate-50/70 transition dark:hover:bg-white/[0.02]"
                          >
                            <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                              {startIndex + idx + 1}
                            </td>
                            <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-slate-100">
                              {formatDepEdLearnerName(learner)}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {learner.lrn || learner.student_number || learner.studentNumber || "—"}
                            </td>
                            <td className="py-2.5 px-3.5 text-center text-slate-600 dark:text-slate-300">
                              {learner.gender || learner.sex || "—"}
                            </td>
                            <td className="py-2.5 px-3.5">
                              {learner.activeRemedials && learner.activeRemedials.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {learner.activeRemedials.map((rem, rIdx) => (
                                    <span
                                      key={rem.id || rIdx}
                                      title={`${rem.subjectName} — Handled by ${rem.teacherName} (${rem.interventionGiven || "Classroom Remedial"})`}
                                      className="inline-flex items-center gap-1 rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                      <span>{rem.subjectName} Remedial</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-mono text-[11px]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
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
              </>
            )}
          </div>
        ) : (
          /* UPLOAD MODE: Upload / Update Class List */
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Top link to return back to current list */}
            {learners.length > 0 && (
              <button
                type="button"
                onClick={() => setMode("view")}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-cnhs-green hover:underline"
              >
                <ArrowLeft size={13} />
                <span>Back to Current Class List</span>
              </button>
            )}

            <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-100 text-xs text-slate-600 dark:bg-white/[0.02] dark:border-white/5 dark:text-slate-300">
              Upload the official DepEd class list or E-Record (.xlsx) to establish the advisory section class list.
            </div>

            {/* Upload Area */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || saving}
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 hover:border-cnhs-green hover:bg-green-50/20 transition-all disabled:cursor-not-allowed dark:border-white/20 dark:bg-white/[0.02] dark:hover:border-emerald-500"
            >
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-cnhs-green dark:bg-emerald-950/40 dark:text-emerald-300">
                <CloudUpload size={28} />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {file ? file.name : "Select or drag DepEd Class List or E-Record"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Click to choose a file from your computer
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                <FileSpreadsheet size={12} className="text-cnhs-green" />
                <span>Accepted file: .xlsx</span>
              </div>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />

            {parsing && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Loader2 size={15} className="animate-spin text-cnhs-green" />
                <span>Reading learners from class list...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Parsed Preview */}
            {parsedLearners.length > 0 && !parsing && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-white/10 dark:bg-[var(--card)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Found {parsedLearners.length} learners in file
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 size={11} />
                    <span>Ready to save</span>
                  </span>
                </div>

                <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-100 dark:border-white/5">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 dark:bg-white/[0.03]">
                      <tr>
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">LRN</th>
                        <th className="p-2">Full Name</th>
                        <th className="p-2 text-center">Sex</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-[11.5px]">
                      {(showAllPreview ? parsedLearners : parsedLearners.slice(0, 5)).map(
                        (l, i) => (
                          <tr key={i}>
                            <td className="p-2 text-slate-400 font-mono text-center">
                              {i + 1}
                            </td>
                            <td className="p-2 font-mono text-slate-700 dark:text-slate-300">
                              {l.student_number || "—"}
                            </td>
                            <td className="p-2 font-semibold text-slate-900 dark:text-slate-100">
                              {l.full_name}
                            </td>
                            <td className="p-2 text-center text-slate-600 dark:text-slate-300">
                              {l.gender || l.sex || "—"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {parsedLearners.length > 5 && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllPreview(!showAllPreview)}
                      className="cursor-pointer text-xs font-semibold text-cnhs-green hover:underline"
                    >
                      {showAllPreview
                        ? "Show first 5 only"
                        : `View all ${parsedLearners.length} learners`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-white/5 dark:bg-transparent">
          {mode === "upload" ? (
            <>
              {learners.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  Cancel
                </button>
              )}
              {parsedLearners.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveRoster}
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b5842] disabled:opacity-50 transition"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  <span>
                    {saving
                      ? "Saving Class List..."
                      : `Save Class List (${parsedLearners.length} Learners)`}
                  </span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
