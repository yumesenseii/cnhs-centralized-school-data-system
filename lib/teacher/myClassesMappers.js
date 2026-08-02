import {
  TERM_ALL_LABEL,
  classTermGroupKey,
  parseTermNumber,
  termLabel,
  termShortLabel,
} from "@/lib/academic/termLabels";

const SUBJECT_ICON_TONES = {
  English: "blue",
  Mathematics: "violet",
  Science: "green",
  Filipino: "gold",
  "Araling Panlipunan": "brown",
  MAPEH: "pink",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function splitLearnerName(fullName) {
  const cleaned = String(fullName ?? "")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) {
    return { first_name: "Unknown", middle_name: null, last_name: "Learner" };
  }

  if (cleaned.includes(",")) {
    const [lastPart, restPart = ""] = cleaned.split(",");
    const lastName = lastPart.trim() || "Learner";
    const rest = restPart.trim().split(/\s+/).filter(Boolean);
    return {
      first_name: rest[0] || lastName,
      middle_name: rest.length > 1 ? rest.slice(1).join(" ") : null,
      last_name: lastName,
    };
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], middle_name: null, last_name: parts[0] };
  }
  if (parts.length === 2) {
    return { first_name: parts[0], middle_name: null, last_name: parts[1] };
  }

  return {
    first_name: parts[0],
    middle_name: parts.slice(1, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

export function formatStudentName(student = {}) {
  if (student.full_name) return String(student.full_name).trim();
  return [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatTeacherName(teacher) {
  if (!teacher) return "Teacher";
  const name = formatStudentName(teacher);
  return name || "Teacher";
}

function normalizeQuarter(quarter) {
  const n = parseTermNumber(quarter);
  if (n) return `T${n}`;
  if (!quarter) return "T1";
  const value = String(quarter).trim();
  if (/^T[1-4]$/i.test(value) || /^Q[1-4]$/i.test(value)) {
    return `T${value.replace(/\D/g, "")}`;
  }
  return value;
}

function unwrapRelation(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mapClassRecord(classRow) {
  const subject = unwrapRelation(classRow.subjects);
  const section = unwrapRelation(classRow.sections);
  const teacher = unwrapRelation(classRow.teachers);
  const roster = classRow.class_students ?? classRow.class_enrollments ?? [];

  const subjectName =
    subject?.subject_name ?? classRow.subject ?? "Subject";
  const rawGrade = section?.grade_level ?? classRow.grade_level;
  const gradeLevel =
    rawGrade === null || rawGrade === undefined || rawGrade === ""
      ? "Grade"
      : Number.isFinite(Number(rawGrade))
        ? `Grade ${Number(rawGrade)}`
        : String(rawGrade);
  const sectionName =
    section?.section_name ?? classRow.section ?? "Section";
  const teacherName = formatTeacherName(teacher);
  const hasLearners = roster.length > 0;

  const quarterNumber = parseTermNumber(classRow.quarter);
  const quarterLabel = termLabel(quarterNumber ?? classRow.quarter);

  return {
    id: classRow.id,
    subjectId: classRow.subject_id ?? subject?.id ?? null,
    sectionId: classRow.section_id ?? section?.id ?? null,
    teacherId: classRow.teacher_id ?? teacher?.id ?? null,
    subject: subjectName,
    grade: gradeLevel,
    section: sectionName,
    gradeSection: `${gradeLevel} — ${sectionName}`,
    quarter: normalizeQuarter(classRow.quarter),
    quarterNumber: quarterNumber ?? 1,
    quarterLabel,
    currentQuarter: quarterLabel,
    isTermGroup: false,
    termClassIds: quarterNumber
      ? { [quarterNumber]: classRow.id }
      : { 1: classRow.id },
    availableTerms: quarterNumber ? [quarterNumber] : [1],
    schoolYear: classRow.school_year,
    students: roster.length,
    averageGrade: 0,
    classAverage: 0,
    atRisk: 0,
    forIntervention: 0,
    // Derived — existing schema has no academic_record_status column
    academicRecord: hasLearners ? "Submitted" : "Pending Upload",
    lessonPlan: "Pending",
    lastUpdated: formatDate(classRow.created_at),
    iconTone: SUBJECT_ICON_TONES[subjectName] ?? "blue",
    teacher: teacherName,
    adviserDisplay: teacherName
      ? `Sir/Ma'am ${String(teacherName).split(" ")[0]}`
      : "Teacher",
    hasLearners,
    raw: classRow,
  };
}

export function mapEnrollmentToStudent(enrollment, gradeStats = null) {
  const student = unwrapRelation(enrollment.students) ?? {};
  const fullName = formatStudentName(student);
  const status = student.status ?? "Active";
  const average =
    gradeStats?.generalAverage ??
    (Number.isFinite(Number(enrollment.general_average))
      ? Number(enrollment.general_average)
      : null);
  const weakSubject = gradeStats?.weakestSubject ?? enrollment.weak_subject ?? "—";

  return {
    id: student.id,
    enrollmentId: enrollment.id,
    studentNumber: student.student_number ?? "—",
    name: fullName || "Learner",
    gender: student.sex ?? "—",
    initials: initialsFromName(fullName),
    averageGrade: average,
    weakSubject,
    currentStatus:
      status === "active" || status === "Active" ? "Active" : status,
    lastUpdated: formatDate(enrollment.created_at),
    avatarTone:
      average !== null && average < 75 ? "red" : "green",
  };
}

function quarterDisplayLabel(quarter) {
  return termLabel(quarter);
}

export function summarizeStudentGrades(
  gradeRows = [],
  { preferredQuarter = null } = {}
) {
  const parsed = gradeRows
    .map((row) => {
      const subject = unwrapRelation(row.subjects);
      const grade = Number(row.final_grade);
      const quarter = Number(row.quarter);
      return {
        id: row.id,
        subjectId: row.subject_id ?? subject?.id ?? null,
        subjectName: subject?.subject_name ?? "Subject",
        subject: quarterDisplayLabel(quarter),
        grade: Number.isFinite(grade) ? grade : null,
        quarter: Number.isFinite(quarter) ? quarter : null,
        schoolYear: row.school_year,
      };
    })
    .filter((row) => row.grade !== null)
    .sort((a, b) => (a.quarter ?? 99) - (b.quarter ?? 99));

  if (!parsed.length) {
    return {
      subjects: [],
      generalAverage: null,
      weakestSubject: "—",
    };
  }

  const preferred = Number(preferredQuarter);
  if (Number.isFinite(preferred) && preferred >= 1 && preferred <= 4) {
    const match = parsed.find((row) => row.quarter === preferred);
    if (match) {
      return {
        subjects: parsed.map((row) => ({
          ...row,
          weak: row.quarter === match.quarter && row.grade === match.grade,
        })),
        generalAverage: match.grade,
        weakestSubject: match.subjectName ?? "—",
      };
    }
  }

  const aveRow = parsed.find((row) => row.quarter === 4);
  const termRows = parsed.filter((row) => row.quarter >= 1 && row.quarter <= 3);
  const averageSource = aveRow
    ? [aveRow]
    : termRows.length
      ? termRows
      : parsed;
  const total = averageSource.reduce((sum, row) => sum + row.grade, 0);
  const generalAverage =
    Math.round((total / averageSource.length) * 10) / 10;

  const weakestPool = termRows.length ? termRows : parsed;
  const weakest = [...weakestPool].sort((a, b) => a.grade - b.grade)[0];

  return {
    subjects: parsed.map((row) => ({
      ...row,
      weak: Boolean(
        weakest &&
          row.quarter === weakest.quarter &&
          row.grade === weakest.grade
      ),
    })),
    generalAverage,
    weakestSubject: weakest?.subjectName ?? "—",
  };
}

export function buildGradeStatsByStudent(
  gradeRows = [],
  { preferredQuarter = null } = {}
) {
  const byStudent = new Map();

  gradeRows.forEach((row) => {
    const list = byStudent.get(row.student_id) ?? [];
    list.push(row);
    byStudent.set(row.student_id, list);
  });

  const stats = new Map();
  byStudent.forEach((rows, studentId) => {
    stats.set(
      studentId,
      summarizeStudentGrades(rows, { preferredQuarter })
    );
  });
  return stats;
}

/**
 * Build T1–T3 + Final chart points from imported grade rows (all terms).
 * Falls back to placing the current roster average on the active term only.
 */
export function buildQuarterlyAverages(
  classItem,
  students = [],
  gradeRows = []
) {
  const byTerm = { 1: [], 2: [], 3: [], 4: [] };

  for (const row of gradeRows ?? []) {
    const q = parseTermNumber(row.quarter);
    if (!q) continue;
    const grade = Number(row.final_grade);
    if (!Number.isFinite(grade)) continue;
    byTerm[q].push(grade);
  }

  const hasAnyTermGrades = [1, 2, 3, 4].some((q) => byTerm[q].length > 0);
  if (hasAnyTermGrades) {
    return [1, 2, 3, 4].map((q) => {
      const values = byTerm[q];
      const average =
        values.length > 0
          ? Math.round(
              (values.reduce((sum, value) => sum + value, 0) / values.length) *
                10
            ) / 10
          : 0;
      return { quarter: termShortLabel(q), average };
    });
  }

  const averages = (students ?? [])
    .map((item) => item.averageGrade)
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const classAverage =
    averages.length > 0
      ? Math.round(
          (averages.reduce((sum, value) => sum + value, 0) / averages.length) *
            10
        ) / 10
      : 0;

  const active =
    parseTermNumber(classItem?.quarterNumber) ||
    parseTermNumber(classItem?.quarter) ||
    parseTermNumber(classItem?.quarterLabel) ||
    parseTermNumber(classItem?.currentQuarter) ||
    1;

  return [1, 2, 3, 4].map((q) => ({
    quarter: termShortLabel(q),
    average: q === active ? classAverage : 0,
  }));
}

export function buildClassKpis(classItem, students = []) {
  const averages = students
    .map((item) => item.averageGrade)
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const classAverage =
    averages.length > 0
      ? Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 10) /
        10
      : null;
  const forIntervention = students.filter((item) => {
    if (item.averageGrade === null || item.averageGrade === undefined || item.averageGrade === "") {
      return false;
    }
    const value = Number(item.averageGrade);
    return Number.isFinite(value) && value < 75;
  }).length;

  return [
    {
      id: "total",
      label: "Total Students",
      value: classItem.students ?? students.length,
      icon: "users",
      tone: "blue",
    },
    {
      id: "average",
      label: "Class Average",
      value: classAverage ?? "—",
      icon: "trend",
      tone: "green",
    },
    {
      id: "intervention",
      label: "Below 75",
      value: forIntervention,
      icon: "alert",
      tone: "red",
      alert: forIntervention > 0,
    },
    {
      id: "quarter",
      label: "Term",
      value: classItem.quarterLabel || classItem.currentQuarter || "—",
      icon: "check",
      tone: "teal",
    },
  ];
}

/**
 * Collapse All-Terms assignments (same subject/grade/section/SY) into one card.
 */
export function groupClassesForMyClassesList(classes = []) {
  const groups = new Map();

  for (const item of classes) {
    const key = classTermGroupKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const result = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }

    const sorted = [...list].sort(
      (a, b) => (a.quarterNumber ?? 99) - (b.quarterNumber ?? 99)
    );
    const primary = sorted[0];
    const termClassIds = {};
    const availableTerms = [];
    let students = 0;

    for (const row of sorted) {
      const n = row.quarterNumber ?? parseTermNumber(row.quarter) ?? 1;
      termClassIds[n] = row.id;
      if (!availableTerms.includes(n)) availableTerms.push(n);
      students = Math.max(students, Number(row.students) || 0);
    }
    availableTerms.sort((a, b) => a - b);

    const isFullTermSet =
      availableTerms.length >= 3 ||
      ([1, 2, 3].every((t) => availableTerms.includes(t)) &&
        availableTerms.length >= 3);

    result.push({
      ...primary,
      id: primary.id,
      students,
      quarterLabel: isFullTermSet ? TERM_ALL_LABEL : sorted.map((r) => termShortLabel(r.quarterNumber)).join(", "),
      currentQuarter: isFullTermSet ? TERM_ALL_LABEL : primary.currentQuarter,
      isTermGroup: true,
      termClassIds,
      availableTerms,
      relatedClassIds: sorted.map((r) => r.id),
    });
  }

  return result.sort((a, b) =>
    String(a.gradeSection).localeCompare(String(b.gradeSection)) ||
    String(a.subject).localeCompare(String(b.subject))
  );
}

export function buildMyClassesKpis(classes) {
  const totalStudents = classes.reduce((sum, item) => sum + item.students, 0);
  const subjects = new Set(classes.map((item) => item.subject).filter(Boolean));
  const sections = new Set(
    classes.map((item) => item.gradeSection).filter(Boolean)
  );

  return [
    {
      id: "assigned",
      label: "Assigned Classes",
      value: classes.length,
      icon: "book",
      tone: "green",
    },
    {
      id: "students",
      label: "Students Enrolled",
      value: totalStudents,
      icon: "users",
      tone: "blue",
    },
    {
      id: "subjects",
      label: "Subjects",
      value: subjects.size,
      icon: "file",
      tone: "orange",
    },
    {
      id: "sections",
      label: "Grade & Sections",
      value: sections.size,
      icon: "clipboard",
      tone: "red",
    },
  ];
}
