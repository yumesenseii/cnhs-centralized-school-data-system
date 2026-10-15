import {
  extractGradeNumber,
  normalizeKey,
  normalizePersonName,
  normalizeSchoolYear,
  normalizeSubject,
  normalizeText,
} from "./normalize.js";

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

  const teacherMismatch =
    uploaded.teacher && assigned.teacher
      ? !teacherNamesMatch(uploaded.teacher, assigned.teacher)
      : false;
  if (teacherMismatch) {
    mismatches.push("teacher");
    details.push(
      `Guro: ${normalizeText(metadata.teacher_name)} (sa file) vs ${normalizeText(teacherName || assignedClass.teacher)} (sa klase)`
    );
  }

  const subjectMismatch = uploaded.subject !== assigned.subject;
  if (subjectMismatch) {
    mismatches.push("subject");
    details.push(
      `Subject: ${normalizeText(metadata.subject)} (sa file) vs ${normalizeText(assignedClass.subject)} (sa klase)`
    );
  }

  const gradeMismatch =
    uploaded.grade !== null &&
    assigned.grade !== null &&
    Number(uploaded.grade) !== Number(assigned.grade);
  if (gradeMismatch) {
    mismatches.push("grade");
    details.push(
      `Grade Level: ${normalizeText(metadata.grade_level)} (sa file) vs Grade ${normalizeText(assignedClass.grade)} (sa klase)`
    );
  }

  const sectionMismatch = uploaded.section !== assigned.section;
  if (sectionMismatch) {
    mismatches.push("section");
    details.push(
      `Section: ${normalizeText(metadata.section)} (sa file) vs ${normalizeText(assignedClass.section)} (sa klase)`
    );
  }

  const schoolYearMismatch = uploaded.schoolYear !== assigned.schoolYear;
  if (schoolYearMismatch) {
    mismatches.push("school_year");
    details.push(
      `School Year: ${normalizeText(metadata.school_year)} (sa file) vs ${normalizeText(assignedClass.schoolYear)} (sa klase)`
    );
  }

  const uploadedGradeSec = [
    metadata.grade_level || (uploaded.grade ? `Grade ${uploaded.grade}` : ""),
    metadata.section,
  ]
    .filter(Boolean)
    .join(" - ");

  const assignedGradeSec = [
    assignedClass.grade ? `Grade ${assignedClass.grade}` : "",
    assignedClass.section,
  ]
    .filter(Boolean)
    .join(" - ");

  const differences = [
    {
      field: "subject",
      label: "Subject",
      fileValue: normalizeText(metadata.subject) || "Hindi nakasaad",
      classValue: normalizeText(assignedClass.subject) || "Hindi nakasaad",
      isMismatch: subjectMismatch,
    },
    {
      field: "grade_section",
      label: "Baitang at Seksyon",
      fileValue: uploadedGradeSec || "Hindi nakasaad",
      classValue: assignedGradeSec || "Hindi nakasaad",
      isMismatch: gradeMismatch || sectionMismatch,
    },
    {
      field: "teacher",
      label: "Guro",
      fileValue: normalizeText(metadata.teacher_name) || "Hindi nakasaad",
      classValue:
        normalizeText(teacherName || assignedClass.teacher || assignedClass.adviserDisplay) ||
        "Hindi nakasaad",
      isMismatch: teacherMismatch,
    },
    {
      field: "school_year",
      label: "Taong Panuruan (SY)",
      fileValue: normalizeText(metadata.school_year) || "Hindi nakasaad",
      classValue: normalizeText(assignedClass.schoolYear) || "Hindi nakasaad",
      isMismatch: schoolYearMismatch,
    },
  ];

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

  if (mismatches.length) {
    const friendlySummary = `Hindi tumutugma ang napiling file sa klase na ito (${assignedLabel}). Pakisuri ang Subject, Baitang, o Seksyon at subukang muli.`;

    return {
      ok: false,
      mismatches,
      uploadedLabel,
      assignedLabel,
      differences,
      details,
      error: friendlySummary,
    };
  }

  return {
    ok: true,
    mismatches: [],
    uploadedLabel,
    assignedLabel,
    differences,
    error: null,
  };
}
