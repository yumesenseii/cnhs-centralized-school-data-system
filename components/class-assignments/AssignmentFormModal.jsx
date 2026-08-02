"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPersonName } from "@/lib/admin/classAssignmentMappers";
import {
  TERM_ALL_VALUE,
  TERM_FORM_OPTIONS,
  TERM_OPTIONS,
} from "@/lib/academic/termLabels";

const GRADE_OPTIONS = [7, 8, 9, 10];

export default function AssignmentFormModal({
  open,
  mode = "create",
  assignment,
  teachers,
  subjects,
  sections,
  schoolYears,
  defaultSchoolYear,
  saving,
  onClose,
  onSubmit,
}) {
  const [teacherId, setTeacherId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [gradeLevel, setGradeLevel] = useState("7");
  const [sectionId, setSectionId] = useState("");
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear || "");
  const [quarter, setQuarter] = useState("1");
  const [formError, setFormError] = useState("");

  const activeSections = useMemo(() => {
    return (sections ?? []).filter((section) => {
      if (section.status && section.status !== "active") return false;
      if (schoolYear && section.school_year !== schoolYear) return false;
      if (Number(section.grade_level) !== Number(gradeLevel)) return false;
      return true;
    });
  }, [sections, schoolYear, gradeLevel]);

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && assignment) {
      setTeacherId(assignment.teacherId ?? "");
      setSubjectId(assignment.subjectId ?? "");
      setGradeLevel(String(assignment.gradeLevel ?? 7));
      setSectionId(assignment.sectionId ?? "");
      setSchoolYear(assignment.schoolYear ?? defaultSchoolYear ?? "");
      setQuarter(String(assignment.quarter ?? 1));
    } else {
      setTeacherId("");
      setSubjectId("");
      setGradeLevel("7");
      setSectionId("");
      setSchoolYear(defaultSchoolYear || schoolYears[0] || "");
      setQuarter("1");
    }
    setFormError("");
  }, [open, mode, assignment, defaultSchoolYear, schoolYears]);

  useEffect(() => {
    if (!open) return;
    if (!sectionId) return;
    const stillValid = activeSections.some((section) => section.id === sectionId);
    if (!stillValid) setSectionId("");
  }, [open, activeSections, sectionId]);

  if (!open) return null;

  const title =
    mode === "edit" ? "Edit Class Assignment" : "Assign Teacher to Class";
  const description =
    "Assign a teacher to a subject and section for a school year and term. Choose All Terms to create Term 1–3 + Final Grade in one step.";

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (
      !teacherId ||
      !subjectId ||
      !sectionId ||
      !schoolYear.trim()
    ) {
      setFormError("Teacher, subject, section, and school year are required.");
      return;
    }

    if (mode === "edit" && quarter === TERM_ALL_VALUE) {
      setFormError("Edit one term at a time. Use All Terms only when creating.");
      return;
    }

    const base = {
      teacher_id: teacherId,
      subject_id: subjectId,
      section_id: sectionId,
      grade_level: Number(gradeLevel),
      school_year: schoolYear.trim(),
    };

    const payload =
      quarter === TERM_ALL_VALUE
        ? { ...base, allQuarters: true }
        : { ...base, quarter: Number(quarter) };

    const result = await onSubmit?.(payload);
    if (result && !result.ok) {
      setFormError(result.error || "Unable to save assignment.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-form-title"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h2
            id="assignment-form-title"
            className="text-lg font-semibold tracking-[-0.02em] text-slate-900"
          >
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <form className="space-y-3 px-4 py-3.5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Teacher
            </span>
            <select
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {formatPersonName(teacher)}
                  {teacher.employee_number
                    ? ` (${teacher.employee_number})`
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Subject
            </span>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
              required
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                  {subject.subject_code ? ` (${subject.subject_code})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                School Year
              </span>
              <input
                list="assignment-school-years"
                value={schoolYear}
                onChange={(event) => setSchoolYear(event.target.value)}
                placeholder="SY 2026-2027"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
                required
              />
              <datalist id="assignment-school-years">
                {schoolYears.map((year) => (
                  <option key={year} value={year} />
                ))}
              </datalist>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Term
              </span>
              <select
                value={quarter}
                onChange={(event) => setQuarter(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
                required
              >
                {(mode === "create" ? TERM_FORM_OPTIONS : TERM_OPTIONS).map(
                  (item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Grade Level
              </span>
              <select
                value={gradeLevel}
                onChange={(event) => setGradeLevel(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
                required
              >
                {GRADE_OPTIONS.map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Section
              </span>
              <select
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
                required
              >
                <option value="">Select section</option>
                {activeSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.section_name}
                  </option>
                ))}
              </select>
              {activeSections.length === 0 ? (
                <span className="mt-1 block text-[10px] text-amber-600">
                  No active sections for this school year and grade. Create one
                  in Section Management first.
                </span>
              ) : null}
            </label>
          </div>

          {formError ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 cursor-pointer rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : mode === "edit"
                  ? "Save Changes"
                  : "Assign Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
