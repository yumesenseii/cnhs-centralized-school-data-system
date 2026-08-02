export function formatTeacherName(teacher) {
  if (!teacher) return "—";
  const parts = [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return parts || "—";
}

export function formatGradeLevel(gradeLevel) {
  const grade = Number(gradeLevel);
  if (!Number.isFinite(grade)) return "—";
  return `Grade ${grade}`;
}

export function mapSectionRow(row) {
  const teacher = Array.isArray(row.teachers) ? row.teachers[0] : row.teachers;
  const status = row.status === "archived" ? "Archived" : "Active";

  return {
    id: row.id,
    gradeLevel: Number(row.grade_level),
    gradeLabel: formatGradeLevel(row.grade_level),
    sectionName: row.section_name,
    schoolYear: row.school_year,
    adviserId: row.adviser_id ?? null,
    adviserName: formatTeacherName(teacher),
    status,
    statusValue: row.status === "archived" ? "archived" : "active",
    createdAt: row.created_at,
    raw: row,
  };
}

export function buildSectionSummary(sections) {
  const active = sections.filter((item) => item.statusValue === "active").length;
  const archived = sections.filter((item) => item.statusValue === "archived").length;
  const schoolYears = new Set(sections.map((item) => item.schoolYear).filter(Boolean));
  const withAdviser = sections.filter((item) => item.adviserId).length;

  return [
    {
      id: "total",
      label: "Total Sections",
      count: sections.length,
      icon: "layers",
      tone: "green",
    },
    {
      id: "active",
      label: "Active Sections",
      count: active,
      icon: "check",
      tone: "teal",
    },
    {
      id: "archived",
      label: "Archived Sections",
      count: archived,
      icon: "archive",
      tone: "slate",
    },
    {
      id: "years",
      label: "School Years",
      count: schoolYears.size,
      icon: "calendar",
      tone: "blue",
    },
    {
      id: "advisers",
      label: "With Adviser",
      count: withAdviser,
      icon: "user",
      tone: "violet",
    },
  ].slice(0, 4);
}

export function suggestCurrentSchoolYear(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-based
  // Philippine SY typically starts June
  if (month >= 5) {
    return `SY ${year}-${year + 1}`;
  }
  return `SY ${year - 1}-${year}`;
}
