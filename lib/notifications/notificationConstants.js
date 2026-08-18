/**
 * Notification vocabulary shared by the data layer, event builders, and UI.
 * Values mirror the `notifications` table check constraints.
 */

export const NOTIFICATION_TYPE = {
  LESSON_PLAN: "lesson_plan",
  ARAL_SCREENING: "aral_screening",
  CLASSROOM_REMEDIAL: "classroom_remedial",
  MONITORING: "monitoring",
  CLASS_ASSIGNMENT: "class_assignment",
  ECLASS: "eclass",
  SYSTEM: "system",
  DELETE_REQUEST: "delete_request",
};

export const NOTIFICATION_PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const NOTIFICATION_PRIORITIES = [
  NOTIFICATION_PRIORITY.HIGH,
  NOTIFICATION_PRIORITY.MEDIUM,
  NOTIFICATION_PRIORITY.LOW,
];

/** Human labels used by filters and the module badge. */
export const NOTIFICATION_TYPE_LABELS = {
  [NOTIFICATION_TYPE.LESSON_PLAN]: "Lesson Plan",
  [NOTIFICATION_TYPE.ARAL_SCREENING]: "ARAL Learners",
  [NOTIFICATION_TYPE.CLASSROOM_REMEDIAL]: "Classroom Remedial",
  [NOTIFICATION_TYPE.MONITORING]: "Monitoring",
  [NOTIFICATION_TYPE.CLASS_ASSIGNMENT]: "Class Assignment",
  [NOTIFICATION_TYPE.ECLASS]: "E-Class Record",
  [NOTIFICATION_TYPE.SYSTEM]: "System",
  [NOTIFICATION_TYPE.DELETE_REQUEST]: "Delete request",
};

/** Maps to the icon keys already supported by NotificationCard. */
export const NOTIFICATION_TYPE_ICONS = {
  [NOTIFICATION_TYPE.LESSON_PLAN]: "file",
  [NOTIFICATION_TYPE.ARAL_SCREENING]: "user",
  [NOTIFICATION_TYPE.CLASSROOM_REMEDIAL]: "book",
  [NOTIFICATION_TYPE.MONITORING]: "monitor",
  [NOTIFICATION_TYPE.CLASS_ASSIGNMENT]: "chart",
  [NOTIFICATION_TYPE.ECLASS]: "upload",
  [NOTIFICATION_TYPE.SYSTEM]: "check",
  [NOTIFICATION_TYPE.DELETE_REQUEST]: "user",
};

/** Maps to the tone keys already supported by NotificationCard / ModuleBadge. */
export const NOTIFICATION_TYPE_TONES = {
  [NOTIFICATION_TYPE.LESSON_PLAN]: "violet",
  [NOTIFICATION_TYPE.ARAL_SCREENING]: "orange",
  [NOTIFICATION_TYPE.CLASSROOM_REMEDIAL]: "teal",
  [NOTIFICATION_TYPE.MONITORING]: "blue",
  [NOTIFICATION_TYPE.CLASS_ASSIGNMENT]: "green",
  [NOTIFICATION_TYPE.ECLASS]: "green",
  [NOTIFICATION_TYPE.SYSTEM]: "slate",
  [NOTIFICATION_TYPE.DELETE_REQUEST]: "orange",
};

export const NOTIFICATION_STATUS_FILTER = {
  ALL: "All",
  UNREAD: "Unread",
  READ: "Read",
};

export const NOTIFICATION_FILTER_ALL = "all";

/**
 * Stable dedupe keys so the same real-world event never inserts twice,
 * no matter how many times a page is refreshed.
 */
export const dedupeKeys = {
  lessonPlan: (planId, status) =>
    `lesson-plan:${planId}:${slug(status)}`,
  aral: ({ studentId, classId, schoolYear, quarter }) =>
    `aral:${studentId}:${classId}:${slug(schoolYear)}:q${quarter}`,
  classroomRemedial: ({ classId, schoolYear, quarter }) =>
    `classroom-remedial:${classId}:${slug(schoolYear)}:q${quarter}`,
  monitoring: ({ recordId, state }) => `monitoring:${recordId}:${slug(state)}`,
  classAssignment: (classId, action) => `class-assignment:${classId}:${slug(action)}`,
  eclassImport: ({ classId, schoolYear, quarter, outcome, stamp }) =>
    `eclass:${outcome}:${classId}:${slug(schoolYear)}:q${quarter}${
      stamp ? `:${stamp}` : ""
    }`,
  eclassMissingGrades: ({ classId, schoolYear, quarter }) =>
    `eclass:missing-grades:${classId}:${slug(schoolYear)}:q${quarter}`,
  deleteRequest: (requestId, kind) => `delete-request:${requestId}:${slug(kind)}`,
};

function slug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
