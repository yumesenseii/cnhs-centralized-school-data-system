import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { averageOf } from "@/lib/teacher/reportsCalculations";
import { buildMonitoringRoster } from "@/lib/teacher/monitoringMappers";

const PRIORITY_LEARNER_LIMIT = 15;

const RISK_COLORS = {
  [RISK_LEVEL.LOW]: "#52b788",
  [RISK_LEVEL.MODERATE]: "#f4a261",
  [RISK_LEVEL.HIGH]: "#e63946",
};

function teacherLabel(teacher) {
  if (!teacher) return "A teacher";
  const name = [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "A teacher";
}

function firstNameFromProfile(profile) {
  const full = profile?.full_name?.trim();
  if (!full) return "Admin";
  return full.split(/\s+/)[0] || "Admin";
}

function studentName(person) {
  if (!person) return "a learner";
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "a learner";
}

function relativeTime(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapMonitoringStatusToBadge(status) {
  if (status === MONITORING_STATUS.COMPLETED) return "Completed";
  if (status === MONITORING_STATUS.IMPROVED) return "Approved";
  if (
    status === MONITORING_STATUS.ONGOING ||
    status === MONITORING_STATUS.NEEDS_FOLLOW_UP
  ) {
    return "Monitoring";
  }
  return "Pending Review";
}

function interventionLabel(student) {
  if (student.aralEligible && student.recommendation === RECOMMENDATION.ARAL) {
    return RECOMMENDATION.ARAL;
  }
  if (student.aralEligible) {
    return student.recommendationDisplay || "No Recommendation";
  }
  // Non-ARAL subjects: never imply ARAL; point to class-level remedial context.
  if (
    student.classSubjectGrade !== null &&
    student.classSubjectGrade !== undefined &&
    student.classSubjectGrade < PASSING_GRADE
  ) {
    return "Below passing — review class remedial";
  }
  return "—";
}

function riskRank(riskLevel) {
  if (riskLevel === RISK_LEVEL.HIGH || riskLevel === "Priority") return 0;
  if (riskLevel === RISK_LEVEL.MODERATE || riskLevel === "Moderate") return 1;
  return 2;
}

function buildStats({ studentCount, teacherCount, students, classSummaries }) {
  const aralCount = students.filter(
    (s) => s.aralEligible && s.recommendation === RECOMMENDATION.ARAL
  ).length;

  const riskCounts = {
    [RISK_LEVEL.HIGH]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.LOW]: 0,
  };
  for (const student of students) {
    let key = student.riskLevel;
    if (key === "Priority") key = RISK_LEVEL.HIGH;
    if (key === "Moderate") key = RISK_LEVEL.MODERATE;
    if (key === "Low") key = RISK_LEVEL.LOW;
    if (riskCounts[key] === undefined) key = RISK_LEVEL.LOW;
    riskCounts[key] += 1;
  }

  return [
    {
      id: "high-risk",
      label: RISK_LEVEL.HIGH,
      value: riskCounts[RISK_LEVEL.HIGH],
      subtext: "Click to view learners",
      icon: "alert",
      variant: riskCounts[RISK_LEVEL.HIGH] > 0 ? "danger" : "default",
      href: `/monitoring?risk=${encodeURIComponent(RISK_LEVEL.HIGH)}`,
    },
    {
      id: "moderate-risk",
      label: RISK_LEVEL.MODERATE,
      value: riskCounts[RISK_LEVEL.MODERATE],
      subtext: "Click to view learners",
      icon: "alert",
      variant: "default",
      href: `/monitoring?risk=${encodeURIComponent(RISK_LEVEL.MODERATE)}`,
    },
    {
      id: "low-risk",
      label: RISK_LEVEL.LOW,
      value: riskCounts[RISK_LEVEL.LOW],
      subtext: "Click to view learners",
      icon: "check",
      variant: "success",
      href: `/monitoring?risk=${encodeURIComponent(RISK_LEVEL.LOW)}`,
    },
    {
      id: "aral",
      label: RECOMMENDATION.ARAL,
      value: aralCount,
      subtext: "English / Filipino only",
      icon: "alert",
      variant: aralCount > 0 ? "danger" : "default",
      href: `/monitoring?recommendation=${encodeURIComponent(RECOMMENDATION.ARAL)}`,
    },
  ];
}

function buildAcademicPerformance(students = []) {
  const buckets = new Map();

  for (const student of students) {
    const gradeLevel = student.grade?.replace(/^Grade\s+/i, "").trim();
    const label = gradeLevel ? `Grade ${gradeLevel}` : null;
    if (!label) continue;

    const value =
      student.classSubjectGrade ??
      (Number.isFinite(Number(student.generalAverage))
        ? Number(student.generalAverage)
        : null);
    if (value === null || value === undefined) continue;

    const entry = buckets.get(label) ?? { grade: label, values: [] };
    entry.values.push(Number(value));
    buckets.set(label, entry);
  }

  return [...buckets.values()]
    .map((row) => ({
      grade: row.grade,
      average: averageOf(row.values) ?? 0,
    }))
    .sort((a, b) => {
      const ga = Number(String(a.grade).replace(/\D/g, "")) || 0;
      const gb = Number(String(b.grade).replace(/\D/g, "")) || 0;
      return ga - gb;
    });
}

function buildRiskDistribution(students = [], hasGrades) {
  if (!hasGrades) return [];

  const counts = {
    [RISK_LEVEL.LOW]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.HIGH]: 0,
  };

  for (const student of students) {
    let key = student.riskLevel;
    if (key === "Priority") key = RISK_LEVEL.HIGH;
    if (key === "Moderate") key = RISK_LEVEL.MODERATE;
    if (key === "Low") key = RISK_LEVEL.LOW;
    if (counts[key] === undefined) key = RISK_LEVEL.LOW;
    counts[key] += 1;
  }

  return [
    {
      name: "Low Risk",
      value: counts[RISK_LEVEL.LOW],
      color: RISK_COLORS[RISK_LEVEL.LOW],
    },
    {
      name: "Moderate Risk",
      value: counts[RISK_LEVEL.MODERATE],
      color: RISK_COLORS[RISK_LEVEL.MODERATE],
    },
    {
      name: "High Risk",
      value: counts[RISK_LEVEL.HIGH],
      color: RISK_COLORS[RISK_LEVEL.HIGH],
    },
  ].filter((row) => row.value > 0);
}

function buildWeakSubjects(students = [], hasGrades) {
  if (!hasGrades) return [];

  const counts = new Map();
  for (const student of students) {
    for (const subject of student.weakSubjects ?? []) {
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject))
    .slice(0, 8);
}

function buildRecentActivity({ lessonPlans = [], monitoringRecords = [], recentClasses = [] }) {
  const items = [];

  for (const plan of lessonPlans) {
    const teacher = teacherLabel(plan.teachers);
    const status = String(plan.status || "").toLowerCase();
    let description = `${teacher} submitted a lesson plan`;
    let icon = "file";
    let variant = "warning";

    if (status.includes("approved")) {
      description = `Head Teacher approved lesson plan from ${teacher}`;
      icon = "approved";
      variant = "success";
    } else if (status.includes("revision")) {
      description = `Lesson plan from ${teacher} needs revision`;
      icon = "file";
      variant = "warning";
    } else if (status.includes("review")) {
      description = `Lesson plan from ${teacher} is under review`;
      icon = "file";
      variant = "purple";
    }

    items.push({
      id: `lp-${plan.id}`,
      icon,
      description,
      time: relativeTime(plan.submitted_at || plan.updated_at),
      variant,
      sortAt: new Date(plan.submitted_at || plan.updated_at || 0).getTime(),
    });
  }

  for (const record of monitoringRecords) {
    const teacher = teacherLabel(record.teachers);
    const learner = studentName(record.students);
    items.push({
      id: `mon-${record.id}`,
      icon: "analysis",
      description: `${teacher} updated monitoring for ${learner}`,
      time: relativeTime(record.created_at || record.updated_at),
      variant: "purple",
      sortAt: new Date(record.created_at || record.updated_at || 0).getTime(),
    });
  }

  for (const classRow of recentClasses) {
    const teacher = teacherLabel(classRow.teachers);
    const subject = classRow.subjects?.subject_name ?? "a subject";
    const section = classRow.sections;
    const gradeSection =
      section?.grade_level != null
        ? `Grade ${section.grade_level} ${section.section_name ?? ""}`.trim()
        : section?.section_name ?? "a section";

    items.push({
      id: `class-${classRow.id}`,
      icon: "upload",
      description: `${teacher} was assigned ${subject} — ${gradeSection}`,
      time: relativeTime(classRow.created_at),
      variant: "success",
      sortAt: new Date(classRow.created_at || 0).getTime(),
    });
  }

  return items
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 8)
    .map(({ sortAt: _sortAt, ...rest }) => rest);
}

function buildPriorityLearners(students = []) {
  return [...students]
    .filter((s) => {
      if (s.atRisk) return true;
      if (s.aralEligible && s.recommendation === RECOMMENDATION.ARAL) return true;
      if (
        s.classSubjectGrade !== null &&
        s.classSubjectGrade !== undefined &&
        s.classSubjectGrade < PASSING_GRADE
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      const riskDiff = riskRank(a.riskLevel) - riskRank(b.riskLevel);
      if (riskDiff !== 0) return riskDiff;
      const gradeA = a.classSubjectGrade ?? a.generalAverage ?? 999;
      const gradeB = b.classSubjectGrade ?? b.generalAverage ?? 999;
      return gradeA - gradeB;
    })
    .slice(0, PRIORITY_LEARNER_LIMIT)
    .map((student) => {
      const gradeValue = student.classSubjectGrade ?? student.generalAverage;
      return {
        id: student.id,
        studentNumber: student.studentNumber || "—",
        studentName: student.name,
        gradeSection: student.gradeSection || "—",
        generalAverage:
          gradeValue === null || gradeValue === undefined
            ? "—"
            : Number(gradeValue).toFixed(2),
        weakSubject:
          student.aralEligible
            ? student.subject || (student.weakSubjects?.[0] ?? "—")
            : student.subject || "—",
        riskLevel: student.riskLevel || RISK_LEVEL.LOW,
        suggestedIntervention: interventionLabel(student),
        status: mapMonitoringStatusToBadge(student.monitoringStatus),
        classId: student.classId,
        studentId: student.studentId,
        teacherName: student.teacherName || "—",
      };
    });
}

/**
 * Build the Admin Dashboard UI model from the school-wide bundle.
 * Reuses buildMonitoringRoster → recommendationService + subject policy.
 */
export async function buildAdminDashboardModel(bundle) {
  const profile = bundle?.profile ?? null;
  const rosterPayload = bundle?.roster ?? {
    classes: [],
    enrollments: [],
    grades: [],
    monitoringRecords: [],
  };

  const roster = await buildMonitoringRoster(rosterPayload);
  const students = roster.students ?? [];
  const classSummaries = roster.classSummaries ?? [];
  const hasGrades = (rosterPayload.grades ?? []).length > 0;
  const hasClasses = (rosterPayload.classes ?? []).length > 0;
  const hasStudents =
    (bundle?.studentCount ?? 0) > 0 || students.length > 0;

  const adminName = firstNameFromProfile(profile);
  const fullName = profile?.full_name?.trim() || "Admin";

  return {
    profile: {
      name: fullName,
      firstName: adminName,
      role: "Head Teacher",
    },
    welcomeDescription: `Welcome back, ${adminName}. Here is today's learner risk overview.`,
    stats: buildStats({
      studentCount: bundle?.studentCount ?? students.length,
      teacherCount: bundle?.teacherCount ?? 0,
      students,
      classSummaries,
    }),
    academicPerformance: buildAcademicPerformance(students),
    riskDistribution: buildRiskDistribution(students, hasGrades),
    weakSubjects: buildWeakSubjects(students, hasGrades),
    recentActivity: buildRecentActivity(bundle?.activitySources ?? {}),
    priorityLearners: buildPriorityLearners(students),
    meta: {
      hasGrades,
      hasClasses,
      hasStudents,
      classCount: classSummaries.length,
      enrollmentCount: students.length,
    },
  };
}
