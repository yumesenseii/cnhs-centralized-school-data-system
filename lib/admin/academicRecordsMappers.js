/**
 * Map school-wide monitoring roster → Academic Records UI model.
 * Same ECR grades / risk source as Admin Reports (no SF2 attendance).
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
  averageFromSubjectGrades,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import {
  buildMonitoringRoster,
  initialsFromName,
} from "@/lib/teacher/monitoringMappers";
import { QUARTER_OPTIONS } from "@/lib/teacher/reportsConstants";
import { termLabel } from "@/lib/academic/termLabels";

function riskRank(riskLevel) {
  const normalized = normalizeRiskLevel(riskLevel);
  if (normalized === RISK_LEVEL.HIGH) return 0;
  if (normalized === RISK_LEVEL.MODERATE) return 1;
  return 2;
}

function recommendationDisplay(studentRows = []) {
  const hasAral = studentRows.some(
    (row) =>
      row.aralEligible && row.recommendation === RECOMMENDATION.ARAL
  );
  if (hasAral) return RECOMMENDATION.ARAL;

  const hasRemedial = studentRows.some(
    (row) =>
      row.recommendation === RECOMMENDATION.REMEDIATION ||
      (row.belowPassing && !row.aralEligible)
  );
  if (hasRemedial) {
    return "Recommended for Teacher-Based Classroom Remediation";
  }

  return "No recommendation";
}

function reviewStatusForLearner(studentRows = []) {
  const hasGrades = studentRows.some(
    (row) =>
      (row.subjectGrades ?? []).some((g) => {
        const n = Number(g.grade ?? g.finalGrade);
        return Number.isFinite(n);
      }) ||
      (row.classSubjectGrade !== null &&
        row.classSubjectGrade !== undefined &&
        Number.isFinite(Number(row.classSubjectGrade)))
  );
  return hasGrades ? "Validated" : "Pending Review";
}

function mergeSubjectGrades(rows = []) {
  const bySubject = new Map();
  for (const row of rows) {
    for (const grade of row.subjectGrades ?? []) {
      const subject = grade.subject ?? grade.subjectName;
      if (!subject) continue;
      const value = grade.grade ?? grade.finalGrade;
      if (value === null || value === undefined || value === "") continue;
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      // Prefer lowest grade when the same subject appears across class rows.
      const prev = bySubject.get(subject);
      if (prev == null || n < prev) bySubject.set(subject, n);
    }
  }
  return [...bySubject.entries()].map(([subject, grade]) => ({
    subject,
    grade,
  }));
}

/**
 * Collapse per-class enrollment rows into one learner record (GWA + worst risk).
 */
export function aggregateUniqueLearners(rosterStudents = []) {
  const byStudent = new Map();

  for (const row of rosterStudents) {
    const key = row.studentId;
    if (!key) continue;
    const bucket = byStudent.get(key) ?? { rows: [] };
    bucket.rows.push(row);
    byStudent.set(key, bucket);
  }

  const learners = [];

  for (const { rows } of byStudent.values()) {
    const primary = rows[0];
    const mergedGrades = mergeSubjectGrades(rows);
    const generalAverage = averageFromSubjectGrades(mergedGrades);
    const weakSubjects = mergedGrades
      .filter((g) => Number(g.grade) < 75)
      .map((g) => g.subject);
    const worstRisk = rows
      .map((r) => normalizeRiskLevel(r.riskLevel))
      .sort((a, b) => riskRank(a) - riskRank(b))[0];

    learners.push({
      id: primary.studentId,
      studentId: primary.studentId,
      studentNumber: primary.studentNumber || "—",
      studentName: primary.name,
      initials: primary.initials || initialsFromName(primary.name),
      grade: primary.grade,
      gradeSection: primary.gradeSection,
      section: primary.section,
      generalAverage: generalAverage ?? 0,
      generalAverageValue: generalAverage,
      weakSubject: weakSubjects[0] ?? null,
      weakSubjects,
      riskLevel: worstRisk || RISK_LEVEL.LOW,
      systemRecommendation: recommendationDisplay(rows),
      reviewStatus: reviewStatusForLearner(rows),
      teacherNames: [
        ...new Set(rows.map((r) => r.teacherName).filter(Boolean)),
      ],
      schoolYear: primary.schoolYear,
      quarter: primary.quarter,
    });
  }

  learners.sort((a, b) => {
    const riskDiff = riskRank(a.riskLevel) - riskRank(b.riskLevel);
    if (riskDiff !== 0) return riskDiff;
    return String(a.studentName).localeCompare(String(b.studentName));
  });

  return learners;
}

function buildGradeSummary(learners = []) {
  const buckets = new Map();

  for (const learner of learners) {
    const label = learner.grade?.startsWith("Grade")
      ? learner.grade
      : learner.grade
        ? `Grade ${learner.grade}`
        : null;
    if (!label) continue;

    const entry = buckets.get(label) ?? {
      grade: label,
      students: 0,
      priority: 0,
      moderate: 0,
      low: 0,
    };
    entry.students += 1;
    const risk = normalizeRiskLevel(learner.riskLevel);
    if (risk === RISK_LEVEL.HIGH) entry.priority += 1;
    else if (risk === RISK_LEVEL.MODERATE) entry.moderate += 1;
    else entry.low += 1;
    buckets.set(label, entry);
  }

  return [...buckets.values()].sort((a, b) => {
    const ga = Number(String(a.grade).replace(/\D/g, "")) || 0;
    const gb = Number(String(b.grade).replace(/\D/g, "")) || 0;
    return ga - gb;
  });
}

function relativeDayLabel(value) {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function buildTeacherSubmissions(classSummaries = []) {
  const byTeacher = new Map();

  for (const classInfo of classSummaries) {
    const teacherKey =
      classInfo.teacherId || classInfo.teacherName || "unknown";
    const entry = byTeacher.get(teacherKey) ?? {
      teacherId: classInfo.teacherId,
      teacher: (classInfo.teacherName || "Teacher").split(/\s+/)[0],
      fullName: classInfo.teacherName || "Teacher",
      initials: initialsFromName(classInfo.teacherName || "Teacher"),
      classes: 0,
      gradedClasses: 0,
      latestDate: null,
    };
    entry.classes += 1;
    const graded =
      (classInfo.gradedStudentCount ?? 0) > 0 ||
      (classInfo.students ?? []).some(
        (s) =>
          s.classSubjectGrade !== null &&
          s.classSubjectGrade !== undefined &&
          Number.isFinite(Number(s.classSubjectGrade))
      );
    if (graded) entry.gradedClasses += 1;

    for (const student of classInfo.students ?? []) {
      const raw = student.latestObservationDate;
      if (!raw || raw === "—") continue;
      const ts = Date.parse(raw);
      if (!Number.isFinite(ts)) continue;
      if (!entry.latestDate || ts > entry.latestDate) entry.latestDate = ts;
    }

    byTeacher.set(teacherKey, entry);
  }

  const submissions = [...byTeacher.values()]
    .map((entry) => {
      const uploaded = entry.gradedClasses > 0;
      return {
        teacher: entry.teacher,
        fullName: entry.fullName,
        initials: entry.initials,
        submissionDate: uploaded
          ? relativeDayLabel(
              entry.latestDate ? new Date(entry.latestDate).toISOString() : null
            )
          : "—",
        uploadStatus: uploaded ? "Uploaded" : "Not Sub.",
        validationStatus: uploaded ? "Validated" : "—",
      };
    })
    .sort((a, b) => {
      if (a.uploadStatus !== b.uploadStatus) {
        return a.uploadStatus === "Uploaded" ? -1 : 1;
      }
      return a.teacher.localeCompare(b.teacher);
    });

  const submitted = submissions.filter((s) => s.uploadStatus === "Uploaded")
    .length;
  const total = submissions.length;
  const percent = total ? Math.round((submitted / total) * 100) : 0;

  return {
    submissions,
    submissionProgress: {
      label: `${submitted} of ${total} submitted`,
      percent,
    },
  };
}

function buildRecentUploadActivity(classSummaries = []) {
  return classSummaries
    .map((classInfo) => {
      const graded = (classInfo.gradedStudentCount ?? 0) > 0;
      const latest = (classInfo.students ?? [])
        .map((s) => s.latestObservationDate)
        .filter((d) => d && d !== "—")
        .sort()
        .at(-1);

      return {
        teacher: classInfo.teacherName || "Teacher",
        initials: initialsFromName(classInfo.teacherName || "Teacher"),
        assignedClass: `${classInfo.subject} ${classInfo.gradeSection}`.trim(),
        submissionDate: graded ? relativeDayLabel(latest) : "—",
        reviewStatus: graded ? "Validated" : "Pending Validation",
        sortKey: latest && latest !== "—" ? Date.parse(latest) || 0 : 0,
        graded,
      };
    })
    .sort((a, b) => {
      if (a.graded !== b.graded) return a.graded ? -1 : 1;
      return b.sortKey - a.sortKey;
    })
    .slice(0, 12)
    .map(({ sortKey: _s, graded: _g, ...rest }) => rest);
}

export function pickDefaultSchoolYear(classes = [], schoolYears = []) {
  if (!schoolYears.length) return "";
  const counts = new Map();
  for (const row of classes) {
    const year = row.school_year ?? row.schoolYear;
    if (!year) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const ranked = [...schoolYears].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );
  return ranked[0] || schoolYears[0];
}

/**
 * Build Academic Records page model from the same roster payload Reports uses.
 */
export async function buildAcademicRecordsModel({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  schoolYears = [],
  filters = {},
} = {}) {
  const roster = await buildMonitoringRoster({
    classes,
    enrollments,
    grades,
    monitoringRecords,
  });

  const learners = aggregateUniqueLearners(roster.students);
  const gradeSummary = buildGradeSummary(learners);
  const { submissions, submissionProgress } = buildTeacherSubmissions(
    roster.classSummaries
  );
  const recentUploadActivity = buildRecentUploadActivity(roster.classSummaries);

  const validatedCount = learners.filter(
    (l) => l.reviewStatus === "Validated"
  ).length;
  const pendingCount = learners.filter(
    (l) => l.reviewStatus === "Pending Review"
  ).length;
  const priorityCount = learners.filter(
    (l) => normalizeRiskLevel(l.riskLevel) === RISK_LEVEL.HIGH
  ).length;
  const classesWithGrades = roster.classSummaries.filter(
    (c) => (c.gradedStudentCount ?? 0) > 0
  ).length;
  const teachersWithUploads = submissions.filter(
    (s) => s.uploadStatus === "Uploaded"
  ).length;

  const summaryCards = [
    {
      id: "total-learners",
      label: "Total Learners",
      value: learners.length,
      subtext: "Unique learners (ECR)",
      icon: "graduation",
      tone: "green",
    },
    {
      id: "uploaded",
      label: "Records Uploaded",
      value: classesWithGrades,
      subtext: "Classes with grades",
      icon: "upload",
      tone: "green",
    },
    {
      id: "pending-validation",
      label: "Pending Validation",
      value: pendingCount,
      subtext: "No grades yet",
      icon: "hourglass",
      tone: "orange",
    },
    {
      id: "priority-learners",
      label: "Priority Learners",
      value: priorityCount,
      subtext: "High Risk (grades only)",
      icon: "alert",
      tone: "red",
    },
    {
      id: "recent-uploads",
      label: "Teacher Uploads",
      value: teachersWithUploads,
      subtext: "Teachers with grades",
      icon: "file",
      tone: "blue",
    },
  ];

  const gradesList = [
    "All Grades",
    ...new Set(learners.map((l) => l.grade).filter(Boolean)),
  ].sort((a, b) => {
    if (a === "All Grades") return -1;
    if (b === "All Grades") return 1;
    return (
      (Number(String(a).replace(/\D/g, "")) || 0) -
      (Number(String(b).replace(/\D/g, "")) || 0)
    );
  });

  const sectionsList = [
    "All Sections",
    ...new Set(learners.map((l) => l.section).filter(Boolean)),
  ].sort((a, b) => {
    if (a === "All Sections") return -1;
    if (b === "All Sections") return 1;
    return String(a).localeCompare(String(b));
  });

  const teachersList = [
    "All Teachers",
    ...new Set(
      roster.classSummaries.map((c) => c.teacherName).filter(Boolean)
    ),
  ].sort((a, b) => {
    if (a === "All Teachers") return -1;
    if (b === "All Teachers") return 1;
    return String(a).localeCompare(String(b));
  });

  const validatedPercent = learners.length
    ? Math.round((validatedCount / learners.length) * 100)
    : 0;
  const pendingPercent = learners.length
    ? Math.round((pendingCount / learners.length) * 100)
    : 0;

  const periodLabel = [
    filters.quarter
      ? QUARTER_OPTIONS.find((q) => q.value === String(filters.quarter))
          ?.label || termLabel(filters.quarter)
      : "All Terms",
    filters.schoolYear || "All School Years",
  ].join(" · ");

  return {
    summaryCards,
    gradeSummary,
    students: learners,
    filters: {
      grades: gradesList,
      sections: sectionsList,
      risks: [
        "All Risk Levels",
        RISK_LEVEL.HIGH,
        RISK_LEVEL.MODERATE,
        RISK_LEVEL.LOW,
      ],
      teachers: teachersList,
    },
    teacherSubmissions: submissions,
    submissionProgress,
    validationSummary: [
      {
        label: "Validated Records",
        value: validatedCount,
        percent: validatedPercent,
        tone: "green",
      },
      {
        label: "Pending Validation",
        value: pendingCount,
        percent: pendingPercent,
        tone: "orange",
      },
      {
        label: "Needs Correction",
        value: 0,
        percent: 0,
        tone: "red",
      },
    ],
    validationLastUpdated: new Date().toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    academicAnalysis: {
      status: grades.length ? "Completed" : "Waiting",
      lastAnalysis: new Date().toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      recordsProcessed: grades.length,
      learnersRequiringIntervention: learners.filter(
        (l) =>
          normalizeRiskLevel(l.riskLevel) === RISK_LEVEL.HIGH ||
          normalizeRiskLevel(l.riskLevel) === RISK_LEVEL.MODERATE
      ).length,
    },
    recentUploadActivity,
    periodLabel,
    schoolYears:
      schoolYears.length > 0
        ? schoolYears
        : [
            ...new Set(
              classes
                .map((c) => c.school_year ?? c.schoolYear)
                .filter(Boolean)
            ),
          ].sort((a, b) => String(b).localeCompare(String(a))),
    defaultSchoolYear: pickDefaultSchoolYear(classes, schoolYears),
    meta: {
      classCount: roster.classSummaries.length,
      enrollmentRows: roster.students.length,
      uniqueLearners: learners.length,
      gradeCount: grades.length,
    },
  };
}
