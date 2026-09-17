import {
  extractGradeNumber,
  normalizeKey,
  normalizePersonName,
  normalizeSchoolYear,
  normalizeSubject,
  normalizeText,
} from "@/lib/eclass/normalize";

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
      error: "We couldn’t read class details from this file.",
      mismatches: ["metadata"],
    };
  }

  if (!assignedClass) {
    return {
      ok: false,
      error: "Please select a class.",
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
        `Teacher in this file is ${normalizeText(metadata.teacher_name)}, but your class is ${normalizeText(teacherName || assignedClass.teacher)}.`
      );
    }
  }

  if (uploaded.subject !== assigned.subject) {
    mismatches.push("subject");
    details.push(
      `Subject in this file is ${normalizeText(metadata.subject)}, but your class is ${normalizeText(assignedClass.subject)}.`
    );
  }

  if (
    uploaded.grade !== null &&
    assigned.grade !== null &&
    Number(uploaded.grade) !== Number(assigned.grade)
  ) {
    mismatches.push("grade");
    details.push(
      `Grade Level in this file is ${normalizeText(metadata.grade_level)}, but your class is ${normalizeText(assignedClass.grade)}.`
    );
  }

  if (uploaded.section !== assigned.section) {
    mismatches.push("section");
    details.push(
      `Section in this file is ${normalizeText(metadata.section)}, but your class is ${normalizeText(assignedClass.section)}.`
    );
  }

  if (uploaded.schoolYear !== assigned.schoolYear) {
    mismatches.push("school_year");
    details.push(
      `School Year in this file is ${normalizeText(metadata.school_year)}, but your class is ${normalizeText(assignedClass.schoolYear)}.`
    );
  }

  if (mismatches.length) {
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
        "This file doesn’t match the class you selected.",
        ...details,
        "Nothing was imported.",
      ].join("\n"),
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
