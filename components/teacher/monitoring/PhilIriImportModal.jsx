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

export default function PhilIriImportModal({
  isOpen,
  onClose,
  enrolledStudents = [],
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  // Authoritative ARAL period; baseline imports are BOSY-gated in the backend.
  aralPeriod = null,
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [records, setRecords] = useState([]);
  const fileInputRef = useRef(null);
  const { showToast } = useAppToast();
  const [validationFilter, setValidationFilter] = useState("all"); // 'all', 'matched', 'needs_verification', 'unmatched', 'duplicate'

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
      showToast("error", err.message || "Failed to parse Phil-IRI Excel file.");
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
      showToast("error", "No matched student records to import.");
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
        showToast("error", res.error.message || "Failed to save Phil-IRI records.");
        return;
      }

      showToast(
        "success",
        `Successfully imported Phil-IRI baseline for ${validRecords.length} student(s).`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("error", "Error saving Phil-IRI records.");
    } finally {
      setSaving(false);
    }
  };
  const matchedCount = records.filter((r) => r.validationStatus === "matched" || (r.isMatched && !r.isDuplicate)).length;
  const needsVerificationCount = records.filter((r) => r.validationStatus === "needs_verification").length;
  const unmatchedCount = records.filter((r) => r.validationStatus === "unmatched" || (!r.isMatched && !r.isDuplicate)).length;
  const duplicateCount = records.filter((r) => r.validationStatus === "duplicate" || r.isDuplicate).length;

  const filteredRecords = records.filter((r) => {
    if (validationFilter === "matched") return r.validationStatus === "matched" || (r.isMatched && !r.isDuplicate);
    if (validationFilter === "needs_verification") return r.validationStatus === "needs_verification";
    if (validationFilter === "unmatched") return r.validationStatus === "unmatched" || (!r.isMatched && !r.isDuplicate);
    if (validationFilter === "duplicate") return r.validationStatus === "duplicate" || r.isDuplicate;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Import Phil-IRI Excel Records
              </h2>
              <p className="text-[12px] text-slate-500">
                DepEd Phil-IRI Form 1B / Form 3 Group Screening Test Class Reading Record
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center transition-all hover:border-cnhs-green hover:bg-emerald-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition-transform group-hover:scale-110">
                <UploadCloud size={28} className="text-cnhs-green" />
              </div>
              <p className="mt-3 text-[14px] font-semibold text-slate-800">
                Click to browse or drop Phil-IRI file here
              </p>
              <p className="mt-1 text-[12px] text-slate-400">
                Supports DepEd Phil-IRI Form 1B & Form 3 (.xlsx, .xls)
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">
                Select Phil-IRI File
              </span>
            </div>
          ) : parsing ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 size={28} className="animate-spin text-cnhs-green" />
              <p className="mt-3 text-[13px] font-semibold text-slate-700">
                Reading and validating Phil-IRI scores…
              </p>
              <p className="text-[12px] text-slate-400">
                Matching student names with your active My Classes roster.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Validation Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setValidationFilter("all")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-medium transition-colors",
                      validationFilter === "all"
                        ? "bg-white font-semibold text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    All ({records.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationFilter("matched")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-medium transition-colors",
                      validationFilter === "matched"
                        ? "bg-white font-semibold text-emerald-800 shadow-xs"
                        : "text-emerald-700 hover:text-emerald-900"
                    )}
                  >
                    Matched ({matchedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationFilter("needs_verification")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-medium transition-colors",
                      validationFilter === "needs_verification"
                        ? "bg-white font-semibold text-amber-900 shadow-xs"
                        : "text-amber-700 hover:text-amber-900"
                    )}
                  >
                    Needs Verification ({needsVerificationCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationFilter("unmatched")}
                    className={cn(
                      "rounded-lg px-3 py-1 font-medium transition-colors",
                      validationFilter === "unmatched"
                        ? "bg-white font-semibold text-rose-800 shadow-xs"
                        : "text-rose-700 hover:text-rose-900"
                    )}
                  >
                    Unmatched ({unmatchedCount})
                  </button>
                  {duplicateCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setValidationFilter("duplicate")}
                      className={cn(
                        "rounded-lg px-3 py-1 font-medium transition-colors",
                        validationFilter === "duplicate"
                          ? "bg-white font-semibold text-purple-800 shadow-xs"
                          : "text-purple-700 hover:text-purple-900"
                      )}
                    >
                      Duplicate ({duplicateCount})
                    </button>
                  ) : null}
                </div>

                <p className="text-[11px] text-slate-500">
                  Review uncertain records before final import confirmation.
                </p>
              </div>

              {/* Parsed List Table */}
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm">
                      <tr>
                        <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          Learner
                        </th>
                        <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          GST Score (0–40)
                        </th>
                        <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          GST Screening Band
                        </th>
                        <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          Oral Reading Profile
                        </th>
                        <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                          Validation & Roster Match
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecords.map((r) => (
                        <tr key={r.tempId} className="hover:bg-slate-50/60">
                          <td className="px-3.5 py-2.5">
                            <p className="font-semibold text-slate-800">{r.studentName}</p>
                            <p className="text-[10px] text-slate-400">
                              {r.lrn ? `LRN: ${r.lrn}` : "No LRN"} · {r.gradeLevel} {r.section}
                            </p>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="font-bold text-slate-900">
                              {r.totalScore != null ? r.totalScore : "—"}
                            </span>
                            <span className="ml-1 text-[10px] text-slate-400">/ 40</span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="text-[11px] font-medium text-slate-700">
                              {r.gstBand || r.screeningInterpretation}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                r.readingLevel === "Frustration"
                                  ? "bg-red-50 text-red-700"
                                  : r.readingLevel === "Instructional"
                                  ? "bg-amber-50 text-amber-700"
                                  : r.readingLevel === "Independent"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {r.readingLevel}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            {r.isMatched && r.validationStatus === "matched" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                                <UserCheck size={13} />
                                {r.matchedStudent?.name || "Matched"}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {r.validationStatus === "needs_verification" ? (
                                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                    Verify:
                                  </span>
                                ) : null}
                                <select
                                  onChange={(e) => handleManualMatch(r.tempId, e.target.value)}
                                  value={r.studentId || ""}
                                  className="h-7 rounded-lg border border-amber-300 bg-amber-50/50 px-2 text-[11px] text-amber-900 outline-none max-w-[180px]"
                                >
                                  <option value="">
                                    {r.validationStatus === "needs_verification"
                                      ? "Confirm Match..."
                                      : "Select Student..."}
                                  </option>
                                  {enrolledStudents.map((s) => (
                                    <option key={s.id || `${s.studentId}-${s.classId || s.subject || ""}`} value={s.studentId || s.id}>
                                      {s.name} ({s.section})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setRecords([]);
                    setParseResult(null);
                  }}
                  className="text-[12px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  Choose another file
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {file && records.length > 0 ? (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={saving || matchedCount === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-[#246f54] disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Confirm Import ({matchedCount})
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
