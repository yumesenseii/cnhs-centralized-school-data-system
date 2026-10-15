"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  FileText,
  Upload,
  Eye,
  CheckCircle2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "cnhs_aral_assessment_files_store";

export default function AralAssessmentFilesModal({
  isOpen,
  onClose,
  schoolYear = "SY 2026-2027",
  onOpenUpload,
}) {
  const { showToast } = useAppToast();
  const fileInputRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [files, setFiles] = useState({
    groupScreening: null,
    individualAssessment: null,
    supportingFile: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${schoolYear}`);
      if (stored) {
        setFiles(JSON.parse(stored));
      }
    } catch {
      // Ignore parse error
    }
  }, [schoolYear]);

  const saveFiles = (updated) => {
    setFiles(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${STORAGE_KEY}_${schoolYear}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Storage quota exceeded:", e);
      }
    }
  };

  if (!isOpen) return null;

  const handleAttach = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeCategory) return;

    const fileMeta = {
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      date: new Date().toLocaleDateString(),
    };

    const next = { ...files, [activeCategory]: fileMeta };
    saveFiles(next);
    showToast("success", `Attached: ${file.name}`);
    e.target.value = "";
    setActiveCategory(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 pb-3.5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#246f54]/10 p-2 text-[#246f54]">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Assessment Files
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official reading assessment records for {schoolYear}
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

        {/* Hidden Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.pdf,.docx,.doc"
          onChange={handleAttach}
          className="hidden"
        />

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* 1. Group Screening Record */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Group Screening Record
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Baseline screening scores (GST Form 1B / Form 1A)
                </p>
              </div>
              {files.groupScreening ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 size={12} />
                  Attached
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">
                  Not Attached
                </span>
              )}
            </div>

            {files.groupScreening && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs border border-slate-100 dark:bg-slate-800/80 dark:border-white/5">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-[#246f54] shrink-0" />
                  <span className="font-semibold text-slate-800 truncate dark:text-slate-200">
                    {files.groupScreening.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({files.groupScreening.size})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("info", `Viewing ${files.groupScreening.name}`)}
                  className="rounded px-2 py-0.5 text-xs font-semibold text-[#246f54] hover:bg-[#246f54]/10"
                >
                  View
                </button>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("groupScreening");
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#246f54] hover:underline"
              >
                <Upload size={12} />
                <span>{files.groupScreening ? "Replace File" : "Attach File"}</span>
              </button>
            </div>
          </div>

          {/* 2. Individual Assessment */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Individual Assessment
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Oral reading profile & miscue analysis (Form 3)
                </p>
              </div>
              {files.individualAssessment ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 size={12} />
                  Attached
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">
                  Not required yet
                </span>
              )}
            </div>

            {files.individualAssessment && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs border border-slate-100 dark:bg-slate-800/80 dark:border-white/5">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-[#246f54] shrink-0" />
                  <span className="font-semibold text-slate-800 truncate dark:text-slate-200">
                    {files.individualAssessment.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({files.individualAssessment.size})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("info", `Viewing ${files.individualAssessment.name}`)}
                  className="rounded px-2 py-0.5 text-xs font-semibold text-[#246f54] hover:bg-[#246f54]/10"
                >
                  View
                </button>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("individualAssessment");
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#246f54] hover:underline"
              >
                <Upload size={12} />
                <span>{files.individualAssessment ? "Replace File" : "Attach File"}</span>
              </button>
            </div>
          </div>

          {/* 3. Other Supporting File */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Other Supporting File
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Referral slips, reading logs, or assessment notes
                </p>
              </div>
              {files.supportingFile ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 size={12} />
                  Attached
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">
                  Optional
                </span>
              )}
            </div>

            {files.supportingFile && (
              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs border border-slate-100 dark:bg-slate-800/80 dark:border-white/5">
                <div className="flex items-center gap-2 truncate">
                  <FileText size={14} className="text-[#246f54] shrink-0" />
                  <span className="font-semibold text-slate-800 truncate dark:text-slate-200">
                    {files.supportingFile.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({files.supportingFile.size})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast("info", `Viewing ${files.supportingFile.name}`)}
                  className="rounded px-2 py-0.5 text-xs font-semibold text-[#246f54] hover:bg-[#246f54]/10"
                >
                  View
                </button>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveCategory("supportingFile");
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#246f54] hover:underline"
              >
                <Upload size={12} />
                <span>{files.supportingFile ? "Replace File" : "Attach File"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Single Generic Action */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50 dark:border-white/5 dark:bg-slate-800/40">
          {onOpenUpload ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUpload();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition"
            >
              <Upload size={13} />
              <span>Upload Assessment File (Excel)</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
