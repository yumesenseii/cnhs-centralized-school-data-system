"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import StatusBadge from "@/components/teacher/lesson-plans/StatusBadge";
import { useAppToast } from "@/components/shared/AppToast";

function SummaryItem({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd
        className="mt-1 break-all text-[12px] font-medium text-slate-700 dark:text-slate-200"
        title={value || undefined}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

export default function PreviewSubmission({
  selectedClass,
  information,
  file,
  onSubmit,
  onBack,
  onClearDraft,
  submitting = false,
  submitError = "",
}) {
  const router = useRouter();
  const { showToast } = useAppToast();
  const [localError, setLocalError] = useState("");

  async function handleSubmit() {
    setLocalError("");
    try {
      await onSubmit?.();
      onClearDraft?.();
      showToast("Lesson plan submitted for Head Teacher review.");
      router.replace("/teacher/lesson-plans");
    } catch (error) {
      setLocalError(error?.message ?? "Failed to submit lesson plan.");
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none sm:p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Lesson Information
            </h2>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Review all details before submitting to the Head Teacher.
            </p>
          </div>
          <StatusBadge status="Pending Review" />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryItem label="Teacher" value={selectedClass.teacherDisplay} />
          <SummaryItem label="Subject" value={selectedClass.subject} />
          <SummaryItem label="Grade" value={selectedClass.grade} />
          <SummaryItem label="Section" value={selectedClass.section} />
          <SummaryItem label="Quarter" value={selectedClass.quarter} />
          <SummaryItem label="School Year" value={selectedClass.schoolYear} />
          <SummaryItem label="Week Covered" value={information.weekCovered} />
          <SummaryItem label="Lesson Title" value={information.lessonTitle} />
          <SummaryItem
            label="Learning Competency"
            value={information.learningCompetency || "—"}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none sm:p-3.5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Uploaded File
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryItem label="Filename" value={file?.name} />
          <SummaryItem label="Extension" value={file?.extension?.toUpperCase()} />
          <SummaryItem
            label="File Size"
            value={
              file
                ? file.size >= 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                  : `${(file.size / 1024).toFixed(1)} KB`
                : "—"
            }
          />
        </dl>
      </section>

      {submitError || localError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] font-medium text-red-600 dark:border-red-500/30 dark:bg-red-950/40">
          {localError || submitError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onBack?.()}
          disabled={submitting}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {submitting ? "Submitting..." : "Submit to Head Teacher"}
        </button>
      </div>
    </div>
  );
}
