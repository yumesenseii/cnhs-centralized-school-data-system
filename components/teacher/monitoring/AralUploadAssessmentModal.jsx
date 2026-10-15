"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  UserCheck,
} from "lucide-react";
import { parsePhilIriExcel } from "@/lib/monitoring/philIriImport";
import { savePhilIriBaselineRecords } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AralUploadAssessmentModal({
  isOpen,
  onClose,
  enrolledStudents = [],
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  aralPeriod = "BOSY",
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [records, setRecords] = useState([]);
  const fileInputRef = useRef(null);
  const { showToast } = useAppToast();

  if (!isOpen) return null;

  const handleFileSelect = async (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setParsing(true);
    try {
      const result = await parsePhilIriExcel(selected, enrolledStudents);
      setParseResult(result.summary);
      setRecords(result.records);
    } catch (err) {
      console.error(err);
      showToast("error", "Unable to read the assessment file. Please ensure it is a valid Excel spreadsheet.");
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleManualMatch = (tempId, studentId) => {
    const matched = enrolledStudents.find((s) => s.studentId === studentId || s.id === studentId);
    setRecords((prev) =>
      prev.map((r) => {
        if (r.tempId === tempId) {
          return {
            ...r,
            isMatched: Boolean(matched),
            studentId: matched?.studentId || matched?.id || null,
            classId: matched?.classId || null,
            matchedStudent: matched || null,
            matchType: "manual",
          };
        }
        return r;
      })
    );
  };

  const handleConfirmImport = async () => {
    const validRecords = records.filter((r) => r.isMatched && r.studentId);
    if (!validRecords.length) {
      showToast("error", "No matched learner records to import.");
      return;
    }

    setSaving(true);
    try {
      const res = await savePhilIriBaselineRecords({
        records: validRecords,
        teacherId,
        schoolYear,
        quarter,
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to save assessment records.");
        return;
      }

      showToast("success", `Assessment records imported for ${validRecords.length} learner(s).`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("error", "Error saving assessment records.");
    } finally {
      setSaving(false);
    }
  };

  const matchedCount = records.filter((r) => r.isMatched).length;
  const issueRecords = records.filter((r) => !r.isMatched);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 pb-4 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#246f54]/10 p-2 text-[#246f54]">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Assessment File
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload official Phil-IRI Excel records for your assigned learners
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!file ? (
            /* Upload drop area */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center cursor-pointer hover:border-[#246f54] hover:bg-[#246f54]/5 transition dark:border-white/10 dark:bg-white/[0.02]"
            >
              <div className="rounded-2xl bg-white p-3 shadow-2xs text-[#246f54] dark:bg-slate-800">
                <UploadCloud size={24} />
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
                Select Assessment File
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-xs dark:text-slate-400">
                Choose an official Phil-IRI Excel file (.xlsx, .xls) containing screening scores.
              </p>
              <button
                type="button"
                className="mt-4 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition"
              >
                Select Assessment File
              </button>
            </div>
          ) : parsing ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 size={24} className="animate-spin text-[#246f54]" />
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Validating assessment records...
              </p>
            </div>
          ) : (
            /* Parsed Summary & Issues */
            <div className="space-y-4">
              {/* File Info & Status */}
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                <div className="flex items-center gap-2 truncate">
                  <FileSpreadsheet size={16} className="text-[#246f54] shrink-0" />
                  <span className="font-bold text-xs text-slate-900 truncate dark:text-white">
                    {file.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setRecords([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 underline shrink-0"
                >
                  Change File
                </button>
              </div>

              {/* Status Banner */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Ready to Import
                  </span>
                  <p className="mt-0.5 text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    {matchedCount} learners
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Needs Verification
                  </span>
                  <p className="mt-0.5 text-lg font-bold text-slate-800 dark:text-slate-200">
                    {issueRecords.length} learners
                  </p>
                </div>
              </div>

              {/* Only show issue learners if any */}
              {issueRecords.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Learners Requiring Match
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {issueRecords.map((rec) => (
                      <div
                        key={rec.tempId}
                        className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-amber-50/40 p-2.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {rec.rawName || "Unnamed"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Score: {rec.totalScore}/40 · {rec.readingLevel}
                          </p>
                        </div>
                        <select
                          onChange={(e) => handleManualMatch(rec.tempId, e.target.value)}
                          className="h-7 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:border-white/10 dark:text-slate-200"
                        >
                          <option value="">Select matching student...</option>
                          {enrolledStudents.map((s) => (
                            <option key={s.studentId || s.id} value={s.studentId || s.id}>
                              {s.name} ({s.grade} - {s.section})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50 dark:border-white/5 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            Cancel
          </button>

          {file && !parsing && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={saving || matchedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Import ({matchedCount} Learners)</span>
                  <CheckCircle2 size={13} />
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
