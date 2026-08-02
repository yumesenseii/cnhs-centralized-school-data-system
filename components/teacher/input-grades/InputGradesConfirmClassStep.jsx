"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { validateEClassAgainstAssignedClass } from "@/lib/eclass/validateEClassMetadata";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none transition-colors focus:border-cnhs-green";
const readonlyClass =
  "mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-600";

function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-600">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      ) : null}
    </label>
  );
}

function MetaField({ label, value }) {
  return (
    <Field label={label}>
      <input readOnly value={value || "—"} className={readonlyClass} />
    </Field>
  );
}

export default function InputGradesConfirmClassStep({
  metadata,
  learnerCount = 0,
  classes = [],
  selectedClass,
  onClassChange,
  loadingClasses = false,
  classError = "",
  onBack,
  onContinue,
}) {
  const [errors, setErrors] = useState({});

  const validation = useMemo(() => {
    if (!selectedClass || !metadata) return null;
    return validateEClassAgainstAssignedClass({
      metadata,
      assignedClass: selectedClass,
      teacherName: selectedClass.teacher,
    });
  }, [metadata, selectedClass]);

  function handleContinue(e) {
    e.preventDefault();
    const next = {};
    if (!selectedClass?.id) next.classId = "Assigned class is required.";
    else if (validation && !validation.ok) {
      next.classId = "Selected class does not match the uploaded ECR.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    onContinue?.();
  }

  return (
    <form
      onSubmit={handleContinue}
      className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Confirm Class</h2>
        <p className="mt-1 text-[11px] text-slate-400">
          Grade and section were read from the ECR. Choose the matching assigned
          class from the dropdown — do not type values manually.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-[11px] text-sky-800">
        Detected {learnerCount} learner{learnerCount === 1 ? "" : "s"} in the
        workbook.
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaField label="Teacher (from ECR)" value={metadata?.teacher_name} />
        <MetaField label="Subject (from ECR)" value={metadata?.subject} />
        <MetaField label="Grade Level (from ECR)" value={metadata?.grade_level} />
        <MetaField label="Section (from ECR)" value={metadata?.section} />
        <MetaField
          label="School Year (from ECR)"
          value={metadata?.school_year}
        />
      </div>

      <div className="mb-4">
        <Field
          label="Assigned Class"
          required
          error={errors.classId || classError}
        >
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
              "cursor-pointer",
              classes.length === 0 && "cursor-not-allowed bg-slate-50",
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
      </div>

      {selectedClass ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaField label="Learning Area" value={selectedClass.subject} />
          <MetaField label="Grade Level" value={selectedClass.grade} />
          <MetaField label="Section" value={selectedClass.section} />
          <MetaField
            label="Term"
            value={selectedClass.quarterLabel || selectedClass.currentQuarter}
          />
          <MetaField label="School Year" value={selectedClass.schoolYear} />
        </div>
      ) : null}

      {validation && !validation.ok ? (
        <div className="mb-4 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-red-600">
          {validation.error}
        </div>
      ) : null}

      {validation?.ok ? (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[11px] font-medium text-cnhs-green-dark">
          ECR metadata matches the selected assigned class.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={13} />
          Back
        </button>
        <button
          type="submit"
          disabled={!selectedClass || (validation && !validation.ok)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
          <ArrowRight size={13} />
        </button>
      </div>
    </form>
  );
}
