"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2, X } from "lucide-react";
import { importEClassRecord } from "@/lib/eclass/importEClassRecord";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import {
  ACCEPTED_EXTENSIONS,
  validateEClassFile,
} from "@/lib/eclass/validateEClassFile";
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
  }

  function handleClose() {
    if (uploading) return;
    resetState();
    onClose?.();
  }

  async function handleSelected(selected) {
    const validation = validateEClassFile(selected);
    if (!validation.ok) {
      setError(validation.error);
      setFile(null);
      setPreviewMeta(null);
      return;
    }

    setError("");
    setFile(selected);
    setPreviewMeta(null);
    setWorkbookBuffer(null);
    setPreviewing(true);
    setStatusLabel("Opening workbook...");

    try {
      const buffer = await selected.arrayBuffer();
      setWorkbookBuffer(buffer);
      const parsed = await parseEClassRecord(selected, {
        assignedClass: classItem,
        teacherName: classItem.teacher,
        includeGrades: false,
        arrayBuffer: buffer,
        onProgress: ({ label }) => {
          setStatusLabel(label || "Reading INPUT DATA...");
        },
      });

      if (!parsed.ok) {
        setPreviewMeta(parsed.metadata);
        setError(parsed.error || "E-Class Record validation failed.");
        return;
      }

      setPreviewMeta(parsed.metadata);
      setError("");
      setStatusLabel("");
    } catch (err) {
      setError(err?.message ?? "Unable to read the E-Class Record metadata.");
      setPreviewMeta(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file || error) return;
    setUploading(true);
    setError("");
    setProgress(10);
    setStatusLabel("Preparing assigned classes...");

    try {
      const result = await importEClassRecord({
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
        file,
        arrayBuffer: workbookBuffer,
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
      setError(err?.message ?? "Failed to import E-Class Record.");
      setUploading(false);
    }
  }

  const canImport = Boolean(file) && !uploading && !previewing && !error;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
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
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-lg border border-slate-100 bg-white shadow-2xl sm:rounded-lg"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2
              id="eclass-upload-title"
              className="text-base font-semibold text-slate-900"
            >
              Upload E-Class Record
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Official DepEd Excel (.xlsx) · Students &amp; grades from AVE ·
              Class info from INPUT DATA · Dummy student numbers for display
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

        <div className="max-h-[75vh] space-y-3 overflow-y-auto px-3 py-3">
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

          <button
            type="button"
            disabled={uploading}
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
              "flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 transition-colors disabled:cursor-not-allowed",
              dragging
                ? "border-cnhs-green-dark bg-green-50/60"
                : "border-slate-200 bg-slate-50/40 hover:border-cnhs-green-dark/40"
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-cnhs-green-dark shadow-sm">
              <CloudUpload size={22} />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-slate-700">
              Drag & drop your .xlsx file here or click to browse
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
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
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px]">
              <p className="font-semibold text-slate-800">{file.name}</p>
              <p className="mt-1 text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
                {previewing
                  ? ` · ${statusLabel || "Reading INPUT DATA..."}`
                  : ""}
              </p>
            </div>
          ) : null}

          {previewMeta ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Detected from INPUT DATA
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <MetaItem label="Teacher" value={previewMeta.teacher_name} />
                <MetaItem label="Subject" value={previewMeta.subject} />
                <MetaItem label="Grade Level" value={previewMeta.grade_level} />
                <MetaItem label="Section" value={previewMeta.section} />
                <MetaItem
                  label="School Year"
                  value={previewMeta.school_year}
                  className="col-span-2"
                />
              </div>
            </div>
          ) : null}

          {uploading ? (
            <div>
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>{statusLabel || "Uploading..."}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cnhs-green-dark transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
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
            disabled={uploading}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : null}
            {uploading ? "Importing..." : "Import Learners"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, className }) {
  return (
    <div className={className}>
      <p className="text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}
