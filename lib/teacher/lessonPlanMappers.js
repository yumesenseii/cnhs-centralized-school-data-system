import { termLabel } from "@/lib/academic/termLabels";

function unwrapRelation(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatTeacherName(teacher) {
  if (!teacher) return "Teacher";
  return [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function quarterToLabel(quarter) {
  const number = Number(quarter);
  if (Number.isFinite(number) && number >= 1 && number <= 4) {
    return termLabel(number);
  }
  return String(quarter || "—");
}

export function quarterFromLabel(value) {
  const number = Number(String(value ?? "").replace(/\D/g, ""));
  if (Number.isFinite(number) && number >= 1 && number <= 4) return number;
  return null;
}

export function trackingNumberFromId(id) {
  if (!id) return "LP-PENDING";
  const compact = String(id).replace(/-/g, "").slice(0, 6).toUpperCase();
  const year = new Date().getFullYear();
  return `LP-${year}-${compact}`;
}

export function mapClassToLessonSelectedClass(classItem, teacherName) {
  const display = teacherName
    ? `Sir/Ma'am ${String(teacherName).split(" ")[0]}`
    : "Teacher";

  return {
    id: classItem.id,
    subject: classItem.subject,
    subjectId: classItem.subjectId,
    grade: classItem.grade,
    section: classItem.section,
    gradeSection: classItem.gradeSection,
    quarter: classItem.quarterLabel || classItem.currentQuarter || "Term 1",
    quarterNumber:
      Number(String(classItem.quarter ?? "").replace(/\D/g, "")) ||
      quarterFromLabel(classItem.quarterLabel) ||
      1,
    schoolYear: classItem.schoolYear,
    teacher: teacherName || "Teacher",
    teacherDisplay: display,
    teacherId: classItem.teacherId,
  };
}

export function parseSectionRemarksFromRow(row) {
  if (Array.isArray(row?.section_remarks) && row.section_remarks.length > 0) {
    return row.section_remarks;
  }
  // Robust fallback: parse from structured remarks string
  if (typeof row?.remarks === "string" && row.remarks.includes("[")) {
    const parts = row.remarks.split(";").map((p) => p.trim()).filter(Boolean);
    const parsed = [];

    parts.forEach((part, idx) => {
      let status = "open";
      let workingPart = part;

      // Detect [Applied] or [Resolved] tag
      if (/^\[applied\]/i.test(workingPart)) {
        status = "applied";
        workingPart = workingPart.replace(/^\[applied\]\s*/i, "").trim();
      } else if (/^\[resolved\]/i.test(workingPart)) {
        status = "resolved";
        workingPart = workingPart.replace(/^\[resolved\]\s*/i, "").trim();
      }

      // Ignore pure revision note prefix if present
      if (/^\[revision note\]/i.test(workingPart)) {
        return;
      }

      let severity = "Needs Revision";
      let sectionTitle = "General";
      let highlightedText = null;
      let comment = workingPart;

      // Pattern 1: [Severity][Section Title] comment
      const doubleBracketMatch = workingPart.match(
        /^\[(Needs Revision|Suggestion|Commendation)\]\s*\[(.*?)\]\s*(.*)$/i
      );
      if (doubleBracketMatch) {
        severity = doubleBracketMatch[1];
        sectionTitle = doubleBracketMatch[2].trim();
        comment = doubleBracketMatch[3].trim();
      } else {
        // Pattern 2: [Section Title] comment
        const singleBracketMatch = workingPart.match(/^\[(.*?)\]\s*(.*)$/);
        if (singleBracketMatch) {
          const firstTag = singleBracketMatch[1].trim();
          if (["needs revision", "suggestion", "commendation"].includes(firstTag.toLowerCase())) {
            severity = firstTag;
            comment = singleBracketMatch[2].trim();
          } else {
            sectionTitle = firstTag;
            comment = singleBracketMatch[2].trim();
          }
        }
      }

      // Check if comment has "quote": comment
      const quoteMatch = comment.match(/^"(.*?)"\s*:\s*(.*)$/);
      if (quoteMatch) {
        highlightedText = quoteMatch[1].trim();
        comment = quoteMatch[2].trim();
      }

      // Standardize severity casing
      const normalizedSeverity = severity.toLowerCase().includes("sug")
        ? "Suggestion"
        : severity.toLowerCase().includes("com")
        ? "Commendation"
        : "Needs Revision";

      parsed.push({
        id: `parsed-rem-${idx}-${row?.id || "temp"}`,
        sectionTitle: sectionTitle || "General",
        sectionKey: "flow",
        comment: comment || workingPart,
        highlightedText,
        severity: normalizedSeverity,
        reviewerName: row?.reviewed_by_name || "Principal",
        createdAt: row?.reviewed_at || new Date().toISOString(),
        status,
      });
    });

    if (parsed.length > 0) return parsed;
  }
  return [];
}

export function mapLessonPlanForTeacher(row) {
  const classRow = unwrapRelation(row.classes);
  const subject = unwrapRelation(classRow?.subjects);
  const section = unwrapRelation(classRow?.sections);
  const reviewer = unwrapRelation(row.reviewed_profile);
  const subjectName = subject?.subject_name ?? "Subject";
  const gradeLevel = section?.grade_level;
  const gradeLabel =
    gradeLevel === null || gradeLevel === undefined
      ? "Grade"
      : `Grade ${gradeLevel}`;
  const sectionName = section?.section_name ?? "Section";
  const sectionRemarks = parseSectionRemarksFromRow(row);

  return {
    id: row.id,
    trackingNumber: trackingNumberFromId(row.id),
    lessonTitle: row.lesson_title,
    subject: subjectName,
    gradeSection: `${gradeLabel} — ${sectionName}`,
    week: row.week_covered,
    weekCovered: row.week_covered,
    quarter: quarterToLabel(row.quarter),
    quarterNumber: Number(row.quarter),
    schoolYear: row.school_year,
    submittedDate: formatDate(row.submitted_at),
    submittedAt: formatDateTime(row.submitted_at),
    reviewedDate: formatDate(row.reviewed_at),
    reviewedAt: formatDateTime(row.reviewed_at),
    reviewedBy:
      row.reviewed_by_name ||
      reviewer?.full_name ||
      (row.reviewed_at ? "Principal" : null),
    status: row.status,
    lastUpdated: formatDate(row.updated_at),
    learningCompetency: row.learning_competency,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    fileType: row.file_type,
    remarks: row.remarks,
    sectionRemarks,
    classId: row.class_id,
    teacherId: row.teacher_id,
    canResubmit: row.status === "Needs Revision",
    isApproved: row.status === "Approved",
    timeline: buildReviewTimeline(row.status),
    raw: row,
  };
}

export function mapLessonPlanForAdmin(row) {
  const teacher = unwrapRelation(row.teachers);
  const classRow = unwrapRelation(row.classes);
  const subject = unwrapRelation(classRow?.subjects);
  const section = unwrapRelation(classRow?.sections);
  const reviewer = unwrapRelation(row.reviewed_profile);
  const teacherName = formatTeacherName(teacher);
  const subjectName = subject?.subject_name ?? "Subject";
  const gradeLevel = section?.grade_level;
  const gradeLabel =
    gradeLevel === null || gradeLevel === undefined
      ? "Grade"
      : `Grade ${gradeLevel}`;
  const sectionName = section?.section_name ?? "Section";
  const sectionRemarks = parseSectionRemarksFromRow(row);

  // Admin badge historically used "Pending"; keep display compatible.
  const status =
    row.status === "Pending Review" ? "Pending" : row.status;

  return {
    id: row.id,
    trackingNumber: trackingNumberFromId(row.id),
    teacher: teacherName,
    initials: initialsFromName(teacherName),
    department: "Junior High School",
    learningArea: subjectName,
    gradeSection: `${gradeLabel} — ${sectionName}`,
    curriculumCode: row.learning_competency || "—",
    lessonTitle: row.lesson_title,
    weekCovered: row.week_covered,
    submissionDate: formatDate(row.submitted_at),
    status,
    dbStatus: row.status,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    fileType: row.file_type,
    schoolYear: row.school_year,
    quarter: quarterToLabel(row.quarter),
    remarks: row.remarks,
    sectionRemarks,
    reviewedAt: formatDateTime(row.reviewed_at),
    reviewedBy:
      row.reviewed_by_name ||
      reviewer?.full_name ||
      (row.reviewed_at ? "Principal" : null),
    classId: row.class_id,
    teacherId: row.teacher_id,
    raw: row,
  };
}

export function buildTeacherLessonPlanKpis(plans = []) {
  const pending = plans.filter((p) => p.status === "Pending Review").length;
  const underReview = plans.filter((p) => p.status === "Under Review").length;
  const approved = plans.filter((p) => p.status === "Approved").length;
  const revision = plans.filter((p) => p.status === "Needs Revision").length;

  return [
    {
      id: "total",
      label: "Total Lesson Plans",
      value: plans.length,
      tone: "green",
      icon: "clipboard",
    },
    {
      id: "pending",
      label: "Pending Review",
      value: pending + underReview,
      tone: "orange",
      icon: "clock",
      alert: pending + underReview > 0,
    },
    {
      id: "approved",
      label: "Approved",
      value: approved,
      tone: "blue",
      icon: "check",
    },
    {
      id: "revision",
      label: "Needs Revision",
      value: revision,
      tone: "red",
      icon: "alert",
      alert: revision > 0,
    },
  ];
}

export function buildAdminLessonPlanSummary(plans = []) {
  const pending = plans.filter(
    (p) => p.dbStatus === "Pending Review" || p.status === "Pending"
  ).length;
  const underReview = plans.filter((p) => p.dbStatus === "Under Review").length;
  const approved = plans.filter((p) => p.dbStatus === "Approved").length;
  const revision = plans.filter((p) => p.dbStatus === "Needs Revision").length;

  return [
    {
      id: "pending",
      label: "Pending Review",
      count: pending + underReview,
      icon: "clock",
      tone: "orange",
    },
    {
      id: "approved",
      label: "Approved",
      count: approved,
      icon: "check",
      tone: "green",
    },
    {
      id: "revision",
      label: "Needs Revision",
      count: revision,
      icon: "alert",
      tone: "red",
    },
    {
      id: "total",
      label: "Total Submitted",
      count: plans.length,
      icon: "file",
      tone: "blue",
    },
  ];
}

export function buildAdminActionRequired(plans = []) {
  const pending = plans.filter(
    (p) => p.dbStatus === "Pending Review" || p.dbStatus === "Under Review"
  ).length;
  const needsRevision = plans.filter(
    (p) => p.dbStatus === "Needs Revision"
  ).length;

  return {
    pending,
    needsRevision,
    message:
      pending > 0
        ? `${pending} lesson plan${pending === 1 ? "" : "s"} awaiting your decision.`
        : "No pending lesson plans right now.",
  };
}

const REVIEW_EVENT_MESSAGES = {
  Submitted: "Submitted lesson plan.",
  "Under Review": "Opened the lesson plan for review.",
  Approved: "Approved lesson plan.",
  "Needs Revision": "Returned lesson plan for revision.",
  Resubmitted: "Resubmitted revised lesson plan.",
};

function buildReviewEventEntry({
  id,
  eventType,
  actorRole,
  actorName,
  remarks,
  sectionRemarks = [],
  timestamp,
}) {
  const isAdmin = actorRole === "admin";
  const label =
    String(actorName ?? "").trim() || (isAdmin ? "Principal" : "Teacher");
  const message = REVIEW_EVENT_MESSAGES[eventType] ?? eventType;
  const note = String(remarks ?? "").trim();

  return {
    id,
    eventType,
    role: label,
    initials: initialsFromName(label),
    message: note ? `${message} — ${note}` : message,
    sectionRemarks: Array.isArray(sectionRemarks) ? sectionRemarks : [],
    date: formatDateTime(timestamp),
    side: isAdmin ? "right" : "left",
  };
}

/**
 * Lesson plans submitted before lesson_plan_events existed have no recorded
 * history, so reconstruct only what the current row can prove.
 */
function derivedReviewHistory(planRow) {
  if (!planRow) return [];

  const entries = [];

  if (planRow.submitted_at) {
    entries.push(
      buildReviewEventEntry({
        id: `${planRow.id}-submitted`,
        eventType: "Submitted",
        actorRole: "teacher",
        actorName: formatTeacherName(unwrapRelation(planRow.teachers)),
        timestamp: planRow.submitted_at,
      })
    );
  }

  if (
    planRow.reviewed_at &&
    ["Approved", "Needs Revision"].includes(planRow.status)
  ) {
    entries.push(
      buildReviewEventEntry({
        id: `${planRow.id}-${planRow.status}`,
        eventType: planRow.status,
        actorRole: "admin",
        actorName:
          planRow.reviewed_by_name ||
          unwrapRelation(planRow.reviewed_profile)?.full_name ||
          "Principal",
        remarks: planRow.remarks,
        sectionRemarks: planRow.section_remarks,
        timestamp: planRow.reviewed_at,
      })
    );
  }

  return entries;
}

export function mapLessonPlanEventsForAdmin(events = [], planRow = null) {
  const mapped = (events ?? []).map((event) =>
    buildReviewEventEntry({
      id: event.id,
      eventType: event.event_type,
      actorRole: event.actor_role,
      actorName: event.actor_name,
      remarks: event.remarks,
      sectionRemarks: event.section_remarks,
      timestamp: event.created_at,
    })
  );

  return mapped.length ? mapped : derivedReviewHistory(planRow);
}

function relativeActivityTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startToday - startThat) / 86400000);

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return "This Week";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function unwrapTeacherName(teachers) {
  const teacher = Array.isArray(teachers) ? teachers[0] : teachers;
  if (!teacher) return null;
  return (
    [teacher.first_name, teacher.middle_name, teacher.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || null
  );
}

/**
 * Sidebar feed items for Admin Lesson Plan Review → Recent Activity.
 */
export function mapRecentLessonPlanActivity(events = []) {
  return (events ?? []).map((event) => {
    const plan = Array.isArray(event.lesson_plans)
      ? event.lesson_plans[0]
      : event.lesson_plans;
    const teacherName = unwrapTeacherName(plan?.teachers);
    const actor = String(event.actor_name ?? "").trim();
    const title = String(plan?.lesson_title ?? "").trim();
    const who = teacherName || actor || "Teacher";
    const eventType = String(event.event_type ?? "");

    let type = "submit";
    let tone = "green";
    let text = `Lesson plan update (${who})`;

    if (eventType === "Submitted") {
      type = "submit";
      tone = "green";
      text = title
        ? `“${title}” submitted by ${who}`
        : `Lesson plan submitted by ${who}`;
    } else if (eventType === "Approved") {
      type = "approve";
      tone = "green";
      text = title
        ? `“${title}” approved (${who})`
        : `Lesson plan approved (${who})`;
    } else if (eventType === "Needs Revision") {
      type = "revision";
      tone = "orange";
      text = title
        ? `“${title}” returned for revision (${who})`
        : `Lesson plan returned for revision (${who})`;
    } else if (eventType === "Resubmitted") {
      type = "resubmit";
      tone = "purple";
      text = title
        ? `${who} resubmitted “${title}”`
        : `${who} resubmitted a lesson plan`;
    } else if (eventType === "Under Review") {
      type = "submit";
      tone = "green";
      text = title
        ? `“${title}” opened for review`
        : `Lesson plan opened for review`;
    }

    return {
      id: event.id,
      type,
      text,
      time: relativeActivityTime(event.created_at),
      tone,
    };
  });
}

export function buildReviewTimeline(status) {
  const normalized = status || "Pending Review";
  return [
    {
      id: "submitted",
      label: "Submitted",
      done: true,
    },
    {
      id: "review",
      label: "Under Review",
      done:
        normalized === "Under Review" ||
        normalized === "Approved" ||
        normalized === "Needs Revision",
    },
    {
      id: "approved",
      label: "Approved",
      done: normalized === "Approved",
    },
    {
      id: "revision",
      label: "Needs Revision",
      done: normalized === "Needs Revision",
    },
  ];
}
