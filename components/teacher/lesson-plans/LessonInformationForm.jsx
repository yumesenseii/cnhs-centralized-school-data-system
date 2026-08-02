"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { lessonPlansData } from "@/data/teacher/lessonPlans";
import { cn } from "@/lib/utils";

function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p> : null}
    </label>
  );
}

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none transition-colors focus:border-cnhs-green";
const readonlyClass =
  "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-600";

export default function LessonInformationForm({
  selectedClass,
  classes = [],
  information,
  onChange,
  onClassChange,
  onContinue,
  loadingClasses = false,
  classError = "",
}) {
  const [errors, setErrors] = useState({});

  function validate() {
    const next = {};
    if (!selectedClass?.id) next.classId = "Assigned class is required.";
    if (!information.weekCovered.trim()) next.weekCovered = "Week covered is required.";
    if (!information.lessonTitle.trim()) next.lessonTitle = "Lesson title is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleContinue(e) {
    e.preventDefault();
    if (!validate()) return;
    onContinue?.();
  }

  return (
    <form
      onSubmit={handleContinue}
      className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Lesson Information</h2>
        <p className="mt-1 text-[11px] text-slate-400">
          Fields with * are required. Class details come from your assignment.
          Objectives, strategies, and modality stay in the uploaded lesson plan
          file.
        </p>
      </div>

      <div className="mb-4">
        <Field label="Assigned Class" required error={errors.classId || classError}>
          <select
            value={selectedClass?.id || ""}
            onChange={(e) => {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.classId;
                return next;
              });
              onClassChange?.(e.target.value);
            }}
            disabled={loadingClasses || classes.length === 0}
            className={cn(
              inputClass,
              classes.length > 0 ? "cursor-pointer" : "cursor-not-allowed bg-slate-50",
              (errors.classId || classError) && "border-red-300"
            )}
          >
            <option value="">
              {loadingClasses
                ? "Loading classes..."
                : classes.length === 0
                  ? "No assigned classes available"
                  : "Select assigned class"}
            </option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subject} · {item.gradeSection} ·{" "}
                {item.quarterLabel || item.currentQuarter}
              </option>
            ))}
          </select>
        </Field>
        {!loadingClasses && classes.length === 0 && !classError ? (
          <p className="mt-1 text-[11px] font-medium text-amber-600">
            No classes are assigned to your account yet.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Learning Area">
          <input
            readOnly
            value={selectedClass?.subject || "—"}
            className={readonlyClass}
          />
        </Field>
        <Field label="Grade Level">
          <input
            readOnly
            value={selectedClass?.grade || "—"}
            className={readonlyClass}
          />
        </Field>
        <Field label="Section">
          <input
            readOnly
            value={selectedClass?.section || "—"}
            className={readonlyClass}
          />
        </Field>
        <Field label="Quarter">
          <input
            readOnly
            value={selectedClass?.quarter || "—"}
            className={readonlyClass}
          />
        </Field>
        <Field label="School Year">
          <input
            readOnly
            value={selectedClass?.schoolYear || "—"}
            className={readonlyClass}
          />
        </Field>
        <Field label="Teacher">
          <input
            readOnly
            value={selectedClass?.teacherDisplay || "—"}
            className={readonlyClass}
          />
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Week Covered" required error={errors.weekCovered}>
          <select
            value={information.weekCovered}
            onChange={(e) => onChange({ weekCovered: e.target.value })}
            className={cn(inputClass, "cursor-pointer", errors.weekCovered && "border-red-300")}
          >
            <option value="">Select week</option>
            {lessonPlansData.weeks.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2 sm:col-start-1">
          <Field label="Lesson Title" required error={errors.lessonTitle}>
            <input
              value={information.lessonTitle}
              onChange={(e) => onChange({ lessonTitle: e.target.value })}
              placeholder="e.g., Reading Comprehension Strategies"
              className={cn(inputClass, errors.lessonTitle && "border-red-300")}
            />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Learning Competency (optional)">
            <input
              value={information.learningCompetency}
              onChange={(e) => onChange({ learningCompetency: e.target.value })}
              placeholder="e.g., EN8RC-IIa-2.15.2: Analyze narrative structure..."
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#9fc9b4] px-4 text-[12px] font-semibold text-cnhs-green-dark transition-colors hover:bg-[#8fbea6]"
        >
          Continue
          <ArrowRight size={14} />
        </button>
      </div>
    </form>
  );
}
