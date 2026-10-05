"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2, X, ArrowRight } from "lucide-react";
import { importConfirmedEClassGrades } from "@/lib/eclass/importConfirmedEClassGrades";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import { validateEClassRoster } from "@/lib/eclass/validateEClassRoster";
import {
  ACCEPTED_EXTENSIONS,
  validateEClassFile,
} from "@/lib/eclass/validateEClassFile";
import EClassValidationWorkspace from "@/components/teacher/my-classes/EClassValidationWorkspace";
import { cn } from "@/lib/utils";

export default function EClassUploadDialog({
  open,
  onClose,
  classItem,
  teacherId,
  onSuccess,
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [workbookBuffer, setWorkbookBuffer] = useState(null);

  // Validation step state: 'upload' | 'validation'
  const [step, setStep] = useState("upload");
  const [validationResult, setValidationResult] = useState(null);

  if (!open || !classItem) return null;

  function resetState() {
    setFile(null);
    setError("");
    setProgress(0);
    setStatusLabel("");
    setUploading(false);
    setPreviewMeta(null);
    setPreviewing(false);
    setWorkbookBuffer(null);
    setStep("upload");
    setValidationResult(null);
  }

  function handleClose() {
    if (uploading) return;
    resetState();
    onClose?.();
  }

  async function handleSelected(selected) {
    const fileCheck = validateEClassFile(selected);
    if (!fileCheck.ok) {
      setError(fileCheck.error);
      setFile(null);
      setPreviewMeta(null);
      return;
    }

    setError("");
    setFile(selected);
    setPreviewMeta(null);
    setWorkbookBuffer(null);
    setPreviewing(true);
    setStatusLabel("Reading class records…");

    try {
      const buffer = await selected.arrayBuffer();
      setWorkbookBuffer(buffer);
      const parsed = await parseEClassRecord(selected, {
        assignedClass: classItem,
        teacherName: classItem.teacher,
        includeGrades: true,
        arrayBuffer: buffer,
        onProgress: ({ label }) => {
          setStatusLabel(label || "Reading class details…");
        },
      });

      if (!parsed.ok) {
        setPreviewMeta(parsed.metadata);
        setError(parsed.error || "This file doesn’t match the class you selected.");
        return;
      }

      setPreviewMeta(parsed.metadata);
      setStatusLabel("Validating against official section roster…");

      // Automated Centralized Validation
      const valResult = await validateEClassRoster({
        learners: parsed.learners ?? [],
        classItem,
      });

      setValidationResult(valResult);
      setError("");
      setStatusLabel("");
      setStep("validation"); // Seamlessly transition to Validation Workspace
    } catch (err) {
      setError(err?.message ?? "We couldn’t read or validate this E-Class Record.");
      setPreviewMeta(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirmImport(confirmedLearners) {
    if (!confirmedLearners?.length) return;
    setUploading(true);
    setError("");
    setProgress(10);
    setStatusLabel("Linking learners & saving grades…");

    try {
      const result = await importConfirmedEClassGrades({
        classItem: {
          id: classItem.id,
          subject: classItem.subject,
          subjectId: classItem.subjectId,
          grade: classItem.grade,
          section: classItem.section,
          gradeSection: classItem.gradeSection,
          schoolYear: classItem.schoolYear,
          sectionId: classItem.sectionId,
          teacherId: classItem.teacherId || teacherId,
          teacher: classItem.teacher,
          quarter: classItem.quarter,
          currentQuarter: classItem.currentQuarter || classItem.quarterLabel,
          quarterLabel: classItem.quarterLabel,
        },
        validatedLearners: confirmedLearners,
        onProgress: ({ percent, label }) => {
          setProgress(Math.max(10, percent ?? 10));
          setStatusLabel(label);
        },
      });

      setProgress(100);
      setStatusLabel("Import complete.");
      await onSuccess?.(result);
      resetState();
      onClose?.();
    } catch (err) {
      setError(err?.message ?? "We couldn’t import this E-Class Record.");
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close upload dialog"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="eclass-upload-title"
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl transition-all duration-200",
          step === "validation" ? "max-w-4xl" : "max-w-lg"
        )}
      >
        {step === "validation" && validationResult ? (
          <EClassValidationWorkspace
            validationResult={validationResult}
            classItem={classItem}
            onConfirmImport={handleConfirmImport}
            onBack={() => {
              setStep("upload");
              setValidationResult(null);
            }}
            importing={uploading}
          />
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2
                  id="eclass-upload-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Upload E-Class Record
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Official DepEd Excel (.xlsx). Roster and grades will be validated against the centralized section roster.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[75vh] space-y-3 overflow-y-auto px-4 py-3">
              {/* Class Target Metadata */}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-[11px]">
                <div>
                  <p className="text-slate-400">Assigned Class</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {classItem.gradeSection}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Subject</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {classItem.subject}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">School Year</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {classItem.schoolYear}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Term</p>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {classItem.quarterLabel || classItem.currentQuarter}
                  </p>
                </div>
              </div>

              {/* Drag & Drop Area */}
              <button
                type="button"
                disabled={uploading || previewing}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleSelected(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors disabled:cursor-not-allowed",
                  dragging
                    ? "border-cnhs-green bg-green-50/60"
                    : "border-slate-200 bg-slate-50/40 hover:border-cnhs-green/40"
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-cnhs-green shadow-xs">
                  <CloudUpload size={20} />
                </span>
                <p className="mt-2.5 text-xs font-semibold text-slate-700">
                  Drag & drop your .xlsx file here or click to browse
                </p>
                <p className="mt-0.5 text-[10.5px] text-slate-400">
                  Accepted: {ACCEPTED_EXTENSIONS.join(", ")}
                </p>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => handleSelected(e.target.files?.[0])}
              />

              {file ? (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <p className="font-semibold text-slate-800">{file.name}</p>
                  <p className="mt-0.5 text-slate-500 text-[11px]">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                    {previewing
                      ? ` · ${statusLabel || "Reading class details…"}`
                      : ""}
                  </p>
                </div>
              ) : null}

              {previewing ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-600">
                  <Loader2 size={15} className="animate-spin text-cnhs-green" />
                  <span>{statusLabel || "Processing spreadsheet..."}</span>
                </div>
              ) : null}

              {error ? (
                <div className="whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-red-600">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={uploading || previewing}
                className="inline-flex h-8.5 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
