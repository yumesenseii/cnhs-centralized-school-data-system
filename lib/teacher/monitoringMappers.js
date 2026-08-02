import recommendationService from "@/lib/services/recommendationService";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  averageFromSubjectGrades,
  isAtRisk,
  recommendationKeyFromType,
  weakSubjectsFromGrades,
} from "@/lib/monitoring/recommendations";
import { withWeekNumbers } from "@/lib/monitoring/aralProgress";
import {
  isAralEligibleSubject,
  normalizeSubjectName,
} from "@/lib/services/recommendation/subjectCapabilities";
// Class-level Classroom Remedial is shared with Teacher Reports (same policy).
import { evaluateClassroomRemedial } from "@/lib/teacher/reportsCalculations";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function formatPersonName(person) {
  if (!person) return "—";
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarToneFromRisk(riskLevel) {
  if (riskLevel === "High Risk" || riskLevel === "Priority") return "red";
  if (riskLevel === "Moderate Risk" || riskLevel === "Moderate") return "orange";
  return "green";
}

/** Learner's grade in the subject of the class being viewed. */
function gradeForClassSubject(subjectGrades = [], classSubject) {
  const target = normalizeSubjectName(classSubject);
  if (!target) return null;
  for (const row of subjectGrades) {
    if (normalizeSubjectName(row.subject ?? row.subjectName) !== target) continue;
    const value = row.grade ?? row.finalGrade ?? row.final_grade;
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

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

function quarterLabel(quarter) {
  return termLabel(quarter);
}

function gradesByStudent(grades = []) {
  const map = new Map();
  for (const row of grades) {
    const list = map.get(row.student_id) ?? [];
    list.push({
      id: row.id,
      subjectId: row.subject_id,
      subjectName: unwrap(row.subjects)?.subject_name ?? "Subject",
      finalGrade:
        row.final_grade === null || row.final_grade === undefined
          ? null
          : Number(row.final_grade),
      quarter: row.quarter,
      schoolYear: row.school_year,
      classId: row.class_id,
    });
    map.set(row.student_id, list);
  }
  return map;
}

function latestMonitoringByStudentClass(records = []) {
  const map = new Map();
  for (const row of records) {
    const key = `${row.student_id}:${row.class_id}`;
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function monitoringStatsByStudentClass(records = []) {
  const map = new Map();
  for (const row of records) {
    const key = `${row.student_id}:${row.class_id}`;
    const prev = map.get(key) || { count: 0, latestProgress: null };
    prev.count += 1;
    // Records are ordered newest-first from the query; keep first progress seen.
    if (prev.latestProgress == null && row.student_progress) {
      prev.latestProgress = row.student_progress;
    }
    map.set(key, prev);
  }
  return map;
}

function classLookup(classes = []) {
  const map = new Map();
  for (const row of classes) {
    const section = unwrap(row.sections);
    const subject = unwrap(row.subjects);
    const teacher = unwrap(row.teachers);
    const adviser = unwrap(section?.adviser);
    const subjectName = subject?.subject_name ?? "Subject";
    map.set(row.id, {
      id: row.id,
      schoolYear: row.school_year,
      quarter: Number(row.quarter),
      quarterLabel: quarterLabel(row.quarter),
      subject: subjectName,
      aralEligible: isAralEligibleSubject(subjectName),
      subjectId: row.subject_id,
      sectionId: row.section_id,
      gradeLevel: section?.grade_level ?? null,
      sectionName: section?.section_name ?? "Section",
      gradeSection:
        section?.grade_level != null
          ? `Grade ${section.grade_level} ${section.section_name ?? ""}`.trim()
          : section?.section_name ?? "—",
      teacherName: formatPersonName(teacher),
      adviserName: formatPersonName(adviser),
      teacherId: row.teacher_id,
    });
  }
  return map;
}

/**
 * Map an engine result to UI fields.
 *
 * Subject scope (Phase 2):
 * - ARAL-eligible class (English / Filipino) → student recommendation is shown.
 * - Other subjects → no student recommendation is surfaced; the learner is
 *   still flagged when below the passing grade so Classroom Remedial (class
 *   level) has visible context.
 */
function applyRecommendationToUiFields(
  recommendation,
  subjectGrades,
  fallbackSubject,
  { aralEligible = true, classSubject = null } = {}
) {
  const weakSubjects = weakSubjectsFromGrades(subjectGrades);
  const classSubjectGrade = gradeForClassSubject(
    subjectGrades,
    classSubject ?? fallbackSubject
  );
  const belowPassing =
    classSubjectGrade !== null && classSubjectGrade < PASSING_GRADE;

  const recommendationType = recommendation.recommendationType;
  const aralRecommended =
    aralEligible && recommendationType === RECOMMENDATION.ARAL;

  let riskLevel = recommendation.riskLevel;
  if (!aralEligible) {
    riskLevel = belowPassing ? RISK_LEVEL.MODERATE : RISK_LEVEL.LOW;
  }

  return {
    // Prefer the class subject grade for list display so it matches
    // At Risk / Below Passing / Avg Class Grade on the class cards.
    generalAverage:
      classSubjectGrade ?? averageFromSubjectGrades(subjectGrades),
    classSubjectGrade,
    riskLevel,
    recommendation: recommendationType,
    // Null for non-ARAL subjects so the UI can hide screening output entirely.
    recommendationDisplay: aralEligible ? recommendationType : null,
    recommendationKey: recommendationKeyFromType(recommendationType),
    recommendationReason: (recommendation.reasons ?? []).join(". "),
    recommendationConfidence: recommendation.confidence,
    recommendationGeneratedAt: recommendation.generatedAt,
    recommendationReasons: recommendation.reasons ?? [],
    weakSubject: weakSubjects[0] ?? fallbackSubject,
    weakSubjects,
    aralEligible,
    belowPassing,
    atRisk: aralRecommended || (!aralEligible && belowPassing) ||
      (aralEligible && isAtRisk(recommendationType)),
  };
}

/**
 * Build per-class summaries + flat student rows for the monitoring dashboard.
 * One student row per class enrollment (a learner in two classes appears twice).
 *
 * Recommendations come only from recommendationService.generate().
 */
export async function buildMonitoringRoster({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
} = {}) {
  const classesById = classLookup(classes);
  const gradesMap = gradesByStudent(grades);
  const latestMonitoring = latestMonitoringByStudentClass(monitoringRecords);
  const monitoringStats = monitoringStatsByStudentClass(monitoringRecords);

  const students = [];

  for (const enrollment of enrollments) {
    const student = unwrap(enrollment.students);
    if (!student) continue;

    const classInfo = classesById.get(enrollment.class_id);
    if (!classInfo) continue;

    const subjectGrades = gradesMap.get(student.id) ?? [];
    // Prefer grades matching this class school year / quarter.
    const scopedGrades = subjectGrades.filter(
      (g) =>
        g.schoolYear === classInfo.schoolYear &&
        Number(g.quarter) === Number(classInfo.quarter)
    );
    const gradesForRecommendation = scopedGrades.length
      ? scopedGrades
      : subjectGrades;

    const mappedSubjectGrades = gradesForRecommendation.map((g) => ({
      subject: g.subjectName,
      grade: g.finalGrade,
    }));

    const recommendation = await recommendationService.generate({
      id: student.id,
      subjectGrades: mappedSubjectGrades,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
      classId: enrollment.class_id,
      classSubject: classInfo.subject,
    });

    const latest = latestMonitoring.get(`${student.id}:${enrollment.class_id}`);
    const monitoringStatus =
      latest?.monitoring_status ?? MONITORING_STATUS.NOT_STARTED;
    const name = formatPersonName(student);
    const recommendationFields = applyRecommendationToUiFields(
      recommendation,
      mappedSubjectGrades,
      classInfo.subject,
      {
        aralEligible: classInfo.aralEligible,
        classSubject: classInfo.subject,
      }
    );

    students.push({
      id: `${enrollment.class_id}:${student.id}`,
      studentId: student.id,
      classId: enrollment.class_id,
      enrollmentId: enrollment.id,
      studentNumber: student.student_number,
      name,
      initials: initialsFromName(name),
      avatarTone: avatarToneFromRisk(recommendationFields.riskLevel),
      grade:
        classInfo.gradeLevel != null ? `Grade ${classInfo.gradeLevel}` : "—",
      section: classInfo.sectionName,
      gradeSection: classInfo.gradeSection,
      subject: classInfo.subject,
      subjectAralEligible: classInfo.aralEligible,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarterLabel,
      quarterNumber: classInfo.quarter,
      teacherName: classInfo.teacherName,
      adviserName: classInfo.adviserName,
      ...recommendationFields,
      monitoringStatus,
      followUpNeeded: Boolean(latest?.follow_up_needed),
      latestObservationDate: formatDate(latest?.observation_date),
      latestProgress:
        monitoringStats.get(`${student.id}:${enrollment.class_id}`)
          ?.latestProgress ||
        latest?.student_progress ||
        null,
      weeklyUpdateCount:
        monitoringStats.get(`${student.id}:${enrollment.class_id}`)?.count ?? 0,
      inAralProgram:
        classInfo.aralEligible &&
        recommendationFields.recommendation === RECOMMENDATION.ARAL,
      subjectGrades: mappedSubjectGrades,
    });
  }

  students.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const classSummaries = [...classesById.values()]
    .map((classInfo) => {
      const classStudents = students.filter((s) => s.classId === classInfo.id);

      // Classroom Remedial + averages use the class subject grade (same source).
      const classSubjectGrades = classStudents
        .map((s) => s.classSubjectGrade)
        .filter((v) => v !== null && v !== undefined && v !== "");
      const numericGrades = classSubjectGrades
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
      const averageClassGrade =
        numericGrades.length > 0
          ? Math.round(
              (numericGrades.reduce((sum, v) => sum + v, 0) / numericGrades.length) *
                10
            ) / 10
          : null;

      const remedial = evaluateClassroomRemedial(classSubjectGrades);
      const underMonitoring = classStudents.filter(
        (s) => s.monitoringStatus && s.monitoringStatus !== MONITORING_STATUS.NOT_STARTED
      ).length;

      return {
        ...classInfo,
        totalStudents: classStudents.length,
        studentsAtRisk: classStudents.filter((s) => s.atRisk).length,
        aralCount: classInfo.aralEligible
          ? classStudents.filter(
              (s) => s.recommendation === RECOMMENDATION.ARAL
            ).length
          : 0,
        belowPassingCount: remedial.belowPassingCount,
        belowPassingRate: remedial.belowPassingRate,
        belowPassingPercent: Math.round((remedial.belowPassingRate ?? 0) * 100),
        gradedStudentCount: remedial.gradedCount,
        classroomRemedial: remedial.label,
        classroomRemedialRecommended: remedial.recommended,
        underMonitoringCount: underMonitoring,
        averageClassGrade,
        students: classStudents,
      };
    })
    .sort((a, b) => a.gradeSection.localeCompare(b.gradeSection));

  return { students, classSummaries };
}

/**
 * KPI cards for Monitoring.
 * The ARAL card only appears when the teacher has an English / Filipino class.
 */
export function buildMonitoringKpis(students = [], classSummaries = []) {
  const hasAralClass =
    classSummaries.some((c) => c.aralEligible) ||
    students.some((s) => s.aralEligible);

  const atRisk = students.filter((s) => s.atRisk).length;
  const aral = students.filter(
    (s) => s.aralEligible && s.recommendation === RECOMMENDATION.ARAL
  ).length;
  const remedialClasses = classSummaries.filter(
    (c) => c.classroomRemedialRecommended
  ).length;
  const ongoing = students.filter(
    (s) =>
      s.monitoringStatus === MONITORING_STATUS.ONGOING ||
      s.monitoringStatus === MONITORING_STATUS.NEEDS_FOLLOW_UP
  ).length;
  const completed = students.filter(
    (s) => s.monitoringStatus === MONITORING_STATUS.COMPLETED
  ).length;

  const kpis = [
    {
      id: "at-risk",
      label: "Students at Risk",
      value: atRisk,
      description: hasAralClass
        ? "Learners flagged for screening or below the passing grade."
        : "Learners below the passing grade in your subject.",
      icon: "users",
      tone: "blue",
      alert: atRisk > 0,
    },
  ];

  if (hasAralClass) {
    kpis.push({
      id: "aral",
      label: "ARAL Learners",
      value: aral,
      description: "English or Filipino below 75.",
      icon: "clock",
      tone: "orange",
      alert: aral > 0,
    });
  }

  kpis.push(
    {
      id: "classroom-remedial",
      label: "Classroom Remedial",
      value: remedialClasses,
      description: "Classes recommended for whole-class remedial.",
      icon: "book",
      tone: "green",
      alert: remedialClasses > 0,
    },
    {
      id: "ongoing",
      label: "Ongoing Monitoring",
      value: ongoing,
      description: "Active monitoring records still in progress.",
      icon: "alert",
      tone: "red",
      alert: ongoing > 0,
    },
    {
      id: "completed",
      label: "Completed Monitoring",
      value: completed,
      description: "Monitoring cycles marked completed.",
      icon: "users",
      tone: "green",
    }
  );

  return kpis;
}

export function buildAdminMonitoringStats(students = [], classSummaries = []) {
  return {
    totalAtRisk: students.filter((s) => s.atRisk).length,
    aral: students.filter(
      (s) => s.aralEligible && s.recommendation === RECOMMENDATION.ARAL
    ).length,
    remediation: classSummaries.filter((c) => c.classroomRemedialRecommended)
      .length,
    completed: students.filter(
      (s) => s.monitoringStatus === MONITORING_STATUS.COMPLETED
    ).length,
    ongoing: students.filter(
      (s) =>
        s.monitoringStatus === MONITORING_STATUS.ONGOING ||
        s.monitoringStatus === MONITORING_STATUS.NEEDS_FOLLOW_UP
    ).length,
  };
}

/**
 * Detail page mapping — recommendation via recommendationService only.
 */
export async function mapMonitoringDetail({
  classRow,
  student,
  grades = [],
  monitoringRecords = [],
}) {
  const section = unwrap(classRow?.sections);
  const subject = unwrap(classRow?.subjects);
  const teacher = unwrap(classRow?.teachers);
  const adviser = unwrap(section?.adviser);
  const name = formatPersonName(student);

  const subjectGrades = (grades ?? []).map((row) => ({
    id: row.id,
    subject: unwrap(row.subjects)?.subject_name ?? "Subject",
    grade:
      row.final_grade === null || row.final_grade === undefined
        ? null
        : Number(row.final_grade),
    quarter: row.quarter,
    schoolYear: row.school_year,
  }));

  const recommendation = await recommendationService.generate({
    id: student.id,
    subjectGrades,
    schoolYear: classRow.school_year,
    quarter: classRow.quarter,
    classId: classRow.id,
    classSubject: subject?.subject_name ?? null,
  });

  const classSubjectName = subject?.subject_name ?? null;
  const recommendationFields = applyRecommendationToUiFields(
    recommendation,
    subjectGrades,
    classSubjectName ?? "—",
    {
      aralEligible: isAralEligibleSubject(classSubjectName),
      classSubject: classSubjectName,
    }
  );
  const latest = monitoringRecords[0] ?? null;

  return {
    studentId: student.id,
    classId: classRow.id,
    name,
    initials: initialsFromName(name),
    studentNumber: student.student_number,
    gradeLevel:
      section?.grade_level != null ? `Grade ${section.grade_level}` : "—",
    section: section?.section_name ?? "—",
    gradeSection:
      section?.grade_level != null
        ? `Grade ${section.grade_level} — ${section.section_name ?? ""}`.trim()
        : section?.section_name ?? "—",
    adviser: formatPersonName(adviser),
    teacher: formatPersonName(teacher),
    subject: classSubjectName ?? "—",
    subjectAralEligible: isAralEligibleSubject(classSubjectName),
    schoolYear: classRow.school_year,
    quarter: quarterLabel(classRow.quarter),
    quarterNumber: Number(classRow.quarter),
    subjectGrades,
    ...recommendationFields,
    monitoringStatus: latest?.monitoring_status ?? MONITORING_STATUS.NOT_STARTED,
    latestProgress: latest?.student_progress || null,
    weeklyUpdateCount: (monitoringRecords ?? []).length,
    inAralProgram:
      isAralEligibleSubject(classSubjectName) &&
      recommendationFields.recommendation === RECOMMENDATION.ARAL,
    records: withWeekNumbers(
      (monitoringRecords ?? []).map((row) => ({
        id: row.id,
        observationDate: formatDate(row.observation_date),
        observationDateRaw: row.observation_date,
        interventionGiven: row.intervention_given || "—",
        teacherRemarks: row.teacher_remarks || "—",
        studentProgress: row.student_progress || "—",
        followUpNeeded: Boolean(row.follow_up_needed),
        monitoringStatus: row.monitoring_status,
        createdAt: formatDate(row.created_at),
        teacherName: formatPersonName(unwrap(row.teachers)),
      }))
    ),
  };
}

export function buildFilterOptions(students = [], classSummaries = []) {
  const grades = [
    "All Grades",
    ...new Set(students.map((s) => s.grade).filter((v) => v && v !== "—")),
  ];
  const sections = [
    "All Sections",
    ...new Set(students.map((s) => s.section).filter(Boolean)),
  ];
  const subjects = [
    "All Subjects",
    ...new Set(
      classSummaries.map((c) => c.subject).filter(Boolean).concat(
        students.map((s) => s.subject).filter(Boolean)
      )
    ),
  ];
  const schoolYears = [
    ...new Set(
      classSummaries.map((c) => c.schoolYear).filter(Boolean).concat(
        students.map((s) => s.schoolYear).filter(Boolean)
      )
    ),
  ];
  const quarters = [
    TERM_ALL_LABEL,
    ...new Set(students.map((s) => s.quarter).filter(Boolean)),
  ];

  // ARAL is only offered as a filter when the teacher has a language class.
  const hasAralClass =
    classSummaries.some((c) => c.aralEligible) ||
    students.some((s) => s.aralEligible);

  return {
    grades,
    sections,
    subjects,
    schoolYears: schoolYears.length ? schoolYears : ["SY 2026-2027"],
    quarters,
    hasAralClass,
    interventions: [
      "All Recommendations",
      ...(hasAralClass ? [RECOMMENDATION.ARAL] : []),
      RECOMMENDATION.NONE,
    ],
    risks: [
      "All Risks",
      RISK_LEVEL.HIGH,
      RISK_LEVEL.MODERATE,
      RISK_LEVEL.LOW,
    ],
    statuses: [
      "All Status",
      MONITORING_STATUS.NOT_STARTED,
      MONITORING_STATUS.ONGOING,
      MONITORING_STATUS.IMPROVED,
      MONITORING_STATUS.NEEDS_FOLLOW_UP,
      MONITORING_STATUS.COMPLETED,
    ],
  };
}
