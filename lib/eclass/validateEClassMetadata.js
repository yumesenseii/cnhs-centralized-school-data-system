import {
  extractGradeNumber,
  normalizeKey,
  normalizePersonName,
  normalizeSchoolYear,
  normalizeSubject,
  normalizeText,
} from "@/lib/eclass/normalize";

const FIELD_LABELS = {
  teacher: "Teacher",
  grade: "Grade Level",
  section: "Section",
  subject: "Subject",
  school_year: "School Year",
};

function formatClassLabel({ grade, section, subject }) {
  const gradeLabel = grade || "Grade";
  const sectionLabel = section || "Section";
  const subjectLabel = subject || "Subject";
  return `${gradeLabel} - ${sectionLabel} - ${subjectLabel}`;
}

function teacherNamesMatch(uploaded, assigned) {
  if (!uploaded || !assigned) return !uploaded && !assigned;
  if (uploaded === assigned) return true;

  const uploadedParts = uploaded.split(" ").filter(Boolean);
  const assignedParts = assigned.split(" ").filter(Boolean);
  if (!uploadedParts.length || !assignedParts.length) return false;

  // Require last-token match or substantial overlap (handles middle initials).
  const uploadedLast = uploadedParts[uploadedParts.length - 1];
  const assignedLast = assignedParts[assignedParts.length - 1];
  if (uploadedLast && assignedLast && uploadedLast === assignedLast) {
    return uploadedParts.some((part) => assignedParts.includes(part));
  }

  const overlap = uploadedParts.filter((part) => assignedParts.includes(part));
  return overlap.length >= Math.min(2, uploadedParts.length, assignedParts.length);
}

/**
 * Compare ECR INPUT DATA metadata against the teacher's assigned class.
 */
export function validateEClassAgainstAssignedClass({
  metadata,
  assignedClass,
  teacherName,
}) {
  if (!metadata) {
    return {
      ok: false,
      error: "E-Class Record metadata is missing.",
      mismatches: ["metadata"],
    };
  }

  if (!assignedClass) {
    return {
      ok: false,
      error: "No assigned class was selected for this import.",
      mismatches: ["assigned_class"],
    };
  }

  const uploaded = {
    teacher: normalizePersonName(metadata.teacher_name),
    subject: normalizeSubject(metadata.subject),
    grade: extractGradeNumber(metadata.grade_level) ?? metadata.grade_level_number,
    section: normalizeKey(metadata.section),
    schoolYear: normalizeSchoolYear(metadata.school_year),
  };

  const assigned = {
    teacher: normalizePersonName(
      teacherName || assignedClass.teacher || assignedClass.adviserDisplay || ""
    ),
    subject: normalizeSubject(assignedClass.subject),
    grade:
      extractGradeNumber(assignedClass.grade) ??
      Number(assignedClass.gradeLevel) ??
      null,
    section: normalizeKey(assignedClass.section),
    schoolYear: normalizeSchoolYear(assignedClass.schoolYear),
  };

  const mismatches = [];
  const details = [];

  if (uploaded.teacher && assigned.teacher) {
    if (!teacherNamesMatch(uploaded.teacher, assigned.teacher)) {
      mismatches.push("teacher");
      details.push(
        `Teacher: uploaded "${normalizeText(metadata.teacher_name)}" does not match assigned "${normalizeText(teacherName || assignedClass.teacher)}".`
      );
    }
  }

  if (uploaded.subject !== assigned.subject) {
    mismatches.push("subject");
    details.push(
      `Subject: uploaded "${normalizeText(metadata.subject)}" does not match assigned "${normalizeText(assignedClass.subject)}".`
    );
  }

  if (
    uploaded.grade !== null &&
    assigned.grade !== null &&
    Number(uploaded.grade) !== Number(assigned.grade)
  ) {
    mismatches.push("grade");
    details.push(
      `Grade Level: uploaded "${normalizeText(metadata.grade_level)}" does not match assigned "${normalizeText(assignedClass.grade)}".`
    );
  }

  if (uploaded.section !== assigned.section) {
    mismatches.push("section");
    details.push(
      `Section: uploaded "${normalizeText(metadata.section)}" does not match assigned "${normalizeText(assignedClass.section)}".`
    );
  }

  if (uploaded.schoolYear !== assigned.schoolYear) {
    mismatches.push("school_year");
    details.push(
      `School Year: uploaded "${normalizeText(metadata.school_year)}" does not match assigned "${normalizeText(assignedClass.schoolYear)}".`
    );
  }

  if (mismatches.length) {
    const failedFields = mismatches
      .map((key) => FIELD_LABELS[key] || key)
      .join(", ");
    const uploadedLabel = formatClassLabel({
      grade: metadata.grade_level || `Grade ${uploaded.grade ?? ""}`.trim(),
      section: normalizeText(metadata.section),
      subject: normalizeText(metadata.subject),
    });
    const assignedLabel = formatClassLabel({
      grade: assignedClass.grade,
      section: assignedClass.section,
      subject: assignedClass.subject,
    });

    return {
      ok: false,
      mismatches,
      uploadedLabel,
      assignedLabel,
      error: [
        `Validation failed for: ${failedFields}.`,
        ...details,
        `Uploaded class: ${uploadedLabel}.`,
        `Assigned class: ${assignedLabel}.`,
        "Nothing was imported.",
      ].join(" "),
    };
  }

  return {
    ok: true,
    mismatches: [],
    uploadedLabel: formatClassLabel({
      grade: metadata.grade_level,
      section: metadata.section,
      subject: metadata.subject,
    }),
    assignedLabel: formatClassLabel({
      grade: assignedClass.grade,
      section: assignedClass.section,
      subject: assignedClass.subject,
    }),
    error: null,
  };
}
