"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import InputGradesStepper from "@/components/teacher/input-grades/InputGradesStepper";

export default function InputGradesShell({
  currentStep,
  selectedClass,
  children,
  controls,
  subtitle = "Upload Official DepEd E-Class Records for your assigned classes.",
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
            <span className="font-semibold text-slate-600">Input Grades</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
            Input Grades
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[12px] text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        {controls}
      </header>

      {currentStep ? (
        <div className="mb-4 rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <InputGradesStepper currentStep={currentStep} />
        </div>
      ) : null}

      {selectedClass?.id ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-100/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600">
          <BookOpen size={14} className="text-cnhs-green-dark" />
          Selected Class: {selectedClass.subject} · {selectedClass.gradeSection}{" "}
          · {selectedClass.quarterLabel || selectedClass.currentQuarter}
        </div>
      ) : null}

      {children}
    </div>
  );
}
