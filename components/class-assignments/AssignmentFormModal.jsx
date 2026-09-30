"use client";

import { useEffect, useMemo, useState } from "react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import AppSelect from "@/components/shared/AppSelect";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import { formatPersonName } from "@/lib/admin/classAssignmentMappers";
import {
  TERM_ALL_VALUE,
  TERM_FORM_OPTIONS,
} from "@/lib/academic/termLabels";
import { GRADE_OPTIONS } from "@/lib/academic/gradeLevels";

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

  const title =
    mode === "edit" ? "Edit Class Assignment" : "Assign Teacher to Class";
  const description =
    mode === "edit"
      ? "Update this assignment, or choose All Terms to create any missing Term 1–3 + Final rows for this teacher, subject, section, and school year."
      : "Assign a teacher to a subject and section for a school year and term. Choose All Terms to create Term 1–3 + Final Grade in one step.";

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
    <AnimatedModal
      open={open}
      onClose={saving ? undefined : onClose}
      labelledBy="assignment-form-title"
      zClassName="z-[60]"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      className="bg-slate-900/40"
      panelClassName="w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
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
          <div className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Teacher
            </span>
            <AppSelect
              label="Teacher"
              value={teacherId}
              onChange={setTeacherId}
              required
              placeholder="Select teacher"
              options={[
                { value: "", label: "Select teacher" },
                ...teachers.map((teacher) => ({
                  value: teacher.id,
                  label: `${formatPersonName(teacher)}${
                    teacher.employee_number
                      ? ` (${teacher.employee_number})`
                      : ""
                  }`,
                })),
              ]}
            />
          </div>

          <div className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Subject
            </span>
            <AppSelect
              label="Subject"
              value={subjectId}
              onChange={setSubjectId}
              required
              placeholder="Select subject"
              options={[
                { value: "", label: "Select subject" },
                ...subjects.map((subject) => ({
                  value: subject.id,
                  label: `${subject.subject_name}${
                    subject.subject_code ? ` (${subject.subject_code})` : ""
                  }`,
                })),
              ]}
            />
          </div>

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

            <div className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Term
              </span>
              <AppSelect
                label="Term"
                value={quarter}
                onChange={setQuarter}
                required
                options={TERM_FORM_OPTIONS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Grade Level
              </span>
              <AppSelect
                label="Grade Level"
                value={gradeLevel}
                onChange={setGradeLevel}
                required
                options={GRADE_OPTIONS}
              />
            </div>

            <div className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Section
              </span>
              <AppSelect
                label="Section"
                value={sectionId}
                onChange={setSectionId}
                required
                placeholder="Select section"
                options={[
                  { value: "", label: "Select section" },
                  ...activeSections.map((section) => ({
                    value: section.id,
                    label: section.section_name,
                  })),
                ]}
              />
              {activeSections.length === 0 ? (
                <span className="mt-1 block text-[10px] text-amber-600">
                  No active sections for this school year and grade. Create one
                  in Section Management first.
                </span>
              ) : null}
            </div>
          </div>

          <AnimatedBanner
            message={formError}
            tone="error"
            className="text-[11px]"
          />

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
    </AnimatedModal>
  );
}
