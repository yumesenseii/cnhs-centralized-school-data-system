import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { averageOf } from "@/lib/teacher/reportsCalculations";
import { getCachedBuiltMonitoringRoster } from "@/lib/admin/adminRosterCache";
import { aggregateUniqueLearners } from "@/lib/admin/academicRecordsMappers";

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

function buildStats({ students, predictionsPending = false }) {
  // Unique learners (worst risk) — enrollment rows inflate Low Risk otherwise.
  const learners = aggregateUniqueLearners(students);
  const riskCounts = {
    [RISK_LEVEL.HIGH]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.LOW]: 0,
  };
  for (const learner of learners) {
    // Skip fully ungraded learners — they must not inflate High/Low risk KPIs.
    if (
      learner.generalAverageValue === null ||
      learner.generalAverageValue === undefined
    ) {
      continue;
    }
    // Count ECR shell risk while RF is pending; only skip blank "—".
    if (learner.riskLevel === "—") continue;
    const key = normalizeRiskLevel(learner.riskLevel);
    if (!key || riskCounts[key] === undefined) continue;
    riskCounts[key] += 1;
  }

  const aralIds = new Set();
  for (const s of students) {
    if (
      s.aralEligible &&
      s.recommendation === RECOMMENDATION.ARAL &&
      s.studentId
    ) {
      aralIds.add(s.studentId);
    }
  }
  const aralCount = aralIds.size;
  // Prefer real numbers on shell paint; optional "Updating…" while RF refines.
  const riskSubtext = predictionsPending
    ? "Updating…"
    : "Click to view learners";

  return [
    {
      id: "high-risk",
      label: RISK_LEVEL.HIGH,
      value: riskCounts[RISK_LEVEL.HIGH],
      subtext: riskSubtext,
      icon: "alert",
      variant: riskCounts[RISK_LEVEL.HIGH] > 0 ? "danger" : "default",
      href: `/monitoring?risk=${encodeURIComponent(RISK_LEVEL.HIGH)}`,
    },
    {
      id: "moderate-risk",
      label: RISK_LEVEL.MODERATE,
      value: riskCounts[RISK_LEVEL.MODERATE],
      subtext: riskSubtext,
      icon: "alert",
      variant: "warning",
      href: `/monitoring?risk=${encodeURIComponent(RISK_LEVEL.MODERATE)}`,
    },
    {
      id: "low-risk",
      label: RISK_LEVEL.LOW,
      value: riskCounts[RISK_LEVEL.LOW],
      subtext: riskSubtext,
      icon: "check",
      variant: "success",
      href: `/monitoring?risk=${encodeURIComponent(RISK_LEVEL.LOW)}`,
    },
    {
      id: "aral",
      label: RECOMMENDATION.ARAL,
      value: aralCount,
      subtext: predictionsPending
        ? "Updating… · Eng / Fil only"
        : "English / Filipino only",
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
  const counts = {
    [RISK_LEVEL.LOW]: 0,
    [RISK_LEVEL.MODERATE]: 0,
    [RISK_LEVEL.HIGH]: 0,
  };

  // Always return all risk buckets (zeros when empty) so the chart shell stays visible.
  if (hasGrades) {
    const learners = aggregateUniqueLearners(students);
    for (const learner of learners) {
      if (learner.riskLevel === "—") continue;
      const key = normalizeRiskLevel(learner.riskLevel);
      if (!key || counts[key] === undefined) continue;
      counts[key] += 1;
    }
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
  ];
}

function buildWeakSubjects(students = [], classes = [], catalog = []) {
  const counts = new Map();

  function registerSubject(value, increment = 0) {
    const subject = String(value ?? "").trim();
    if (!subject) return;

    const key = subject.toLocaleLowerCase();
    const current = counts.get(key) ?? { subject, count: 0 };
    current.count += increment;
    counts.set(key, current);
  }

  for (const row of catalog) {
    registerSubject(row?.subject_name ?? row, 0);
  }

  for (const classRow of classes) {
    const subjectRelation = Array.isArray(classRow.subjects)
      ? classRow.subjects[0]
      : classRow.subjects;
    registerSubject(subjectRelation?.subject_name);
  }

  for (const learner of aggregateUniqueLearners(students)) {
    for (const subject of learner.weakSubjects ?? []) {
      registerSubject(subject, 1);
    }
  }

  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.subject.localeCompare(b.subject)
  );
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
      description = `Principal approved lesson plan from ${teacher}`;
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
      if (s.predictionsPending || s.riskLevel === "—") return false;
      if (s.atRisk) return true;
      if (s.aralEligible && s.recommendation === RECOMMENDATION.ARAL) return true;
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
        riskLevel:
          student.predictionsPending || student.riskLevel === "—"
            ? "—"
            : student.riskLevel || RISK_LEVEL.LOW,
        suggestedIntervention: interventionLabel(student),
        status: mapMonitoringStatusToBadge(student.monitoringStatus),
        classId: student.classId,
        studentId: student.studentId,
        teacherName: student.teacherName || "—",
      };
    });
}

function gradeSortNumber(label) {
  return Number(String(label ?? "").replace(/\D/g, "")) || 0;
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];
}

/** Graded unique learners with a real risk band (same basis as the cards). */
function gradedLearnersWithRisk(students = []) {
  return aggregateUniqueLearners(students).filter((learner) => {
    if (
      learner.generalAverageValue === null ||
      learner.generalAverageValue === undefined
    ) {
      return false;
    }
    if (learner.riskLevel === "—") return false;
    return normalizeRiskLevel(learner.riskLevel) != null;
  });
}

/**
 * Sections with the most learners needing immediate review.
 * Derived from the same roster as the cards — no extra query.
 */
function buildWatchSections(students = [], limit = 4) {
  const counts = new Map();
  for (const learner of gradedLearnersWithRisk(students)) {
    if (normalizeRiskLevel(learner.riskLevel) !== RISK_LEVEL.HIGH) continue;
    const key = learner.gradeSection || learner.section || "Unassigned";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([gradeSection, count]) => ({ gradeSection, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Learners needing support (High + Moderate) per grade level.
 * Same unique-learner basis as the cards, so section/grade totals agree.
 */
function buildSupportByGrade(students = []) {
  const counts = new Map();
  for (const learner of gradedLearnersWithRisk(students)) {
    const risk = normalizeRiskLevel(learner.riskLevel);
    if (risk !== RISK_LEVEL.HIGH && risk !== RISK_LEVEL.MODERATE) continue;
    const grade = learner.grade || "Ungraded";
    counts.set(grade, (counts.get(grade) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => gradeSortNumber(a.grade) - gradeSortNumber(b.grade));
}

/**
 * Per-subject support bands for the Dashboard 11 style table.
 * Each row splits the subject total into Needs Immediate Review (High)
 * and Needs Monitoring (Moderate) — same unique learners as the cards.
 * Rows without subject information are counted separately (never shown
 * as a normal subject).
 */
function buildSubjectSupportBands(students = []) {
  const bands = new Map();
  let unassignedCount = 0;
  for (const learner of gradedLearnersWithRisk(students)) {
    const risk = normalizeRiskLevel(learner.riskLevel);
    if (risk !== RISK_LEVEL.HIGH && risk !== RISK_LEVEL.MODERATE) continue;
    const subjects = uniqueStrings(
      (learner.weakSubjects ?? []).concat(
        risk === RISK_LEVEL.HIGH ? [learner.weakSubject ?? null] : []
      ).filter(Boolean)
    );
    if (!subjects.length) {
      unassignedCount += 1;
      continue;
    }
    for (const subject of subjects) {
      const key = subject.toLocaleLowerCase();
      const entry = bands.get(key) ?? {
        subject,
        total: 0,
        immediate: 0,
        monitoring: 0,
      };
      entry.total += 1;
      if (risk === RISK_LEVEL.HIGH) entry.immediate += 1;
      else entry.monitoring += 1;
      bands.set(key, entry);
    }
  }
  return {
    bands: [...bands.values()].sort(
      (a, b) => b.total - a.total || a.subject.localeCompare(b.subject)
    ),
    unassignedCount,
  };
}

/**
 * Full grade → sections tree for the Grade & Section tab.
 * Every section with learners needing support, not just the top few.
 */
function buildGradeSectionTree(students = []) {
  const grades = new Map();
  for (const learner of gradedLearnersWithRisk(students)) {
    const risk = normalizeRiskLevel(learner.riskLevel);
    if (risk !== RISK_LEVEL.HIGH && risk !== RISK_LEVEL.MODERATE) continue;
    const grade = learner.grade || "Ungraded";
    const section = learner.gradeSection || learner.section || "Unassigned";
    if (!grades.has(grade)) grades.set(grade, new Map());
    const sections = grades.get(grade);
    sections.set(section, (sections.get(section) ?? 0) + 1);
  }
  return [...grades.entries()]
    .map(([grade, sections]) => ({
      grade,
      total: [...sections.values()].reduce((sum, n) => sum + n, 0),
      sections: [...sections.entries()]
        .map(([gradeSection, count]) => ({ gradeSection, count }))
        .sort((a, b) => b.count - a.count || a.gradeSection.localeCompare(b.gradeSection)),
    }))
    .sort((a, b) => gradeSortNumber(a.grade) - gradeSortNumber(b.grade));
}

function termLabelForQuarter(quarter) {
  const n = Number(quarter);
  if (n === 4) return "Final";
  if (Number.isFinite(n) && n >= 1) return `Term ${n}`;
  return null;
}

/**
 * Per-term support trend from the roster's own quarters (equivalent,
 * consecutive terms within the school year — never mixed-year comparison).
 */
function buildTermTrends(students = []) {
  const byQuarter = new Map();
  for (const row of students) {
    const q = Number(row.quarterNumber ?? row.quarter);
    if (!Number.isFinite(q) || q < 1) continue;
    const bucket = byQuarter.get(q) ?? [];
    bucket.push(row);
    byQuarter.set(q, bucket);
  }
  return [...byQuarter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([quarter, rows]) => {
      const learners = aggregateUniqueLearners(rows).filter((learner) => {
        if (
          learner.generalAverageValue === null ||
          learner.generalAverageValue === undefined
        ) {
          return false;
        }
        if (learner.riskLevel === "—") return false;
        return normalizeRiskLevel(learner.riskLevel) != null;
      });
      let needReview = 0;
      let doingWell = 0;
      let high = 0;
      let moderate = 0;
      let low = 0;
      for (const learner of learners) {
        const risk = normalizeRiskLevel(learner.riskLevel);
        if (risk === RISK_LEVEL.HIGH || risk === RISK_LEVEL.MODERATE) {
          needReview += 1;
        } else if (risk === RISK_LEVEL.LOW) {
          doingWell += 1;
        }
        if (risk === RISK_LEVEL.HIGH) high += 1;
        else if (risk === RISK_LEVEL.MODERATE) moderate += 1;
        else if (risk === RISK_LEVEL.LOW) low += 1;
      }
      return {
        quarter,
        term: termLabelForQuarter(quarter) ?? `Term ${quarter}`,
        needReview,
        doingWell,
        high,
        moderate,
        low,
      };
    });
}

/**
 * Build the Admin Dashboard UI model from the school-wide bundle.
 * Reuses buildMonitoringRoster → recommendationService + subject policy.
 */
export async function buildAdminDashboardModel(bundle, rosterOverride = null) {
  const profile = bundle?.profile ?? null;
  const rosterPayload = bundle?.roster ?? {
    classes: [],
    enrollments: [],
    grades: [],
    monitoringRecords: [],
  };

  const roster =
    rosterOverride ??
    (await getCachedBuiltMonitoringRoster(rosterPayload, {
      schoolYear: bundle?.schoolYear ?? null,
      quarter: null,
    }));
  const students = roster.students ?? [];
  const classSummaries = roster.classSummaries ?? [];
  const predictionsPending = Boolean(roster.predictionsPending);
  const hasGrades = (rosterPayload.grades ?? []).length > 0;
  const hasClasses = (rosterPayload.classes ?? []).length > 0;
  const hasStudents =
    (bundle?.studentCount ?? 0) > 0 || students.length > 0;

  const adminName = firstNameFromProfile(profile);
  const fullName = profile?.full_name?.trim() || "Admin";
  const { bands: subjectBands, unassignedCount: subjectUnassignedCount } =
    buildSubjectSupportBands(students);

  return {
    profile: {
      name: fullName,
      firstName: adminName,
      role: "Principal",
    },
    welcomeDescription: `Welcome back, ${adminName}. Here is today's learner risk overview.`,
    schoolYear: bundle?.schoolYear ?? null,
    stats: buildStats({ students, predictionsPending }),
    academicPerformance: buildAcademicPerformance(students),
    riskDistribution: buildRiskDistribution(students, hasGrades),
    weakSubjects: buildWeakSubjects(
      students,
      rosterPayload.classes ?? [],
      bundle?.subjects ?? []
    ),
    recentActivity: buildRecentActivity(bundle?.activitySources ?? {}),
    priorityLearners: buildPriorityLearners(students),
    watchSections: buildWatchSections(students),
    supportByGrade: buildSupportByGrade(students),
    subjectBands,
    subjectUnassignedCount,
    gradeSectionTree: buildGradeSectionTree(students),
    termTrends: buildTermTrends(students),
    pendingLessonPlans: bundle?.pendingLessonPlans ?? 0,
    pendingAralReferrals: bundle?.pendingAralReferrals ?? 0,
    aralPipeline: bundle?.aralPipeline ?? {
      pending: 0,
      waiting: 0,
      active: 0,
      completed: 0,
      referred: 0,
      approved: 0,
      assessed: 0,
    },
    aralAttention: bundle?.aralAttention ?? {
      unassignedFacilitator: 0,
    },
    meta: {
      hasGrades,
      hasClasses,
      hasStudents,
      classCount: classSummaries.length,
      enrollmentCount: students.length,
      predictionsPending,
    },
  };
}
