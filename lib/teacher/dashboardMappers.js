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
    href: "/teacher/lesson-plans/upload?fresh=1",
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
        actionLabel: "Enter Grades",
        href: `/teacher/my-classes/${row.id}`,
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
        actionLabel: plan ? "Revise Plan" : "Submit Plan",
        href: plan
          ? `/teacher/lesson-plans/${plan.id}`
          : "/teacher/lesson-plans/upload?fresh=1",
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
      actionLabel: "View Learners",
      href: "/teacher/monitoring",
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
  attendanceAnalytics = null,
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

    const sectionAttendance = (attendanceAnalytics?.rows ?? []).find(
      (r) => r.section_id === classInfo.sectionId
    );
    const attendanceVal =
      sectionAttendance?.pa != null
        ? `${sectionAttendance.pa}%`
        : attendanceAnalytics?.avgPa != null
          ? `${attendanceAnalytics.avgPa}%`
          : "—";

    let planStatus = "Not Submitted";
    if (plan?.status) {
      planStatus =
        plan.status === "Pending" ? "Pending Review" : plan.status;
    }

    return {
      id: classInfo.id,
      subject: classInfo.subject,
      gradeSection: classInfo.gradeSection,
      students: classInfo.totalStudents,
      attendance: attendanceVal,
      needsAttention: classInfo.studentsAtRisk ?? 0,
      aralLearners: classInfo.aralEligible ? classInfo.aralCount : "—",
      classroomRemedial: classInfo.classroomRemedialRecommended
        ? "Recommended"
        : "Not Needed",
      academicRecord: subjectGrades.length ? "Submitted" : "Pending",
      lessonPlan: planStatus,
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
      href:
        student.classId && student.studentId
          ? `/teacher/monitoring/${student.classId}/students/${student.studentId}`
          : "/teacher/monitoring",
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
  const approvedPlans = filteredPlans.filter(
    (plan) => plan.status === "Approved"
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

  // Calculate Previous School Year stats
  let prevSchoolYear = null;
  if (schoolYear && schoolYear.startsWith("SY ")) {
    const parts = schoolYear.replace("SY ", "").split("-");
    if (parts.length === 2) {
      prevSchoolYear = `SY ${Number(parts[0]) - 1}-${Number(parts[1]) - 1}`;
    }
  }

  const prevClassSummaries = (fullRoster.classSummaries ?? []).filter((row) => {
    if (prevSchoolYear && row.schoolYear !== prevSchoolYear) return false;
    if (quarter && Number(row.quarter) !== Number(quarter)) return false;
    return true;
  });
  const prevClassIds = new Set(prevClassSummaries.map((row) => row.id));
  const prevStudents = (fullRoster.students ?? []).filter((s) => prevClassIds.has(s.classId));

  let prevHighRisk = 0;
  let prevModerateRisk = 0;
  let prevLowRisk = 0;
  for (const student of prevStudents) {
    if (!student.hasClassSubjectGrade) continue;
    if (student.riskLevel === "—") continue;
    const risk = normalizeRiskLevel(student.riskLevel);
    if (risk === RISK_LEVEL.HIGH) prevHighRisk += 1;
    else if (risk === RISK_LEVEL.MODERATE) prevModerateRisk += 1;
    else if (risk === RISK_LEVEL.LOW) prevLowRisk += 1;
  }

  // Calculate Previous Term stats
  const currentQuarter = Number(quarter) || 1;
  const prevTermQuarter = currentQuarter > 1 ? currentQuarter - 1 : null;
  const prevTermClassSummaries = prevTermQuarter
    ? (fullRoster.classSummaries ?? []).filter((row) => {
        if (schoolYear && row.schoolYear !== schoolYear) return false;
        if (Number(row.quarter) !== prevTermQuarter) return false;
        return true;
      })
    : [];
  const prevTermClassIds = new Set(prevTermClassSummaries.map((row) => row.id));
  const prevTermStudents = prevTermQuarter
    ? (fullRoster.students ?? []).filter((s) => prevTermClassIds.has(s.classId))
    : [];

  let prevTermHighRisk = 0;
  let prevTermModerateRisk = 0;
  let prevTermLowRisk = 0;
  for (const student of prevTermStudents) {
    if (!student.hasClassSubjectGrade) continue;
    if (student.riskLevel === "—") continue;
    const risk = normalizeRiskLevel(student.riskLevel);
    if (risk === RISK_LEVEL.HIGH) prevTermHighRisk += 1;
    else if (risk === RISK_LEVEL.MODERATE) prevTermModerateRisk += 1;
    else if (risk === RISK_LEVEL.LOW) prevTermLowRisk += 1;
  }

  // Calculate Weak Areas for Current Term
  const weakAreasMap = { high: {}, moderate: {}, low: {} };
  for (const student of roster.students) {
    if (!student.hasClassSubjectGrade) continue;
    if (student.riskLevel === "—") continue;
    const risk = normalizeRiskLevel(student.riskLevel);
    
    // Collect areas needing attention (subjects where student is at risk)
    if (student.atRisk && student.subject) {
      const subject = student.subject;
      if (risk === RISK_LEVEL.HIGH) {
        weakAreasMap.high[subject] = (weakAreasMap.high[subject] || 0) + 1;
      } else if (risk === RISK_LEVEL.MODERATE) {
        weakAreasMap.moderate[subject] = (weakAreasMap.moderate[subject] || 0) + 1;
      } else if (risk === RISK_LEVEL.LOW) {
        weakAreasMap.low[subject] = (weakAreasMap.low[subject] || 0) + 1;
      }
    }
  }

  const getTop3 = (countsMap) => {
    return Object.entries(countsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);
  };

  const prevYearLabel = prevSchoolYear || "Previous School Year";
  const comparisons = {
    [prevYearLabel]: {
      label: `${prevSchoolYear ? prevSchoolYear.replace("SY ", "") : "Prev"} → ${schoolYear ? schoolYear.replace("SY ", "") : "Curr"}`,
      high: { prev: prevHighRisk, curr: highRisk },
      moderate: { prev: prevModerateRisk, curr: moderateRisk },
      low: { prev: prevLowRisk, curr: lowRisk },
    },
  };

  if (prevTermQuarter) {
    comparisons["Previous Term"] = {
      label: `Term ${prevTermQuarter} → Term ${currentQuarter}`,
      high: { prev: prevTermHighRisk, curr: highRisk },
      moderate: { prev: prevTermModerateRisk, curr: moderateRisk },
      low: { prev: prevTermLowRisk, curr: lowRisk },
    };
  }

  const riskTrend = {
    comparisons,
    weakAreas: {
      high: getTop3(weakAreasMap.high),
      moderate: getTop3(weakAreasMap.moderate),
      low: getTop3(weakAreasMap.low),
    },
  };

  const riskDistribution = [
    { name: "High Risk", value: highRisk, color: "#dc2626" },
    { name: "Moderate Risk", value: moderateRisk, color: "#d97706" },
    { name: "Low Risk", value: lowRisk, color: "#16a34a" },
  ];

  const subjectCounts = {};
  for (const item of learnersAttention) {
    const subj = item.weakSubject || item.subject || "General";
    subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
  }
  for (const [subj, count] of Object.entries(weakAreasMap.high)) {
    subjectCounts[subj] = Math.max(subjectCounts[subj] || 0, count);
  }
  const weakSubjects = Object.entries(subjectCounts)
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);

  const enrolledTotal = roster.students.length;
  const termHelper = roster.predictionsPending
    ? `Updating… · of ${enrolledTotal}`
    : `of ${enrolledTotal} · Term ${quarter}`;
  const primaryClass = classRows[0] ?? null;

  const topStats = [
    {
      id: "my-learners",
      label: "Total Learners",
      value: enrolledTotal,
      subtext: `${classRows.length} assigned class${classRows.length === 1 ? "" : "es"}`,
      icon: "users",
      variant: "default",
      href: "/teacher/my-classes",
    },
    {
      id: "learners-to-check",
      label: "Learners to Check",
      value: learnersAttention.length,
      subtext: learnersAttention.length > 0 ? "Require review" : "All clear",
      icon: "alert",
      variant: learnersAttention.length > 0 ? "warning" : "default",
      href: "/teacher/monitoring",
    },
    {
      id: "attendance",
      label: "Average Attendance",
      value:
        attendanceAnalytics?.avgPa != null
          ? `${attendanceAnalytics.avgPa}%`
          : "—",
      subtext: "School year average",
      icon: "check",
      variant:
        attendanceAnalytics?.avgPa != null && attendanceAnalytics.avgPa < 90
          ? "warning"
          : "default",
      href: "/teacher/attendance",
    },
    {
      id: "pending-actions",
      label: "Pending Actions",
      value: pendingPlans + pendingRecords,
      subtext: "Requires submission",
      icon: "file",
      variant: (pendingPlans + pendingRecords) > 0 ? "warning" : "default",
      href: "/teacher/my-classes",
    },
  ];

  const attentionItems = [];

  if (learnersAttention.length > 0) {
    attentionItems.push({
      id: "learners-attention",
      type: "learners",
      tone: "warning",
      title: `${learnersAttention.length} learner${learnersAttention.length === 1 ? "" : "s"} to check`,
      description: "Learners flagged for review based on recent academic performance.",
      actionLabel: "View Learners",
      href: "/teacher/monitoring",
    });
  }

  if (pendingPlans > 0) {
    const needsRevisionCount = filteredPlans.filter(
      (p) => p.status === "Needs Revision"
    ).length;
    attentionItems.push({
      id: "plans-attention",
      type: "lesson-plans",
      tone: needsRevisionCount > 0 ? "danger" : "warning",
      title:
        needsRevisionCount > 0
          ? `${needsRevisionCount} lesson plan${needsRevisionCount === 1 ? "" : "s"} need revision`
          : `${pendingPlans} lesson plan${pendingPlans === 1 ? "" : "s"} pending review`,
      description:
        needsRevisionCount > 0
          ? "Coordinators requested revisions on weekly lesson plans."
          : "Lesson plans await department coordinator review.",
      actionLabel: "View Lesson Plans",
      href: "/teacher/lesson-plans",
    });
  }

  const flaggedCount = attendanceAnalytics?.flaggedSections?.length ?? 0;
  if (flaggedCount > 0) {
    attentionItems.push({
      id: "attendance-attention",
      type: "attendance",
      tone: "warning",
      title: `${flaggedCount} section${flaggedCount === 1 ? "" : "s"} with attendance issues`,
      description: "Sections experiencing lower than 90% average attendance.",
      actionLabel: "View Attendance",
      href: "/teacher/attendance",
    });
  }

  if (pendingRecords > 0) {
    attentionItems.push({
      id: "records-attention",
      type: "grades",
      tone: "orange",
      title: `${pendingRecords} class${pendingRecords === 1 ? "" : "es"} pending E-Class records`,
      description: `Quarterly grades have not been submitted for ${pendingRecords} assigned class${pendingRecords === 1 ? "" : "es"}.`,
      actionLabel: "Enter Grades",
      href: primaryClass
        ? `/teacher/my-classes/${primaryClass.id}`
        : "/teacher/my-classes",
    });
  }

  const attendanceIssuesCount = attendanceAnalytics?.rows
    ? attendanceAnalytics.rows.reduce(
        (acc, r) =>
          acc + (Number(r.fiveConsecutive) || 0) + (Number(r.nls) || 0),
        0
      ) || flaggedCount
    : 0;

  const attendanceSummary = {
    avgPa:
      attendanceAnalytics?.avgPa != null
        ? `${attendanceAnalytics.avgPa}%`
        : "—",
    issuesCount: attendanceIssuesCount,
    avgAda:
      attendanceAnalytics?.avgAda != null
        ? String(attendanceAnalytics.avgAda)
        : "—",
    totalAbsences: attendanceAnalytics?.totalAbsences ?? 0,
    hasData: Boolean(attendanceAnalytics?.hasData),
    href: "/teacher/attendance",
  };

  return {
    controls: {
      schoolYear,
      quarter: `Term ${quarter}`,
      // Date is set client-side only (avoids SSR/client hydration mismatch).
      currentDate: "",
    },
    topStats,
    attentionItems: attentionItems.slice(0, 3),
    attendanceSummary,
    attendanceAnalytics,
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
    riskTrend,
    riskDistribution,
    weakSubjects,
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
