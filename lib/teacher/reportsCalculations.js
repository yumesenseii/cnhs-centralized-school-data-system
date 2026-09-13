import {
  CLASSROOM_REMEDIAL,
  CLASSROOM_REMEDIAL_THRESHOLD,
  PASSING_GRADE,
  PERFORMANCE_BUCKETS,
} from "@/lib/teacher/reportsConstants";
import { MONITORING_STATUS, RECOMMENDATION } from "@/lib/monitoring/recommendations";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round1(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

/**
 * Classroom Remedial is class-level (not a student recommendation).
 * Uses the share of graded learners below the passing mark.
 */
export function evaluateClassroomRemedial(
  subjectGrades = [],
  {
    passingGrade = PASSING_GRADE,
    threshold = CLASSROOM_REMEDIAL_THRESHOLD,
  } = {}
) {
  const graded = subjectGrades
    .map((g) => toNumber(g))
    .filter((g) => g !== null);

  if (!graded.length) {
    return {
      recommended: false,
      label: CLASSROOM_REMEDIAL.NOT_NEEDED,
      belowPassingCount: 0,
      gradedCount: 0,
      belowPassingRate: 0,
    };
  }

  const belowPassingCount = graded.filter((g) => g < passingGrade).length;
  const belowPassingRate = belowPassingCount / graded.length;
  const recommended = belowPassingRate > threshold;

  return {
    recommended,
    label: recommended
      ? CLASSROOM_REMEDIAL.RECOMMENDED
      : CLASSROOM_REMEDIAL.NOT_NEEDED,
    belowPassingCount,
    gradedCount: graded.length,
    belowPassingRate,
  };
}

/** Grades for a class's assigned subject among its enrollments. */
export function collectClassSubjectGrades({
  classId,
  subjectId,
  schoolYear,
  quarter,
  enrollments = [],
  grades = [],
}) {
  const studentIds = new Set(
    enrollments
      .filter((row) => row.class_id === classId)
      .map((row) => row.student_id)
      .filter(Boolean)
  );

  const byStudent = new Map();

  for (const row of grades) {
    if (!studentIds.has(row.student_id)) continue;
    if (schoolYear && row.school_year !== schoolYear) continue;
    if (
      quarter !== null &&
      quarter !== undefined &&
      Number(row.quarter) !== Number(quarter)
    ) {
      continue;
    }

    const grade = toNumber(row.final_grade);
    if (grade === null) continue;

    const matchesClass = row.class_id === classId;
    const matchesSubject = row.subject_id === subjectId;
    if (!matchesClass && !matchesSubject) continue;

    const existing = byStudent.get(row.student_id);
    // Prefer the grade tied to this class row when both exist.
    if (!existing || matchesClass) {
      byStudent.set(row.student_id, grade);
    }
  }

  return [...byStudent.values()];
}

export function averageOf(values = []) {
  const nums = values.map((v) => toNumber(v)).filter((v) => v !== null);
  if (!nums.length) return null;
  return round1(nums.reduce((sum, n) => sum + n, 0) / nums.length);
}

export function formatMonitoringStatusLabel({
  totalStudents = 0,
  completed = 0,
  ongoing = 0,
  notStarted = 0,
} = {}) {
  if (!totalStudents) return "No Students";
  if (completed === totalStudents) return "Completed";
  if (notStarted === totalStudents) return "Not Started";
  if (ongoing > 0) return `Ongoing · ${completed}/${totalStudents} done`;
  return `${completed}/${totalStudents} completed`;
}

export function countMonitoringBuckets(students = []) {
  let completed = 0;
  let ongoing = 0;
  let notStarted = 0;
  let needsFollowUp = 0;
  let improved = 0;

  for (const student of students) {
    const status = student.monitoringStatus ?? MONITORING_STATUS.NOT_STARTED;
    if (status === MONITORING_STATUS.COMPLETED) completed += 1;
    else if (status === MONITORING_STATUS.ONGOING) ongoing += 1;
    else if (
      status === MONITORING_STATUS.NEEDS_FOLLOW_UP ||
      status === MONITORING_STATUS.NEEDS_FURTHER_SUPPORT
    ) {
      needsFollowUp += 1;
    } else if (status === MONITORING_STATUS.FOR_FURTHER_MONITORING) {
      ongoing += 1;
    } else if (status === MONITORING_STATUS.IMPROVED) improved += 1;
    else notStarted += 1;
  }

  return { completed, ongoing, notStarted, needsFollowUp, improved };
}

export function monitoringCompletionRate(students = []) {
  if (!students.length) return 0;
  const { completed } = countMonitoringBuckets(students);
  return round1((completed / students.length) * 100) ?? 0;
}

export function buildPerformanceDistribution(grades = []) {
  const counts = Object.fromEntries(PERFORMANCE_BUCKETS.map((b) => [b.id, 0]));
  let total = 0;

  for (const grade of grades) {
    const n = toNumber(grade);
    if (n === null) continue;
    total += 1;
    const bucket = PERFORMANCE_BUCKETS.find((b) => n >= b.min && n < b.max);
    if (bucket) counts[bucket.id] += 1;
  }

  return PERFORMANCE_BUCKETS.map((bucket) => ({
    name: bucket.label,
    value: counts[bucket.id],
    color: bucket.color,
    percent: total ? Math.round((counts[bucket.id] / total) * 100) : 0,
  }));
}

/**
 * Count learners recommended for ARAL Learners.
 * Only English / Filipino class enrollments are eligible.
 */
export function countAralScreening(students = []) {
  return students.filter(
    (s) =>
      (s.aralEligible ?? s.subjectAralEligible) &&
      s.recommendation === RECOMMENDATION.ARAL
  ).length;
}

/**
 * ARAL Learners distribution — English / Filipino learners only.
 * Non-ARAL subjects are excluded (Classroom Remedial is class-level elsewhere).
 */
export function buildAralDistribution(students = []) {
  const eligible = students.filter(
    (s) => s.aralEligible ?? s.subjectAralEligible
  );

  let aral = 0;
  let none = 0;

  for (const student of eligible) {
    if (student.recommendation === RECOMMENDATION.ARAL) aral += 1;
    else none += 1;
  }

  if (!eligible.length) {
    return [];
  }

  return [
    { name: "ARAL Learners", value: aral, color: "#e76f51" },
    { name: "No Recommendation", value: none, color: "#40916c" },
  ];
}

/** Display value for the ARAL column on a class report row. */
export function formatAralScreeningCell({ aralEligible, aralScreening }) {
  if (!aralEligible) return "—";
  return aralScreening ?? 0;
}

export function buildAverageGradePerSubject(classRows = []) {
  const bySubject = new Map();

  for (const row of classRows) {
    if (row.averageGrade === null || row.averageGrade === undefined) continue;
    const list = bySubject.get(row.subject) ?? [];
    list.push(Number(row.averageGrade));
    bySubject.set(row.subject, list);
  }

  return [...bySubject.entries()]
    .map(([subject, values]) => ({
      subject,
      average: averageOf(values) ?? 0,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export function buildMonitoringProgressChart(students = []) {
  const buckets = countMonitoringBuckets(students);
  return [
    { name: "Not Started", value: buckets.notStarted, color: "#94a3b8" },
    { name: "Ongoing", value: buckets.ongoing, color: "#f4a261" },
    { name: "Needs Follow-up", value: buckets.needsFollowUp, color: "#e76f51" },
    { name: "Improved", value: buckets.improved, color: "#52b788" },
    { name: "Completed", value: buckets.completed, color: "#40916c" },
  ];
}

export function highestLowestSubjects(classRows = []) {
  const withAvg = classRows.filter(
    (row) => row.averageGrade !== null && row.averageGrade !== undefined
  );
  if (!withAvg.length) {
    return { highest: "—", lowest: "—" };
  }
  const sorted = [...withAvg].sort(
    (a, b) => Number(b.averageGrade) - Number(a.averageGrade)
  );
  return {
    highest: sorted[0].subject,
    lowest: sorted[sorted.length - 1].subject,
  };
}

export function passingRateFromGrades(grades = [], passingGrade = PASSING_GRADE) {
  const nums = grades.map((g) => toNumber(g)).filter((g) => g !== null);
  if (!nums.length) return null;
  const passing = nums.filter((g) => g >= passingGrade).length;
  return Math.round((passing / nums.length) * 100);
}

export function summarizeLessonPlans(lessonPlans = [], { schoolYear, quarter } = {}) {
  const filtered = lessonPlans.filter((plan) => {
    if (schoolYear && plan.school_year && plan.school_year !== schoolYear) {
      return false;
    }
    if (
      quarter !== null &&
      quarter !== undefined &&
      quarter !== "" &&
      plan.quarter != null &&
      Number(plan.quarter) !== Number(quarter)
    ) {
      return false;
    }
    return true;
  });

  const approved = filtered.filter((p) => p.status === "Approved").length;
  const pending = filtered.filter(
    (p) => p.status === "Pending Review" || p.status === "Under Review"
  ).length;
  const needsRevision = filtered.filter((p) => p.status === "Needs Revision").length;

  const latest = [...filtered].sort((a, b) => {
    const aTime = new Date(a.submitted_at || a.updated_at || 0).getTime();
    const bTime = new Date(b.submitted_at || b.updated_at || 0).getTime();
    return bTime - aTime;
  })[0];

  return {
    total: filtered.length,
    approved,
    pending,
    needsRevision,
    latestTitle: latest?.lesson_title ?? "—",
    latestStatus: latest?.status ?? "—",
    latestDate: latest?.submitted_at
      ? new Date(latest.submitted_at).toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—",
  };
}

export function uniqueSorted(values = []) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

export { unwrap, toNumber, round1 };
