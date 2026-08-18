"use client";

import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { importEClassRecord } from "@/lib/eclass/importEClassRecord";

function SummaryItem({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

export default function InputGradesPreviewStep({
  file,
  arrayBuffer,
  fileMeta,
  metadata,
  learnerCount = 0,
  selectedClass,
  teacherId,
  onBack,
  onSuccess,
}) {
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleImport() {
    if (!selectedClass || !file) return;
    setUploading(true);
    setError("");
    setProgress(10);
    setStatusLabel("Preparing assigned classes...");

    try {
      const result = await importEClassRecord({
        classItem: {
          id: selectedClass.id,
          subject: selectedClass.subject,
          subjectId: selectedClass.subjectId,
          grade: selectedClass.grade,
          section: selectedClass.section,
          gradeSection: selectedClass.gradeSection,
          schoolYear: selectedClass.schoolYear,
          sectionId: selectedClass.sectionId,
          teacherId: selectedClass.teacherId || teacherId,
          teacher: selectedClass.teacher,
          quarter: selectedClass.quarter,
          currentQuarter:
            selectedClass.currentQuarter || selectedClass.quarterLabel,
          quarterLabel: selectedClass.quarterLabel,
        },
        file,
        arrayBuffer,
        onProgress: ({ percent, label }) => {
          setProgress(Math.max(10, percent ?? 10));
          setStatusLabel(label || "Importing...");
        },
      });

      setProgress(100);
      setStatusLabel("Import complete.");
      onSuccess?.(result);
    } catch (err) {
      setError(err?.message ?? "Failed to import E-Class Record.");
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
        <h2 className="text-sm font-semibold text-slate-900">
          Preview & Import
        </h2>
        <p className="mt-1 text-[11px] text-slate-400">
          Confirm the details below, then import learners and grades into the
          selected class.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryItem label="File" value={fileMeta?.name} />
          <SummaryItem
            label="Learners detected"
            value={String(learnerCount)}
          />
          <SummaryItem
            label="Assigned class"
            value={selectedClass?.gradeSection}
          />
          <SummaryItem label="Subject" value={selectedClass?.subject} />
          <SummaryItem
            label="Term"
            value={
              selectedClass?.quarterLabel || selectedClass?.currentQuarter
            }
          />
          <SummaryItem label="School year" value={selectedClass?.schoolYear} />
          <SummaryItem
            label="ECR grade / section"
            value={`${metadata?.grade_level || "—"} · ${metadata?.section || "—"}`}
          />
          <SummaryItem label="ECR subject" value={metadata?.subject} />
        </div>
      </section>

      {uploading ? (
        <div className="rounded-xl border border-slate-100 bg-white p-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
            <span>{statusLabel || "Importing..."}</span>
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={uploading}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={13} />
          Back
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!selectedClass || !file || uploading}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : null}
          {uploading ? "Importing..." : "Import Learners"}
        </button>
      </div>
    </div>
  );
}
