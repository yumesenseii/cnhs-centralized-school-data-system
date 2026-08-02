"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import ProgressStepper from "@/components/teacher/lesson-plans/ProgressStepper";

export default function UploadShell({
  breadcrumbLabel = "Upload",
  title = "Upload Lesson Plan",
  subtitle,
  currentStep,
  selectedClass,
  children,
  controls,
  showBackLink = true,
}) {
  return (
    <div className="pb-5">
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <Link href="/teacher/lesson-plans" className="hover:text-slate-600">
              Lesson Plans
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <span
              className={
                breadcrumbLabel === "Submitted"
                  ? "font-semibold text-cnhs-green-dark"
                  : "font-semibold text-slate-600"
              }
            >
              {breadcrumbLabel}
            </span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p> : null}
        </div>

        {controls}
      </header>

      {currentStep ? (
        <div className="mb-4 rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <ProgressStepper currentStep={currentStep} />
        </div>
      ) : null}

      {selectedClass?.id ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600">
          <BookOpen size={14} className="text-cnhs-green-dark" />
          Selected Class: {selectedClass.subject} · {selectedClass.gradeSection} ·{" "}
          {selectedClass.quarter}
        </div>
      ) : null}

      {showBackLink ? (
        <Link
          href="/teacher/lesson-plans"
          className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-700"
        >
          ← Back to Lesson Plans
        </Link>
      ) : null}

      {children}
    </div>
  );
}
