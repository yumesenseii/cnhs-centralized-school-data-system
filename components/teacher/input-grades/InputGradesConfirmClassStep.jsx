"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { validateEClassAgainstAssignedClass } from "@/lib/eclass/validateEClassMetadata";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";

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
    if (!selectedClass?.id) next.classId = "Please select a class.";
    else if (validation && !validation.ok) {
      next.classId = "This file doesn’t match the class you selected.";
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Confirm Class</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            We read this class from your E-Class Record. Pick the matching class
            below.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800">
          Found {learnerCount} learner{learnerCount === 1 ? "" : "s"} in this
          file.
        </span>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MetaField label="Teacher" value={metadata?.teacher_name} />
        <MetaField label="Subject" value={metadata?.subject} />
        <MetaField label="Grade Level" value={metadata?.grade_level} />
        <MetaField label="Section" value={metadata?.section} />
        <MetaField label="School Year" value={metadata?.school_year} />
      </div>

      <div className="mb-4">
        <Field
          label="Assigned Class"
          required
          error={errors.classId || classError}
        >
          <AppSelect
            label="Assigned Class"
            value={selectedClass?.id || ""}
            onChange={(next) => {
              setErrors((prev) => {
                const nextErrors = { ...prev };
                delete nextErrors.classId;
                return nextErrors;
              });
              onClassChange?.(next);
            }}
            disabled={loadingClasses || classes.length === 0}
            placeholder={
              loadingClasses
                ? "Loading classes…"
                : classes.length === 0
                  ? "No classes available"
                  : "Select a class"
            }
            options={[
              {
                value: "",
                label: loadingClasses
                  ? "Loading classes…"
                  : classes.length === 0
                    ? "No classes available"
                    : "Select a class",
              },
              ...classes.map((item) => ({
                value: item.id,
                label: `${item.subject} · ${item.gradeSection} · ${
                  item.quarterLabel || item.currentQuarter
                }`,
              })),
            ]}
            className="mt-1.5"
            triggerClassName={cn(
              "h-9 rounded-lg",
              classes.length === 0 && "bg-slate-50",
              (errors.classId || classError) && "border-red-300"
            )}
          />
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
          {selectedClass.subject && selectedClass.gradeSection
            ? `This file matches ${selectedClass.subject} · ${selectedClass.gradeSection}.`
            : "This file matches your selected class."}
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
