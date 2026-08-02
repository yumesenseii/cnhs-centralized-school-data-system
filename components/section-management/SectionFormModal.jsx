"use client";

import { useEffect, useState } from "react";
import { formatTeacherName } from "@/lib/admin/sectionMappers";

const GRADE_OPTIONS = [7, 8, 9, 10];

export default function SectionFormModal({
  open,
  mode = "create",
  section,
  teachers,
  schoolYears,
  defaultSchoolYear,
  saving,
  onClose,
  onSubmit,
}) {
  const [gradeLevel, setGradeLevel] = useState("7");
  const [sectionName, setSectionName] = useState("");
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear || "");
  const [adviserId, setAdviserId] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && section) {
      setGradeLevel(String(section.gradeLevel));
      setSectionName(section.sectionName ?? "");
      setSchoolYear(section.schoolYear ?? defaultSchoolYear ?? "");
      setAdviserId(section.adviserId ?? "");
    } else {
      setGradeLevel("7");
      setSectionName("");
      setSchoolYear(defaultSchoolYear || schoolYears[0] || "");
      setAdviserId("");
    }
    setFormError("");
  }, [open, mode, section, defaultSchoolYear, schoolYears]);

  if (!open) return null;

  const title = mode === "edit" ? "Edit Section" : "Create Section";
  const description =
    mode === "edit"
      ? "Update section details for the selected school year."
      : "Add a section for a specific school year. Archived historical sections are kept separately.";

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const payload = {
      grade_level: Number(gradeLevel),
      section_name: sectionName.trim(),
      school_year: schoolYear.trim(),
      adviser_id: adviserId || null,
    };

    if (!payload.section_name || !payload.school_year) {
      setFormError("Section name and school year are required.");
      return;
    }

    const result = await onSubmit?.(payload);
    if (result && !result.ok) {
      setFormError(result.error || "Unable to save section.");
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
        aria-labelledby="section-form-title"
        className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h2
            id="section-form-title"
            className="text-lg font-semibold tracking-[-0.02em] text-slate-900"
          >
            {title}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <form className="space-y-3 px-4 py-3.5" onSubmit={handleSubmit}>
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
                School Year
              </span>
              <input
                list="school-year-options"
                value={schoolYear}
                onChange={(event) => setSchoolYear(event.target.value)}
                placeholder="SY 2026-2027"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
                required
              />
              <datalist id="school-year-options">
                {schoolYears.map((year) => (
                  <option key={year} value={year} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Section Name
            </span>
            <input
              value={sectionName}
              onChange={(event) => setSectionName(event.target.value)}
              placeholder="e.g. Rizal"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Adviser (optional)
            </span>
            <select
              value={adviserId}
              onChange={(event) => setAdviserId(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green-dark/40"
            >
              <option value="">No adviser assigned</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {formatTeacherName(teacher)}
                  {teacher.employee_number
                    ? ` (${teacher.employee_number})`
                    : ""}
                </option>
              ))}
            </select>
          </label>

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
                  : "Create Section"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
