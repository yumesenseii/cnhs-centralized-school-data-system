"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  X,
  FileText,
  Upload,
  Download,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

const PHIL_IRI_FORMS = [
  {
    code: "Form 1A",
    title: "Talaan ng Pangkatang Pagtatasa ng Klase",
    description: "Group Screening Test (GST) Class Summary & Record of Raw Scores in Filipino.",
    stage: "Group Screening",
    recommendedExt: ".xlsx, .pdf",
  },
  {
    code: "Form 1B",
    title: "Screening Test Class Reading Record",
    description: "Group Screening Test (GST) Class Reading Record with raw scores & interpretation in English.",
    stage: "Group Screening",
    recommendedExt: ".xlsx, .xls",
  },
  {
    code: "Form 2",
    title: "School Reading Profile",
    description: "Consolidated grade-level reading profile for pre-test and post-test assessment results.",
    stage: "School Profile",
    recommendedExt: ".xlsx, .pdf",
  },
  {
    code: "Form 3",
    title: "Learner's Record (Individual Reading Assessment)",
    description: "Detailed oral reading profile, miscues count, comprehension rating, and reading rate.",
    stage: "Individual Assessment",
    recommendedExt: ".pdf, .docx, .xlsx",
  },
  {
    code: "Form 4",
    title: "Individual Summary Record",
    description: "Comprehensive learner reading profile tracking baseline to post-intervention progress.",
    stage: "Progress Monitoring",
    recommendedExt: ".pdf, .xlsx",
  },
  {
    code: "Form 5",
    title: "School Summary Report on Learners' Reading Level",
    description: "Final school-wide summary report by reading level (Frustration, Instructional, Independent).",
    stage: "Reporting",
    recommendedExt: ".xlsx, .pdf",
  },
];

const STORAGE_KEY = "cnhs_phil_iri_documents_store";

export default function PhilIriDocumentsModal({
  isOpen,
  onClose,
  schoolYear = "SY 2026-2027",
}) {
  const [documents, setDocuments] = useState({});
  const [activeFormCode, setActiveFormCode] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const fileInputRef = useRef(null);
  const { showToast } = useAppToast();

  // Load persisted documents from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${schoolYear}`);
      if (stored) {
        setDocuments(JSON.parse(stored));
      }
    } catch {
      // Ignore parse error
    }
  }, [schoolYear]);

  // Persist documents on change
  const saveDocuments = (updated) => {
    setDocuments(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`${STORAGE_KEY}_${schoolYear}`, JSON.stringify(updated));
      } catch (e) {
        console.warn("Storage quota exceeded or unavailable:", e);
      }
    }
  };

  if (!isOpen) return null;

  const handleUploadClick = (formCode) => {
    setActiveFormCode(formCode);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeFormCode) return;

    const fileMeta = {
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type,
      uploadedAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      fileSizeRaw: file.size,
    };

    const updated = {
      ...documents,
      [activeFormCode]: fileMeta,
    };
    saveDocuments(updated);
    showToast("success", `Attached ${file.name} to DepEd ${activeFormCode}.`);
    setActiveFormCode(null);
  };

  const handleDownload = (form) => {
    const attached = documents[form.code];
    if (attached) {
      showToast("info", `Downloading official attached file: ${attached.name}`);
    } else {
      showToast("info", `No official file attached for ${form.code} yet. Use "Attach File" to upload.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.pdf,.docx,.doc"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-2.5 text-cnhs-green-dark">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Reading Assessment Records
                </h2>
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-cnhs-green-dark border border-green-200/60">
                  Phil-IRI Assessment Files
                </span>
              </div>
              <p className="text-[12px] text-slate-500">
                Phil-IRI assessment files and learner reading assessment results.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="border-b border-green-100/60 bg-green-50/50 px-6 py-2.5 text-[12px] text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-cnhs-green-dark shrink-0" />
            <span>
              <strong>Record Once, Reuse Everywhere:</strong> Attach official school documents here. Form 1B scores link directly with Academic & ARAL monitoring.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-cnhs-green-dark shrink-0">
            {schoolYear}
          </span>
        </div>

        {/* Official DepEd Forms Roster Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-[10.5px] text-slate-500">
                <tr>
                  <th className="px-4 py-3">DepEd Form & Title</th>
                  <th className="px-4 py-3">Assessment Stage</th>
                  <th className="px-4 py-3">Attached Official File</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PHIL_IRI_FORMS.map((form) => {
                  const attached = documents[form.code];

                  return (
                    <tr
                      key={form.code}
                      className={cn(
                        "hover:bg-slate-50/60 transition-colors",
                        attached ? "bg-green-50/30" : ""
                      )}
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10.5px] font-bold text-white tracking-wide shrink-0 shadow-xs">
                            {form.code}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {form.title}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                          {form.description}
                        </p>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200/60">
                          {form.stage}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {attached ? (
                          <div className="flex items-center gap-1.5">
                            <FileText size={13} className="text-cnhs-green-dark shrink-0" />
                            <div>
                              <span className="font-bold text-slate-800 block text-[11px]">
                                {attached.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {attached.size} · Attached {attached.uploadedAt}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">
                            No file attached
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {attached && (
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ ...form, ...attached })}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleUploadClick(form.code)}
                            className="inline-flex items-center gap-1 rounded-lg bg-cnhs-green-dark px-3 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-[#246f54] transition-colors cursor-pointer"
                          >
                            <Upload size={12} />
                            <span>{attached ? "Re-attach" : "Attach File"}</span>
                          </button>

                          {attached && (
                            <button
                              type="button"
                              onClick={() => handleDownload(form)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              <Download size={12} />
                              <span>Download</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-3.5">
          <p className="text-[11px] text-slate-500">
            Compliant with DepEd Order on Philippine Informal Reading Inventory (Phil-IRI) standards.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Quick View Modal */}
        {previewDoc && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">
                    {previewDoc.code}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {previewDoc.name}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Form:</span>
                  <span className="font-semibold text-slate-800">{previewDoc.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">File Size:</span>
                  <span className="font-semibold text-slate-800">{previewDoc.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date Attached:</span>
                  <span className="font-semibold text-slate-800">{previewDoc.uploadedAt}</span>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleDownload(previewDoc);
                    setPreviewDoc(null);
                  }}
                  className="rounded-xl bg-cnhs-green-dark px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#246f54]"
                >
                  Download File
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
