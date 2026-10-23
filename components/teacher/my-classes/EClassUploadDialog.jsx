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
import EClassMismatchAlert from "@/components/teacher/common/EClassMismatchAlert";
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

  // Validation step state: 'term' | 'upload' | 'validation'
  const [step, setStep] = useState("term");
  const [validationResult, setValidationResult] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);

  if (!open || !classItem) return null;

  function resetState() {
    setFile(null);
    setError("");
    setValidationError(null);
    setProgress(0);
    setStatusLabel("");
    setUploading(false);
    setPreviewMeta(null);
    setPreviewing(false);
    setWorkbookBuffer(null);
    setStep("term");
    setValidationResult(null);
    setSelectedTerm(null);
  }

  function handleClose() {
    if (uploading) return;
    resetState();
    onClose?.();
  }

  function handleChooseTerm(term) {
    setSelectedTerm(term);
    setStep("upload");
  }

  async function handleSelected(selected) {
    if (!selectedTerm) {
      setError("Please choose the grading term first.");
      return;
    }
    const fileCheck = validateEClassFile(selected);
    if (!fileCheck.ok) {
      setError(fileCheck.error);
      setValidationError(null);
      setFile(null);
      setPreviewMeta(null);
      return;
    }

    setError("");
    setValidationError(null);
    setFile(selected);
    setPreviewMeta(null);
    setWorkbookBuffer(null);
    setPreviewing(true);
    setStatusLabel("Reading class records…");

    try {
      const buffer = await selected.arrayBuffer();
      setWorkbookBuffer(buffer);
      const parsed = await parseEClassRecord(selected, {
        assignedClass: { ...classItem, quarter: selectedTerm },
        quarter: selectedTerm,
        teacherName: classItem.teacher,
        includeGrades: true,
        arrayBuffer: buffer,
        onProgress: ({ label }) => {
          setStatusLabel(label || "Reading class details…");
        },
      });

      if (!parsed.ok) {
        setPreviewMeta(parsed.metadata);
        setError(parsed.error || "Hindi po tugma ang napiling file sa klase na ito.");
        setValidationError(parsed.validation || null);
        return;
      }

      setPreviewMeta(parsed.metadata);
      setStatusLabel("Validating against official section roster…");

      // Automated Centralized Validation — scoped to the selected term.
      const valResult = await validateEClassRoster({
        learners: parsed.learners ?? [],
        classItem: { ...classItem, quarter: selectedTerm, targetTerm: selectedTerm },
        quarter: selectedTerm,
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
    if (!selectedTerm) {
      setError("Please choose the grading term first.");
      return;
    }
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
          targetTerm: selectedTerm,
          currentQuarter: selectedTerm,
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
        ) : step === "term" ? (
          <div>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h2
                  id="eclass-upload-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Import E-Class Record
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Choose the grading term this file belongs to.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              <div className="rounded-xl bg-slate-50 p-3 text-[11px]">
                <p className="font-semibold text-slate-800">
                  {classItem.gradeSection}
                </p>
                <p className="mt-0.5 text-slate-500">
                  {classItem.subject} · SY {classItem.schoolYear}
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold text-slate-600">
                  Grading Term
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 1, label: "Term 1" },
                    { id: 2, label: "Term 2" },
                    { id: 3, label: "Term 3" },
                  ].map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => handleChooseTerm(term.id)}
                      className="flex h-14 cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-cnhs-green hover:bg-green-50/50 transition-colors"
                    >
                      <span className="text-xs font-semibold">{term.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Quarter 4 (Final Grade / Average) is published from the E-Record
                  Summary after Terms 1–3 are published. Imports save to the ECR
                  draft first — you review before publishing.
                </p>
              </div>
            </div>
          </div>
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
                    Term {selectedTerm}
                    {classItem.quarter &&
                    Number(classItem.quarter) !== Number(selectedTerm)
                      ? ` (class page: Term ${classItem.quarter})`
                      : ""}
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
                <EClassMismatchAlert
                  error={error}
                  validation={validationError}
                  assignedClass={classItem}
                  uploadedMeta={previewMeta}
                  onClear={() => {
                    setError("");
                    setValidationError(null);
                    setFile(null);
                    setPreviewMeta(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                />
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
