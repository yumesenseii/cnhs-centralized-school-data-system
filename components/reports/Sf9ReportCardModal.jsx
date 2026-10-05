"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Download,
  Printer,
  FileText,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Check,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import {
  generateSf9PdfDocument,
  downloadSingleStudentSf9Pdf,
  downloadSectionBatchSf9Pdf,
} from "@/lib/reports/sf9PdfGenerator";
import {
  formatDepEdLearnerName,
  validateSf9ReleaseEligibility,
  formatStudentForSf9,
} from "@/lib/reports/sf9DataService";
import {
  getLearnerSf9Release,
  updateSf9Status,
  releaseSf9ReportCard,
} from "@/lib/supabase/queries/sf9Releases";
import AppSelect from "@/components/shared/AppSelect";

export default function Sf9ReportCardModal({
  isOpen,
  onClose,
  studentData = null,
  studentsList = [],
  section = null,
  sectionName = "",
  schoolYear = "2026-2027",
  onStatusChange = null,
}) {
  const [selectedStudent, setSelectedStudent] = useState(studentData);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generationError, setGenerationError] = useState("");
  const [releaseRecord, setReleaseRecord] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  const effectiveSectionName = section?.sectionName || sectionName || "Advisory Section";
  const effectiveSectionId = section?.id || studentData?.sectionId || studentData?.section_id;

  // Initialize selectedStudent when prop changes
  useEffect(() => {
    if (studentData) {
      setSelectedStudent(formatStudentForSf9(studentData));
    }
  }, [studentData]);

  // Load release record from DB when selected student changes
  useEffect(() => {
    let active = true;
    async function fetchRelease() {
      if (!selectedStudent?.studentId && !selectedStudent?.id) return;
      const sId = selectedStudent.studentId || selectedStudent.id;
      const { data } = await getLearnerSf9Release(sId, schoolYear);
      if (active) {
        setReleaseRecord(data || null);
      }
    }
    fetchRelease();
    return () => {
      active = false;
    };
  }, [selectedStudent, schoolYear]);

  // Generate PDF document
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
      const doc = generateSf9PdfDocument(selectedStudent, schoolYear);
      const blob = doc.output("blob");
      blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error("[Sf9Modal] Failed to generate PDF preview:", err);
      setGenerationError(err?.message || "Unable to generate SF9 preview.");
    } finally {
      setLoading(false);
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, selectedStudent, schoolYear]);

  // Evaluate release validation
  const validation = useMemo(() => {
    if (!selectedStudent) return { isEligible: false, missing: [] };
    return validateSf9ReleaseEligibility(selectedStudent, section || { id: effectiveSectionId });
  }, [selectedStudent, section, effectiveSectionId]);

  if (!isOpen || !selectedStudent) return null;

  const currentStatus = releaseRecord?.status || (validation.isEligible ? "ready_for_review" : "pending");
  const isReleased = currentStatus === "released";
  const isCompleted = currentStatus === "completed";

  const learnerDisplayName = formatDepEdLearnerName(selectedStudent);
  const hasMultipleStudents = studentsList && studentsList.length > 1;

  // Options for student switcher AppSelect
  const studentSelectOptions = (studentsList || []).map((s) => ({
    value: String(s.id || s.studentId),
    label: `${formatDepEdLearnerName(s)} (${s.lrn || s.studentNumber || "—"})`,
  }));

  const handleStudentChange = (val) => {
    const found = studentsList.find((s) => String(s.id || s.studentId) === val);
    if (found) {
      setSelectedStudent(formatStudentForSf9(found));
    }
  };

  const handleDownload = () => {
    downloadSingleStudentSf9Pdf(selectedStudent, schoolYear);
  };

  const handleBatchDownload = () => {
    downloadSectionBatchSf9Pdf(effectiveSectionName, studentsList, schoolYear);
  };

  const handlePrint = () => {
    const iframe = document.getElementById("sf9-pdf-preview-frame");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    } else {
      handleDownload();
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!validation.isEligible) return;
    setSavingStatus(true);
    setActionError("");
    try {
      const studentId = selectedStudent.studentId || selectedStudent.id;
      const { data, error } = await updateSf9Status({
        studentId,
        sectionId: effectiveSectionId,
        schoolYear,
        status: "completed",
        snapshotData: selectedStudent,
        validationSummary: validation,
      });
      if (error) throw error;
      setReleaseRecord(data);
      onStatusChange?.(studentId, "completed");
    } catch (err) {
      console.error("[Sf9Modal] Failed to mark completed:", err);
      setActionError(err.message || "Failed to update SF9 status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleConfirmRelease = async () => {
    setSavingStatus(true);
    setActionError("");
    try {
      const studentId = selectedStudent.studentId || selectedStudent.id;
      const { data, error } = await releaseSf9ReportCard({
        studentId,
        sectionId: effectiveSectionId,
        schoolYear,
        snapshotData: selectedStudent,
        validationSummary: validation,
      });
      if (error) throw error;
      setReleaseRecord(data);
      setConfirmReleaseOpen(false);
      onStatusChange?.(studentId, "released");
    } catch (err) {
      console.error("[Sf9Modal] Failed to release SF9:", err);
      setActionError(err.message || "Failed to release SF9 to Student Portal.");
    } finally {
      setSavingStatus(false);
    }
  };

  const getStatusBadge = () => {
    switch (currentStatus) {
      case "released":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Released to Student Portal</span>
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <ShieldCheck size={13} className="text-blue-600" />
            <span>Completed (Ready for Release)</span>
          </span>
        );
      case "ready_for_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
            <Check size={13} className="text-purple-600" />
            <span>Ready for Review</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle size={13} className="text-amber-600" />
            <span>Pending ({validation.missing.length} Missing)</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-cnhs-green/10 text-cnhs-green dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  DepEd School Form 9 (SF9 / Form 138)
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  MATATAG SY {schoolYear}
                </span>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Official Learner Progress Report &bull; {learnerDisplayName} &bull; LRN: {selectedStudent.lrn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Student Switcher AppSelect */}
            {hasMultipleStudents && (
              <div className="w-56">
                <AppSelect
                  size="pill"
                  value={String(selectedStudent.id || selectedStudent.studentId)}
                  onChange={handleStudentChange}
                  options={studentSelectOptions}
                  triggerClassName="h-8 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            )}

            {hasMultipleStudents && (
              <button
                type="button"
                onClick={handleBatchDownload}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                title="Download all learners in section into a single PDF"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Batch Section PDF ({studentsList.length})</span>
                <span className="md:hidden">Batch</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Print SF9"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 shadow-xs transition"
              title="Download Learner SF9 PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Validation Status Notice Banner */}
        <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs">
          {actionError && (
            <div className="mb-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
              {actionError}
            </div>
          )}

          {!validation.isEligible ? (
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-xs">
                  SF9 cannot be released yet. Incomplete official learning areas / grades:
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {validation.missing.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100/90 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : isReleased ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/60 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cnhs-green dark:text-emerald-400 shrink-0" />
                <span>
                  <strong>Officially Released.</strong> Available to learner in Student Portal. (Version {releaseRecord?.version || 1} &bull; Released on {new Date(releaseRecord?.released_at || Date.now()).toLocaleDateString()})
                </span>
              </div>
            </div>
          ) : isCompleted ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-900/60 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Completed & Reviewed.</strong> Ready for official publication to the Student Portal.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmReleaseOpen(true)}
                disabled={savingStatus}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-cnhs-green text-white hover:bg-[#115a3e] active:bg-[#0c432e] shadow-xs transition"
              >
                <Send size={12} />
                <span>Release SF9</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cnhs-green shrink-0" />
                <span>All required learning areas and records are verified. Inspect preview below before marking as completed.</span>
              </div>
              <button
                type="button"
                onClick={handleMarkAsCompleted}
                disabled={savingStatus}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition"
              >
                {savingStatus ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                <span>Mark as Completed</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body / PDF Preview Frame */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-3 sm:p-4 relative overflow-hidden flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-cnhs-green" />
              <p className="text-sm font-medium">Generating official DepEd SF9 document...</p>
            </div>
          ) : generationError ? (
            <div className="text-center p-6 max-w-md">
              <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Unable to generate SF9 preview</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{generationError}</p>
            </div>
          ) : pdfBlobUrl ? (
            <iframe
              id="sf9-pdf-preview-frame"
              src={pdfBlobUrl}
              className="w-full h-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white shadow-inner"
              title="SF9 PDF Preview"
            />
          ) : (
            <div className="text-center text-rose-500 text-sm font-medium">
              Failed to load PDF preview. Click Download PDF to save directly.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Format: Official DepEd MATATAG Duplex (Page 1: Academic Progress &bull; Page 2: Attendance & Certification)
          </div>
          <div className="flex items-center gap-2">
            {validation.isEligible && !isReleased && (
              <button
                type="button"
                onClick={() => setConfirmReleaseOpen(true)}
                disabled={savingStatus}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md bg-cnhs-green hover:bg-[#115a3e] active:bg-[#0c432e] text-white shadow-xs transition"
              >
                <Send size={12} />
                <span>Release to Student Portal</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Release Confirmation Dialog */}
      {confirmReleaseOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-cnhs-green dark:text-emerald-400 shrink-0">
                <Send size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Release SF9 for {learnerDisplayName}?
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Once released, this official report card will become available to the learner in the Student Portal.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Learner:</span>
                <span className="font-semibold">{learnerDisplayName}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">LRN:</span>
                <span className="font-mono">{selectedStudent.lrn}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Section:</span>
                <span>{effectiveSectionName} (SY {schoolYear})</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReleaseOpen(false)}
                disabled={savingStatus}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRelease}
                disabled={savingStatus}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-cnhs-green hover:bg-[#115a3e] active:bg-[#0c432e] text-white shadow-xs transition"
              >
                {savingStatus ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Releasing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Confirm & Release</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
