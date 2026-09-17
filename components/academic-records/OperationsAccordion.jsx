"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import AcademicPerformanceAnalysis from "@/components/academic-records/AcademicPerformanceAnalysis";
import RecentUploadActivity from "@/components/academic-records/RecentUploadActivity";
import TeacherSubmissionStatus from "@/components/academic-records/TeacherSubmissionStatus";
import ValidationSummary from "@/components/academic-records/ValidationSummary";

/**
 * Closed-by-default ops shell for uploads / validation / analysis.
 * Keeps learner browse as the primary viewport.
 */
export default function OperationsAccordion({
  recentUploadActivity = [],
  teacherSubmissions = [],
  submissionProgress,
  periodLabel,
  validationSummary = [],
  validationLastUpdated,
  academicAnalysis,
}) {
  const [open, setOpen] = useState(false);

  const pendingCount = useMemo(() => {
    const pending = validationSummary.find((item) =>
      /pending|no grade/i.test(String(item.label ?? ""))
    );
    return Number(pending?.value ?? 0);
  }, [validationSummary]);

  const uploadCount = recentUploadActivity.length;
  const submittedLabel = submissionProgress?.label ?? "—";

  const subtitle = [
    uploadCount
      ? `${uploadCount} recent upload${uploadCount === 1 ? "" : "s"}`
      : "No recent uploads",
    pendingCount > 0 ? `${pendingCount} pending validation` : null,
    submittedLabel !== "—" ? submittedLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 sm:px-5",
          open ? "border-b border-slate-100 bg-cnhs-green-soft/30" : "bg-slate-50/50"
        )}
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
          <ClipboardList size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">Operations</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {open
              ? "Uploads, teacher submissions, validation, and analysis"
              : subtitle}
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "mt-1 shrink-0 text-slate-400 transition-transform",
            open ? "rotate-180" : ""
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_256px]">
          <RecentUploadActivity activity={recentUploadActivity} />
          <aside className="space-y-3">
            <TeacherSubmissionStatus
              submissions={teacherSubmissions}
              progress={submissionProgress}
              periodLabel={periodLabel}
            />
            <ValidationSummary
              summary={validationSummary}
              lastValidated={validationLastUpdated}
            />
            <AcademicPerformanceAnalysis analysis={academicAnalysis} />
          </aside>
        </div>
      ) : null}
    </section>
  );
}
