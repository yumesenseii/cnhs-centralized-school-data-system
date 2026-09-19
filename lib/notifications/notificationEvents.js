/**
 * Domain event → notification payload builders.
 *
 * Pure functions only: no Supabase calls, no React, no subject policy of their
 * own. Subject eligibility and Classroom Remedial thresholds are decided by the
 * recommendation layer before these builders are called.
 *
 * Phase 4 (teacher review → Head Teacher confirmation of ARAL intake) is not
 * implemented yet. It only needs another builder here plus a dedupe key in
 * notificationConstants; the table, queries, and page need no changes.
 */

import {
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  dedupeKeys,
} from "@/lib/notifications/notificationConstants";
import { termLabel } from "@/lib/academic/termLabels";

function classContext({
  subject,
  gradeLevel,
  section,
  gradeSection,
  schoolYear,
  quarter,
} = {}) {
  const where =
    gradeSection ||
    [gradeLevel ? `Grade ${gradeLevel}` : null, section].filter(Boolean).join(" ") ||
    null;

  const term =
    quarter === null || quarter === undefined || quarter === ""
      ? null
      : termLabel(quarter);

  return [subject, where, schoolYear, term].filter(Boolean).join(" • ");
}

/* -------------------------------------------------------------------------- */
/* Lesson plans                                                                */
/* -------------------------------------------------------------------------- */

const LESSON_PLAN_COPY = {
  "Under Review": {
    title: "Lesson plan is under review",
    priority: NOTIFICATION_PRIORITY.LOW,
    message: (plan) =>
      `The Head Teacher opened "${plan.title}" for review. No action is needed yet.`,
  },
  Approved: {
    title: "Lesson plan approved",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    message: (plan) => `"${plan.title}" was approved by the Head Teacher.`,
  },
  "Needs Revision": {
    title: "Lesson plan needs revision",
    priority: NOTIFICATION_PRIORITY.HIGH,
    message: (plan, remarks) =>
      remarks
        ? `"${plan.title}" needs revision. Head Teacher remarks: ${remarks}`
        : `"${plan.title}" needs revision. Please review and resubmit.`,
  },
};

/**
 * @param {object} input
 * @param {string} input.recipientProfileId Teacher who owns the plan.
 * @param {{id: string, title: string, subject?: string, section?: string,
 *          schoolYear?: string, quarter?: number}} input.plan
 * @param {"Under Review"|"Approved"|"Needs Revision"} input.status
 */
export function buildLessonPlanNotification({
  recipientProfileId,
  actorProfileId = null,
  plan,
  status,
  remarks = null,
}) {
  const copy = LESSON_PLAN_COPY[status];
  if (!copy || !plan?.id || !recipientProfileId) return null;

  const cleanRemarks = String(remarks ?? "").trim() || null;

  return {
    recipientProfileId,
    actorProfileId,
    type: NOTIFICATION_TYPE.LESSON_PLAN,
    title: copy.title,
    message: copy.message(plan, cleanRemarks),
    priority: copy.priority,
    actionUrl: `/teacher/lesson-plans?plan=${plan.id}`,
    entityType: "lesson_plan",
    entityId: plan.id,
    dedupeKey: dedupeKeys.lessonPlan(plan.id, status),
    metadata: {
      status,
      remarks: cleanRemarks,
      lessonTitle: plan.title ?? null,
      context: classContext(plan),
      actionLabel: status === "Approved" ? "View Lesson Plan" : "Open Lesson Plan",
    },
  };
}

/**
 * Head Teacher / admin inbox when a teacher submits or resubmits a plan.
 * @param {"submitted"|"resubmitted"} input.kind
 */
export function buildLessonPlanAdminSubmitNotification({
  recipientProfileId,
  actorProfileId = null,
  plan,
  kind = "submitted",
  stamp = null,
}) {
  if (!recipientProfileId || !plan?.id) return null;
  if (kind !== "submitted" && kind !== "resubmitted") return null;

  const teacher = plan.teacherName || "A teacher";
  const title =
    kind === "resubmitted"
      ? `${teacher} resubmitted a lesson plan — check it`
      : `${teacher} submitted a lesson plan — check it`;
  const week = plan.weekCovered ? ` (${plan.weekCovered})` : "";
  const context = classContext(plan);
  const contextBit = context ? ` · ${context}` : "";
  const message =
    kind === "resubmitted"
      ? `${teacher} resubmitted "${plan.title}"${week}${contextBit}. Open Lesson Plan Review to check it.`
      : `${teacher} submitted "${plan.title}"${week}${contextBit}. Open Lesson Plan Review to check it.`;

  return {
    recipientProfileId,
    actorProfileId,
    type: NOTIFICATION_TYPE.LESSON_PLAN,
    title,
    message,
    priority: NOTIFICATION_PRIORITY.HIGH,
    actionUrl: `/lesson-plan-review?plan=${plan.id}`,
    entityType: "lesson_plan",
    entityId: plan.id,
    dedupeKey: dedupeKeys.lessonPlanAdminSubmit(
      plan.id,
      kind,
      stamp,
      recipientProfileId
    ),
    metadata: {
      status: "Pending Review",
      kind,
      lessonTitle: plan.title ?? null,
      teacherName: plan.teacherName ?? null,
      weekCovered: plan.weekCovered ?? null,
      context: context || null,
      actionLabel: "Open for review",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Subject-aware recommendations                                               */
/* -------------------------------------------------------------------------- */

/**
 * ARAL Learners is student-level and only reaches this builder for
 * English / Filipino classes when the class-subject grade is below 75.
 * Callers must not bypass the subject / passing-grade policy.
 */
export function buildAralScreeningNotification({
  recipientProfileId,
  learner,
  classInfo,
}) {
  if (!recipientProfileId || !learner?.studentId || !classInfo?.id) return null;

  const context = classContext({
    subject: classInfo.subject,
    gradeSection: classInfo.gradeSection,
    schoolYear: classInfo.schoolYear,
    quarter: classInfo.quarter,
  });

  const grade = Number(
    learner.classSubjectGrade ?? learner.grade ?? learner.generalAverage
  );
  const hasFailingGrade = Number.isFinite(grade) && grade < 75;
  // Do not claim "below the passing grade" unless the grade actually is.
  const message = hasFailingGrade
    ? `${learner.name} scored ${grade} in ${classInfo.subject} (below the passing grade of 75). Review the learner's monitoring record and confirm the ARAL Learners recommendation.`
    : `${learner.name} is recommended for ARAL Learners in ${classInfo.subject}. Review the learner's monitoring record and confirm the recommendation.`;

  return {
    recipientProfileId,
    actorProfileId: null,
    type: NOTIFICATION_TYPE.ARAL_SCREENING,
    title: `${learner.name} is recommended for ARAL Learners`,
    message,
    priority: NOTIFICATION_PRIORITY.HIGH,
    actionUrl: `/teacher/monitoring/${classInfo.id}/students/${learner.studentId}`,
    entityType: "student",
    entityId: learner.studentId,
    dedupeKey: dedupeKeys.aral({
      studentId: learner.studentId,
      classId: classInfo.id,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
    }),
    metadata: {
      context,
      learnerName: learner.name,
      classId: classInfo.id,
      subject: classInfo.subject,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
      classSubjectGrade: hasFailingGrade ? grade : null,
      actionLabel: "Open Monitoring",
    },
  };
}

/**
 * Classroom Remedial stays class-level: exactly one notification per
 * class / school year / quarter, never one per student.
 */
export function buildClassroomRemedialNotification({
  recipientProfileId,
  classSummary,
}) {
  if (!recipientProfileId || !classSummary?.id) return null;

  const context = classContext({
    subject: classSummary.subject,
    gradeSection: classSummary.gradeSection,
    schoolYear: classSummary.schoolYear,
    quarter: classSummary.quarter,
  });

  return {
    recipientProfileId,
    actorProfileId: null,
    type: NOTIFICATION_TYPE.CLASSROOM_REMEDIAL,
    title: `Classroom Remedial recommended for ${classSummary.gradeSection}`,
    message: `${classSummary.belowPassingCount} of ${classSummary.gradedStudentCount} graded learners (${classSummary.belowPassingPercent}%) scored below the passing grade in ${classSummary.subject}. Conduct a whole-class remedial for this section.`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    actionUrl: `/teacher/my-classes/${classSummary.id}`,
    entityType: "class",
    entityId: classSummary.id,
    dedupeKey: dedupeKeys.classroomRemedial({
      classId: classSummary.id,
      schoolYear: classSummary.schoolYear,
      quarter: classSummary.quarter,
    }),
    metadata: {
      context,
      subject: classSummary.subject,
      schoolYear: classSummary.schoolYear,
      quarter: classSummary.quarter,
      belowPassingCount: classSummary.belowPassingCount ?? null,
      gradedStudentCount: classSummary.gradedStudentCount ?? null,
      actionLabel: "Open Class",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Monitoring                                                                  */
/* -------------------------------------------------------------------------- */

const MONITORING_COPY = {
  "Needs Follow-up": {
    state: "needs-follow-up",
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: (learner) => `${learner} needs follow-up`,
    message: (learner, subject) =>
      `The latest monitoring entry for ${learner} in ${subject} is marked Needs Follow-up. Schedule the next observation.`,
  },
  Ongoing: {
    state: "update-due",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    title: (learner) => `Monitoring update due for ${learner}`,
    message: (learner, subject) =>
      `The active monitoring record for ${learner} in ${subject} is still ongoing. Add the next progress update.`,
  },
  Completed: {
    state: "completed",
    priority: NOTIFICATION_PRIORITY.LOW,
    title: (learner) => `Monitoring cycle completed for ${learner}`,
    message: (learner, subject) =>
      `The monitoring cycle for ${learner} in ${subject} was marked completed.`,
  },
};

/**
 * @param {object} input
 * @param {{id: string, monitoringStatus: string}} input.record
 */
export function buildMonitoringNotification({
  recipientProfileId,
  record,
  learner,
  classInfo,
}) {
  const copy = MONITORING_COPY[record?.monitoringStatus];
  if (!copy || !recipientProfileId || !record?.id || !learner?.studentId) {
    return null;
  }

  const subject = classInfo?.subject ?? "your class";

  return {
    recipientProfileId,
    actorProfileId: null,
    type: NOTIFICATION_TYPE.MONITORING,
    title: copy.title(learner.name),
    message: copy.message(learner.name, subject),
    priority: copy.priority,
    actionUrl: classInfo?.id
      ? `/teacher/monitoring/${classInfo.id}/students/${learner.studentId}`
      : null,
    entityType: "monitoring_record",
    entityId: record.id,
    dedupeKey: dedupeKeys.monitoring({ recordId: record.id, state: copy.state }),
    metadata: {
      context: classContext({
        subject: classInfo?.subject,
        gradeSection: classInfo?.gradeSection,
        schoolYear: classInfo?.schoolYear,
        quarter: classInfo?.quarter,
      }),
      learnerName: learner.name,
      monitoringStatus: record.monitoringStatus,
      actionLabel: "Open Monitoring",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Class assignments                                                           */
/* -------------------------------------------------------------------------- */

const ASSIGNMENT_COPY = {
  created: {
    title: "New class assigned to you",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    verb: "assigned",
    actionLabel: "Open Class",
  },
  updated: {
    title: "Class assignment updated",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    verb: "updated",
    actionLabel: "Open Class",
  },
  removed: {
    title: "Class assignment removed",
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    verb: "removed",
    actionLabel: "View My Classes",
  },
};

/**
 * @param {"created"|"updated"|"removed"} input.action
 */
export function buildClassAssignmentNotification({
  recipientProfileId,
  actorProfileId = null,
  action,
  assignment,
}) {
  const copy = ASSIGNMENT_COPY[action];
  if (!copy || !recipientProfileId || !assignment?.classId) return null;

  const context = classContext(assignment);

  return {
    recipientProfileId,
    actorProfileId,
    type: NOTIFICATION_TYPE.CLASS_ASSIGNMENT,
    title: copy.title,
    message: `The Head Teacher ${copy.verb} your assignment for ${context}.`,
    priority: copy.priority,
    actionUrl:
      action === "removed"
        ? "/teacher/my-classes"
        : `/teacher/my-classes/${assignment.classId}`,
    entityType: "class",
    entityId: assignment.classId,
    dedupeKey:
      action === "updated"
        ? `${dedupeKeys.classAssignment(assignment.classId, action)}:${
            assignment.revision ?? Date.now()
          }`
        : dedupeKeys.classAssignment(assignment.classId, action),
    metadata: {
      context,
      action,
      subject: assignment.subject ?? null,
      gradeLevel: assignment.gradeLevel ?? null,
      section: assignment.section ?? null,
      schoolYear: assignment.schoolYear ?? null,
      quarter: assignment.quarter ?? null,
      actionLabel: copy.actionLabel,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* E-Class records                                                             */
/* -------------------------------------------------------------------------- */

/**
 * @param {"imported"|"failed"} input.outcome
 * `stamp` keeps each failed upload attempt distinct so a teacher who corrects
 * a file and fails again still gets notified, while a page refresh does not.
 */
export function buildEClassImportNotification({
  recipientProfileId,
  outcome,
  classInfo,
  summary = {},
  reason = null,
  stamp = null,
}) {
  if (!recipientProfileId || !classInfo?.id) return null;
  if (outcome !== "imported" && outcome !== "failed") return null;

  const context = classContext(classInfo);
  const success = outcome === "imported";

  return {
    recipientProfileId,
    actorProfileId: null,
    type: NOTIFICATION_TYPE.ECLASS,
    title: success ? "E-Class Record imported" : "E-Class Record import failed",
    message: success
      ? `${summary.imported ?? 0} learners and ${summary.gradesUpserted ?? 0} term grades were imported for ${context}.`
      : `The E-Class Record upload for ${context} did not complete. ${reason ?? "Please check the file and try again."}`,
    priority: success ? NOTIFICATION_PRIORITY.LOW : NOTIFICATION_PRIORITY.HIGH,
    actionUrl: `/teacher/my-classes/${classInfo.id}`,
    entityType: "class",
    entityId: classInfo.id,
    dedupeKey: dedupeKeys.eclassImport({
      classId: classInfo.id,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
      outcome,
      stamp,
    }),
    metadata: {
      context,
      outcome,
      reason,
      ...summary,
      actionLabel: success ? "View Class" : "Retry Import",
    },
  };
}

/** Assigned class that still has no term grades recorded. */
export function buildEClassMissingGradesNotification({
  recipientProfileId,
  classInfo,
}) {
  if (!recipientProfileId || !classInfo?.id) return null;

  const context = classContext(classInfo);

  return {
    recipientProfileId,
    actorProfileId: null,
    type: NOTIFICATION_TYPE.ECLASS,
    title: "No term grades recorded yet",
    message: `${context} has no term grades yet. Import the E-Class Record so recommendations can be generated.`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
    actionUrl: `/teacher/my-classes/${classInfo.id}`,
    entityType: "class",
    entityId: classInfo.id,
    dedupeKey: dedupeKeys.eclassMissingGrades({
      classId: classInfo.id,
      schoolYear: classInfo.schoolYear,
      quarter: classInfo.quarter,
    }),
    metadata: {
      context,
      subject: classInfo.subject ?? null,
      schoolYear: classInfo.schoolYear ?? null,
      quarter: classInfo.quarter ?? null,
      actionLabel: "Import E-Class Record",
    },
  };
}

function deleteRequestKindCopy(kind, label) {
  if (kind === "approved") {
    return {
      title: "Delete request approved",
      message: `The Head Teacher approved your request to remove ${label}.`,
      actionUrl: "/teacher/my-classes",
    };
  }
  if (kind === "rejected") {
    return {
      title: "Delete request declined",
      message: `The Head Teacher declined your request to remove ${label}.`,
      actionUrl: "/teacher/my-classes",
    };
  }
  return {
    title: "Delete request pending",
    message: `A teacher asked to remove ${label}. Review it in Notifications.`,
    actionUrl: "/notifications",
  };
}

export function buildDeleteRequestNotification({
  recipientProfileId,
  actorProfileId = null,
  request,
  kind = "created",
}) {
  if (!recipientProfileId || !request?.id) return null;
  const label = request.label || "an item";
  const copy = deleteRequestKindCopy(kind, label);

  return {
    recipientProfileId,
    actorProfileId,
    type: NOTIFICATION_TYPE.DELETE_REQUEST,
    title: copy.title,
    message: copy.message,
    priority:
      kind === "created"
        ? NOTIFICATION_PRIORITY.HIGH
        : NOTIFICATION_PRIORITY.MEDIUM,
    actionUrl: copy.actionUrl,
    entityType: "delete_request",
    entityId: request.id,
    dedupeKey: dedupeKeys.deleteRequest(request.id, kind, recipientProfileId),
    metadata: {
      targetType: request.target_type ?? request.targetType ?? null,
      label,
      actionLabel: kind === "created" ? "Review request" : "View classes",
    },
  };
}

/** Teacher assigned as ARAL facilitator for a learner. */
export function buildAralFacilitatorAssignedNotification({
  recipientProfileId,
  actorProfileId = null,
  assignment,
}) {
  if (!recipientProfileId || !assignment?.id) return null;
  const learner = assignment.learnerName || "a learner";
  const stamp = assignment.stamp || String(Date.now());

  return {
    recipientProfileId,
    actorProfileId,
    type: NOTIFICATION_TYPE.SYSTEM,
    title: "You were assigned as ARAL facilitator",
    message: `You were assigned as ARAL facilitator for ${learner}. Open ARAL Program to begin.`,
    priority: NOTIFICATION_PRIORITY.HIGH,
    actionUrl: "/teacher/aral-program",
    entityType: "aral_facilitator_assignment",
    entityId: assignment.id,
    dedupeKey: dedupeKeys.aralFacilitatorAssign(assignment.id, stamp),
    metadata: {
      learnerName: assignment.learnerName ?? null,
      studentId: assignment.studentId ?? null,
      actionLabel: "Open ARAL Program",
    },
  };
}

/** Head Teacher: teacher sent a class report for review (with date/time). */
export function buildClassReportSubmittedToHtNotification({
  recipientProfileId,
  actorProfileId = null,
  report,
}) {
  if (!recipientProfileId || !report?.classId) return null;
  const teacher = report.teacherName || "A teacher";
  const label = report.classLabel || "a class";
  const when =
    report.submittedAtLabel ||
    new Date().toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const stamp = report.stamp || String(Date.now());
  const quarter = report.quarter ?? "";

  return {
    recipientProfileId,
    actorProfileId,
    type: NOTIFICATION_TYPE.MONITORING,
    title: "Class report submitted for review",
    message: `${teacher} sent a class report for ${label} on ${when}. Open Academic Monitoring to review.`,
    priority: NOTIFICATION_PRIORITY.HIGH,
    actionUrl: "/monitoring",
    entityType: "class",
    entityId: report.classId,
    dedupeKey: dedupeKeys.classReportToHt(
      report.classId,
      report.schoolYear,
      quarter,
      stamp,
      recipientProfileId
    ),
    metadata: {
      teacherName: report.teacherName ?? null,
      classLabel: label,
      submittedAtLabel: when,
      schoolYear: report.schoolYear ?? null,
      quarter: report.quarter ?? null,
      actionLabel: "Open Monitoring",
    },
  };
}
