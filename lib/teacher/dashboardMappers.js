import {
  MONITORING_STATUS,
  normalizeRiskLevel,
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";
import { getCachedBuiltTeacherRoster } from "@/lib/teacher/teacherRosterCache";
import { collectClassSubjectGrades } from "@/lib/teacher/reportsCalculations";

const QUICK_ACTIONS = [
  {
    id: "upload-eclass",
    title: "Upload E-Class Record",
    description: "Submit academic records",
    icon: "upload",
    href: "/teacher/my-classes",
  },
  {
    id: "upload-lesson-plan",
    title: "Upload Lesson Plan",
    description: "Submit weekly lesson plans",
    icon: "file",
    href: "/teacher/lesson-plans/upload",
  },
  {
    id: "open-monitoring",
    title: "Open Monitoring",
    description: "Record learner observations",
    icon: "clipboard",
    href: "/teacher/monitoring",
  },
  {
    id: "view-classes",
    title: "View My Classes",
    description: "Open class overview",
    icon: "classes",
    href: "/teacher/my-classes",
  },
];

function unwrap(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function dateValue(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function lessonPlanForClass(plans, classId) {
  return plans
    .filter((plan) => plan.class_id === classId)
    .sort(
      (a, b) =>
        dateValue(b.updated_at ?? b.submitted_at) -
        dateValue(a.updated_at ?? a.submitted_at)
    )[0];
}

function monitoringProgressLabel(status) {
  if (status === MONITORING_STATUS.IMPROVED) return "Improving";
  if (status === MONITORING_STATUS.COMPLETED) return "Stable";
  if (status === MONITORING_STATUS.NEEDS_FOLLOW_UP) return "Needs Attention";
  return "Observation Needed";
}

function buildTasks(classRows, lessonPlans, learners) {
  const tasks = [];

  for (const row of classRows) {
    if (row.academicRecord === "Pending") {
      tasks.push({
        id: `grades-${row.id}`,
        title: `Upload Quarter ${row.quarterNumber} E-Class Record`,
        subtitle: `${row.gradeSection} · ${row.subject}`,
        deadline: "No deadline set",
        priority: "High Priority",
        status: "Pending",
        completed: false,
      });
    }

    const plan = lessonPlanForClass(lessonPlans, row.id);
    if (!plan || plan.status === "Needs Revision") {
      tasks.push({
        id: `lesson-${row.id}`,
        title: plan ? "Revise Lesson Plan" : "Submit Lesson Plan",
        subtitle: `${row.gradeSection} · ${row.subject}`,
        deadline: "No deadline set",
        priority: plan ? "High Priority" : "Medium",
        status: "Pending",
        completed: false,
      });
    }
  }

  const followUpCount = learners.filter(
    (student) =>
      student.monitoringStatus === MONITORING_STATUS.NEEDS_FOLLOW_UP ||
      student.followUpNeeded
  ).length;
  if (followUpCount) {
    tasks.push({
      id: "monitoring-follow-up",
      title: "Update Learner Monitoring",
      subtitle: `${followUpCount} learner${followUpCount === 1 ? "" : "s"} need follow-up`,
      deadline: "Action required",
      priority: "High Priority",
      status: "Pending",
      completed: false,
    });
  }

  return { count: tasks.length, items: tasks.slice(0, 5) };
}

function buildRecentActivities(lessonPlans, monitoringRecords, students) {
  const studentById = new Map(students.map((student) => [student.studentId, student]));
  const activities = [];

  for (const plan of lessonPlans) {
    const classInfo = unwrap(plan.classes);
    const subject = unwrap(classInfo?.subjects)?.subject_name ?? "Subject";
    const section = unwrap(classInfo?.sections);
    const gradeSection = section
      ? `Grade ${section.grade_level} ${section.section_name}`
      : "Assigned class";
    const when = plan.reviewed_at ?? plan.updated_at ?? plan.submitted_at;
    activities.push({
      id: `plan-${plan.id}`,
      title:
        plan.status === "Approved"
          ? "Lesson Plan Approved"
          : plan.status === "Needs Revision"
            ? "Lesson Plan Needs Revision"
            : "Lesson Plan Submitted",
      description: `${plan.lesson_title} · ${gradeSection} · ${subject}`,
      time: formatDate(when),
      timestamp: dateValue(when),
      icon: plan.status === "Approved" ? "check" : "clipboard",
      tone:
        plan.status === "Approved"
          ? "green"
          : plan.status === "Needs Revision"
            ? "orange"
            : "blue",
    });
  }

  for (const record of monitoringRecords) {
    const student = studentById.get(record.student_id);
    activities.push({
      id: `monitoring-${record.id}`,
      title: "Monitoring Record Updated",
      description: student
        ? `${student.name} · ${student.gradeSection} · ${record.monitoring_status}`
        : `Learner monitoring · ${record.monitoring_status}`,
      time: formatDate(record.updated_at ?? record.created_at),
      timestamp: dateValue(record.updated_at ?? record.created_at),
      icon: "clipboard",
      tone:
        record.monitoring_status === MONITORING_STATUS.COMPLETED
          ? "green"
          : "orange",
    });
  }

  return activities
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5)
    .map(({ timestamp: _timestamp, ...activity }) => activity);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
}

function buildMonitoringProgress(students, records) {
  const completed = students.filter(
    (student) => student.monitoringStatus === MONITORING_STATUS.COMPLETED
  ).length;
  const overdue = students.filter(
    (student) => student.monitoringStatus === MONITORING_STATUS.NEEDS_FOLLOW_UP
  ).length;
  const pending = students.filter(
    (student) =>
      student.monitoringStatus === MONITORING_STATUS.ONGOING ||
      student.monitoringStatus === MONITORING_STATUS.IMPROVED
  ).length;

  const currentWeek = startOfWeek(new Date());
  const monitoredCount = Math.max(
    1,
    new Set(records.map((record) => record.student_id).filter(Boolean)).size
  );

  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(currentWeek);
    start.setDate(start.getDate() - (3 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const observed = new Set(
      records
        .filter((record) => {
          const time = dateValue(record.observation_date);
          return time >= start.getTime() && time < end.getTime();
        })
        .map((record) => record.student_id)
        .filter(Boolean)
    ).size;

    return {
      id: `week-${start.toISOString().slice(0, 10)}`,
      label: start.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      }),
      percent: Math.min(100, Math.round((observed / monitoredCount) * 100)),
    };
  });

  return { completed, pending, overdue, weeks };
}

export async function buildTeacherDashboardModel({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  lessonPlans = [],
  schoolYear,
  quarter,
  teacherId = null,
  roster: rosterOverride = null,
} = {}) {
  // Score once for the teacher; filter by SY/term after so Dashboard ↔ Monitoring share cache.
  const fullRoster =
    rosterOverride ??
    (await getCachedBuiltTeacherRoster(
      {
        classes,
        enrollments,
        grades,
        monitoringRecords,
      },
      { teacherId }
    ));

  const classSummaries = (fullRoster.classSummaries ?? []).filter((row) => {
    if (schoolYear && row.schoolYear !== schoolYear) return false;
    if (quarter && Number(row.quarter) !== Number(quarter)) return false;
    return true;
  });
  const classIds = new Set(classSummaries.map((row) => row.id));
  const filteredEnrollments = enrollments.filter((row) =>
    classIds.has(row.class_id)
  );
  const filteredMonitoring = monitoringRecords.filter((row) =>
    classIds.has(row.class_id)
  );
  const filteredPlans = lessonPlans.filter((plan) => {
    if (!classIds.has(plan.class_id)) return false;
    if (schoolYear && plan.school_year !== schoolYear) return false;
    if (quarter && Number(plan.quarter) !== Number(quarter)) return false;
    return true;
  });
  const roster = {
    ...fullRoster,
    classSummaries,
    students: (fullRoster.students ?? []).filter((s) => classIds.has(s.classId)),
  };

  const classRows = roster.classSummaries.map((classInfo) => {
    const subjectGrades = collectClassSubjectGrades({
      classId: classInfo.id,
      subjectId: classInfo.subjectId,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
      enrollments: filteredEnrollments,
      grades,
    });
    const plan = lessonPlanForClass(filteredPlans, classInfo.id);

    return {
      id: classInfo.id,
      subject: classInfo.subject,
      gradeSection: classInfo.gradeSection,
      students: classInfo.totalStudents,
      aralLearners: classInfo.aralEligible ? classInfo.aralCount : "—",
      classroomRemedial: classInfo.classroomRemedialRecommended
        ? "Recommended"
        : "Not Needed",
      academicRecord: subjectGrades.length ? "Submitted" : "Pending",
      lessonPlan: plan?.status ?? "Pending",
      quarterNumber: classInfo.quarter,
    };
  });

  const learnersAttention = roster.students
    .filter(
      (student) =>
        !student.predictionsPending &&
        student.riskLevel !== "—" &&
        student.hasClassSubjectGrade &&
        student.atRisk
    )
    .map((student) => ({
      id: student.id,
      studentId: student.studentId,
      classId: student.classId,
      name: student.name,
      firstName: student.firstName ?? null,
      middleName: student.middleName ?? null,
      lastName: student.lastName ?? null,
      initials: student.initials,
      avatarTone: student.avatarTone,
      gradeSection: student.gradeSection,
      weakSubject: student.subject,
      currentGrade: student.classSubjectGrade ?? "—",
      riskLevel: student.riskLevel,
      intervention: student.aralEligible
        ? student.recommendationDisplay
        : "Classroom Remedial (Class-Level)",
      progress: monitoringProgressLabel(student.monitoringStatus),
    }));

  const studentRecommendations = roster.students
    .filter(
      (student) =>
        student.aralEligible &&
        student.recommendation === RECOMMENDATION.ARAL
    )
    .map((student) => ({
      id: `student-${student.id}`,
      learner: student.name,
      firstName: student.firstName ?? null,
      middleName: student.middleName ?? null,
      lastName: student.lastName ?? null,
      isLearner: true,
      recommendation: RECOMMENDATION.ARAL,
      reason: student.recommendationReason || `${student.subject} below passing`,
      href: `/teacher/monitoring/${student.classId}/students/${student.studentId}`,
    }));

  const classRecommendations = roster.classSummaries
    .filter((classInfo) => classInfo.classroomRemedialRecommended)
    .map((classInfo) => ({
      id: `class-${classInfo.id}`,
      learner: classInfo.gradeSection,
      isLearner: false,
      recommendation: "Classroom Remedial Recommended",
      reason: `${classInfo.belowPassingCount} of ${classInfo.gradedStudentCount} graded learners are below passing in ${classInfo.subject}.`,
      href: `/teacher/my-classes/${classInfo.id}`,
    }));

  const learnersUnderMonitoring = roster.students.filter(
    (student) =>
      student.monitoringStatus &&
      student.monitoringStatus !== MONITORING_STATUS.NOT_STARTED
  ).length;
  const pendingRecords = classRows.filter(
    (row) => row.academicRecord === "Pending"
  ).length;
  const pendingPlans = filteredPlans.filter((plan) =>
    ["Pending Review", "Under Review", "Needs Revision"].includes(plan.status)
  ).length;

  let highRisk = 0;
  let moderateRisk = 0;
  let lowRisk = 0;
  let aralLearners = 0;
  for (const student of roster.students) {
    // Ungraded enrollments are not part of High/Moderate/Low risk KPIs.
    if (!student.hasClassSubjectGrade) continue;
    // Count ECR shell risk while RF is pending; only skip blank "—".
    if (student.riskLevel === "—") continue;
    const risk = normalizeRiskLevel(student.riskLevel);
    if (risk === RISK_LEVEL.HIGH) highRisk += 1;
    else if (risk === RISK_LEVEL.MODERATE) moderateRisk += 1;
    else if (risk === RISK_LEVEL.LOW) lowRisk += 1;
    if (
      student.aralEligible &&
      student.recommendation === RECOMMENDATION.ARAL
    ) {
      aralLearners += 1;
    }
  }

  const enrolledTotal = roster.students.length;
  const termHelper = roster.predictionsPending
    ? `Updating… · of ${enrolledTotal}`
    : `of ${enrolledTotal} · Term ${quarter}`;
  const primaryClass = classRows[0] ?? null;

  return {
    controls: {
      schoolYear,
      quarter: `Term ${quarter}`,
      // Date is set client-side only (avoids SSR/client hydration mismatch).
      currentDate: "",
    },
    // Admin StatCard-compatible risk metrics (ECR grades only).
    stats: [
      {
        id: "high-risk",
        label: "High Risk",
        value: highRisk,
        subtext: termHelper,
        icon: "alert",
        variant: "danger",
        href: "/teacher/monitoring",
      },
      {
        id: "moderate-risk",
        label: "Moderate Risk",
        value: moderateRisk,
        subtext: termHelper,
        icon: "alert",
        variant: "warning",
        href: "/teacher/monitoring",
      },
      {
        id: "low-risk",
        label: "Low Risk",
        value: lowRisk,
        subtext: termHelper,
        icon: "check",
        variant: "success",
        href: "/teacher/monitoring",
      },
      {
        id: "aral-learners",
        label: "ARAL Learners",
        value: aralLearners,
        subtext: roster.predictionsPending
          ? "Updating… · Eng/Fil only"
          : "Eng/Fil only · Term " + quarter,
        icon: "users",
        variant: "danger",
        href: "/teacher/monitoring",
      },
    ],
    primaryClassId: primaryClass?.id ?? null,
    primaryClassLabel: primaryClass
      ? `${primaryClass.subject}`
      : null,
    // Kept for any legacy consumers; Academic Analytics shell uses `stats`.
    kpis: [
      {
        id: "classes",
        label: "My Classes",
        value: classRows.length,
        description: "Assigned subject and section offerings.",
        icon: "book",
        tone: "green",
      },
      {
        id: "monitoring",
        label: "Learners Under Monitoring",
        value: learnersUnderMonitoring,
        description:
          "Active monitoring records (not all at-risk learners).",
        icon: "users",
        tone: "blue",
      },
      {
        id: "pending-records",
        label: "Pending E-Class Records",
        value: pendingRecords,
        description: "Assigned classes without recorded quarterly grades.",
        icon: "file",
        tone: "orange",
        alert: pendingRecords > 0,
      },
      {
        id: "lesson-plans",
        label: "Lesson Plans Pending Review",
        value: pendingPlans,
        description: "Submitted plans not yet approved.",
        icon: "clipboard",
        tone: "red",
        alert: pendingPlans > 0,
      },
    ],
    todaysTasks: buildTasks(classRows, filteredPlans, roster.students),
    classes: classRows,
    recentActivities: buildRecentActivities(
      filteredPlans,
      filteredMonitoring,
      roster.students
    ),
    learnersAttention,
    monitoringProgress: buildMonitoringProgress(
      roster.students,
      filteredMonitoring
    ),
    systemRecommendations: [
      ...studentRecommendations,
      ...classRecommendations,
    ].slice(0, 6),
    quickActions: QUICK_ACTIONS,
    // There is no deadline column/table in the current schema.
    upcomingDeadlines: [],
    // Exposed so notification syncing can reuse the recommendations that were
    // already generated here instead of recomputing them.
    roster,
  };
}
