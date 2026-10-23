"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Download,
  Printer,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  AlertTriangle,
  Lock,
  FileSpreadsheet,
} from "lucide-react";
import {
  generateSf9PdfDocument,
  generateSf9SinglePageDocument,
  downloadSingleStudentSf9Pdf,
} from "@/lib/reports/sf9PdfGenerator";
import { downloadSingleStudentSf9Excel } from "@/lib/reports/sf9ExcelExporter";
import {
  formatDepEdLearnerName,
  validateSf9ReleaseEligibility,
  formatStudentForSf9,
} from "@/lib/reports/sf9DataService";
import AppSelect from "@/components/shared/AppSelect";
import { cn } from "@/lib/utils";

export default function Sf9ReportCardModal({
  isOpen,
  onClose,
  studentData = null,
  studentsList = [],
  subjectsList = [],
  section = null,
  sectionName = "",
  schoolYear = "2026-2027",
  onStatusChange = null,
}) {
  const [selectedStudent, setSelectedStudent] = useState(studentData);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generationError, setGenerationError] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const effectiveSectionName =
    section?.sectionName || sectionName || "Advisory Section";
  const effectiveSectionId =
    section?.id || studentData?.sectionId || studentData?.section_id;

  // Clean school year to prevent duplicate "SY SY" prefix
  const cleanSy = String(schoolYear || "").replace(/^SY\s*/i, "").trim() || "2026-2027";
  const displaySchoolYear = `SY ${cleanSy}`;

  // Initialize selectedStudent when prop changes
  useEffect(() => {
    if (studentData) {
      setSelectedStudent(formatStudentForSf9(studentData));
      setCurrentPage(1);
      setZoom(100);
    }
  }, [studentData, isOpen]);

  // Evaluate release validation as single source of truth
  const validation = useMemo(() => {
    if (!selectedStudent) return { isEligible: false, missing: [] };
    return validateSf9ReleaseEligibility(
      selectedStudent,
      section || { id: effectiveSectionId }
    );
  }, [selectedStudent, section, effectiveSectionId]);

  // Generate single page PDF document for preview
  useEffect(() => {
    if (!isOpen || !selectedStudent) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    setLoading(true);
    setGenerationError("");
    let blobUrl = null;

    try {
      const doc = generateSf9SinglePageDocument(
        selectedStudent,
        cleanSy,
        currentPage
      );
      const blob = doc.output("blob");
      blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error("[Sf9Modal] Failed to generate SF9 preview:", err);
      setGenerationError(err?.message || "Unable to generate SF9 preview.");
    } finally {
      setLoading(false);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, selectedStudent, cleanSy, currentPage]);

  if (!isOpen || !selectedStudent) return null;

  // Polished learner display name
  const rawDepEdName = formatDepEdLearnerName(selectedStudent);
  const learnerDisplayName =
    selectedStudent.lastName && selectedStudent.firstName
      ? `${selectedStudent.lastName}, ${selectedStudent.firstName}${
          selectedStudent.middleName ? ` ${selectedStudent.middleName[0]}.` : ""
        }`
      : rawDepEdName;

  const gradeLevel = selectedStudent.gradeLevel || section?.gradeLevel || "7";
  const hasMultipleStudents = Array.isArray(studentsList) && studentsList.length > 1;

  const studentSelectOptions = (studentsList || []).map((s) => ({
    value: String(s.id || s.studentId),
    label: `${formatDepEdLearnerName(s)} (${s.lrn || s.studentNumber || "—"})`,
  }));

  const handleStudentChange = (val) => {
    const found = studentsList.find((s) => String(s.id || s.studentId) === val);
    if (found) {
      setSelectedStudent(formatStudentForSf9(found));
      setCurrentPage(1);
    }
  };

  const handleDownloadFinal = () => {
    if (!validation.isEligible) return;
    downloadSingleStudentSf9Pdf(selectedStudent, cleanSy);
    onStatusChange?.(selectedStudent.id || selectedStudent.studentId, "completed");
  };

  const handleExportExcel = async () => {
    if (!validation.isEligible) return;
    setIsExportingExcel(true);
    try {
      await downloadSingleStudentSf9Excel(selectedStudent, cleanSy);
    } catch (err) {
      console.error("[Sf9Modal] Excel export failed:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrint = () => {
    if (!validation.isEligible) return;
    try {
      const doc = generateSf9PdfDocument(selectedStudent, cleanSy);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = url;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 3000);
      };
    } catch (err) {
      console.error("[Sf9Modal] Print failed:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sf9-preview-title"
    >
      <div className="flex flex-col w-full max-w-5xl h-[94vh] bg-white dark:bg-[var(--card)] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        {/* POLISHED HEADER */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-white dark:border-white/5 dark:bg-transparent shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id="sf9-preview-title"
                className="text-sm font-bold text-slate-900 dark:text-white"
              >
                SF9 Report Card Preview
              </h2>
              <span className="text-slate-300 dark:text-white/20">&bull;</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                {learnerDisplayName}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Grade {gradeLevel} &ndash; {effectiveSectionName} &middot; {displaySchoolYear}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {hasMultipleStudents && (
              <div className="w-52 hidden md:block">
                <AppSelect
                  size="pill"
                  value={String(selectedStudent.id || selectedStudent.studentId)}
                  onChange={handleStudentChange}
                  options={studentSelectOptions}
                  triggerClassName="h-8 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SF9 DOCUMENT DESK CANVAS */}
        <div className="flex-1 bg-slate-100/80 p-4 relative overflow-auto flex flex-col items-center dark:bg-slate-950">
          {/* FLOATING NAVIGATION & ZOOM DOCK */}
          <div className="sticky top-0 z-10 mb-4 inline-flex items-center gap-3 rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-1.5 shadow-md backdrop-blur-xs dark:border-white/10 dark:bg-slate-900/95">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition dark:text-slate-200 dark:hover:bg-white/10"
              >
                <ChevronLeft size={13} />
                <span>Previous</span>
              </button>
              <span className="px-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                Page {currentPage} of 2
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(2)}
                disabled={currentPage === 2}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition dark:text-slate-200 dark:hover:bg-white/10"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(75, z - 10))}
                disabled={zoom <= 75}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Zoom out"
              >
                <Minus size={11} />
              </button>
              <span className="w-10 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(125, z + 10))}
                disabled={zoom >= 125}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Zoom in"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>

          {/* DOCUMENT SHEET */}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2.5 my-auto text-slate-500">
              <Loader2 size={24} className="animate-spin text-cnhs-green" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Loading SF9 document preview...
              </span>
            </div>
          ) : generationError ? (
            <div className="text-center p-6 my-auto max-w-sm">
              <AlertTriangle size={28} className="text-rose-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Unable to load SF9 preview
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {generationError}
              </p>
            </div>
          ) : pdfBlobUrl ? (
            <div
              style={{
                width: `${Math.round(595 * (zoom / 100))}px`,
                height: `${Math.round(842 * (zoom / 100))}px`,
                minHeight: "540px",
              }}
              className="bg-white rounded-xs shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200/90 overflow-hidden shrink-0 transition-all duration-150"
            >
              <iframe
                id="sf9-pdf-preview-frame"
                src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                className="w-full h-full border-0 bg-white"
                title="SF9 Report Card Preview"
              />
            </div>
          ) : null}
        </div>

        {/* POLISHED FOOTER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200/80 bg-slate-50/80 px-6 py-3 dark:border-white/5 dark:bg-transparent shrink-0">
          <div className="flex items-center gap-2">
            {!validation.isEligible ? (
              <>
                <Lock size={13} className="text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Available when all required grades are complete.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs text-emerald-700 font-semibold dark:text-emerald-400">
                  Report card is finalized and ready for release.
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Close
            </button>

            {validation.isEligible ? (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  title="Download filled official Report Card 2026-2027.xlsx"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 shadow-2xs transition dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {isExportingExcel ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={13} className="text-emerald-700 dark:text-emerald-400" />
                  )}
                  <span>Export Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadFinal}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b5842] transition"
                >
                  <Download size={13} />
                  <span>Download Final SF9 (PDF)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-400 opacity-60 dark:bg-white/10 dark:text-slate-500"
              >
                <Download size={13} />
                <span>Download Final SF9</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
