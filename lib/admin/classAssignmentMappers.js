import { termLabel } from "@/lib/academic/termLabels";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function formatPersonName(person) {
  if (!person) return "—";
  const name = [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "—";
}

export function formatGradeLevel(gradeLevel) {
  const grade = Number(gradeLevel);
  if (!Number.isFinite(grade)) return "—";
  return `Grade ${grade}`;
}

export function formatQuarter(quarter) {
  return termLabel(quarter);
}

export function mapClassAssignment(row) {
  const subject = unwrap(row.subjects);
  const section = unwrap(row.sections);
  const teacher = unwrap(row.teachers);

  return {
    id: row.id,
    teacherId: row.teacher_id,
    subjectId: row.subject_id,
    sectionId: row.section_id,
    schoolYear: row.school_year,
    quarter: Number(row.quarter),
    quarterLabel: formatQuarter(row.quarter),
    teacherName: formatPersonName(teacher),
    subjectName: subject?.subject_name ?? "—",
    subjectCode: subject?.subject_code ?? null,
    gradeLevel: section?.grade_level ?? null,
    gradeLabel: formatGradeLevel(section?.grade_level),
    sectionName: section?.section_name ?? "—",
    sectionSchoolYear: section?.school_year ?? null,
    createdAt: row.created_at,
    raw: row,
  };
}

export function buildAssignmentSummary(assignments) {
  const teachers = new Set(
    assignments.map((item) => item.teacherId).filter(Boolean)
  );
  const subjects = new Set(
    assignments.map((item) => item.subjectId).filter(Boolean)
  );
  const schoolYears = new Set(
    assignments.map((item) => item.schoolYear).filter(Boolean)
  );

  return [
    {
      id: "total",
      label: "Total Assignments",
      count: assignments.length,
      icon: "book",
      tone: "green",
    },
    {
      id: "teachers",
      label: "Teachers Assigned",
      count: teachers.size,
      icon: "users",
      tone: "blue",
    },
    {
      id: "subjects",
      label: "Subjects Covered",
      count: subjects.size,
      icon: "layers",
      tone: "teal",
    },
    {
      id: "years",
      label: "School Years",
      count: schoolYears.size,
      icon: "calendar",
      tone: "violet",
    },
  ];
}
