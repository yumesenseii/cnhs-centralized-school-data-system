/**
 * Export ARAL Learners weekly progress by grade & section (Excel).
 * For Summer ARAL facilitators / HT offline review.
 */

import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import ExcelJS from "exceljs";
import {
  ARAL_FOCUS_OPTIONS,
  ARAL_PROGRESS_OPTIONS,
  ARAL_REMARKS_MAX,
  ARAL_SESSION_LABELS,
  ARAL_SESSION_OPTIONS,
  ARAL_WEEKLY_INTERVENTION,
  clipAralRemarks,
  emptyAralSessionDays,
  hasAralSessionDayMark,
  parseAralFocus,
  parseAralProgress,
  parseAralSessionStatus,
  resolveStoredWeekNumber,
  sessionDaysFromRecord,
  stripAralWeekPrefix,
  summarizeAralSessionStatus,
  ARAL_WEEKDAY_KEYS,
  ARAL_WEEKDAY_LABELS,
} from "@/lib/monitoring/aralProgress";
import { MONITORING_STATUS } from "@/lib/monitoring/recommendations";
import {
  ARAL_STUDENT_NUMBER_KEYS,
  normalizeStudentNumber,
  pickAralCell,
  readAralWorkbookTable,
} from "@/lib/reports/aralExcelParse";
import { listMonitoringRecordsForStudents } from "@/lib/supabase/queries/monitoring";

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

function formatRecordDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const WEEKLY_ALLOWED_HEADERS = new Set([
  ...ARAL_STUDENT_NUMBER_KEYS,
  "learner_name",
  "name",
  "week",
  "week_label",
  "week_number",
  "session_date",
  "observation_date",
  "date",
  "session",
  "session_status",
  "aral_session",
  "mon",
  "monday",
  "tue",
  "tues",
  "tuesday",
  "wed",
  "wednesday",
  "thu",
  "thur",
  "thurs",
  "thursday",
  "fri",
  "friday",
  "focus",
  "skill_focus",
  "weekly_progress",
  "student_progress",
  "progress",
  "monitoring_status",
  "status",
  "follow_up",
  "follow_up_needed",
  "followup",
  "remarks",
  "teacher_remarks",
  "comment",
  "topic",
  "activity",
]);

function resolveWeekNumber(record) {
  return resolveStoredWeekNumber({
    week_number: record.weekNumber ?? record.week_number,
    teacherRemarks: record.teacherRemarks,
    teacher_remarks: record.teacher_remarks,
  });
}

function isPlaceholder(value) {
  const s = String(value ?? "").trim();
  return !s || s === "—";
}

function parseIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const utc = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(value ?? "").trim();
  if (isPlaceholder(s)) return null;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseWeekLabel(value) {
  const match = String(value ?? "").match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFollowUp(value) {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "yes" || s === "true" || s === "1";
}

function parseStatus(value) {
  const s = String(value ?? "").trim();
  if (isPlaceholder(s) || s.toLowerCase() === "not started") return null;
  const options = Object.values(MONITORING_STATUS);
  return options.find((option) => option.toLowerCase() === s.toLowerCase()) || null;
}

const DAY_HEADER_ALIASES = {
  mon: ["mon", "monday"],
  tue: ["tue", "tues", "tuesday"],
  wed: ["wed", "wednesday"],
  thu: ["thu", "thur", "thurs", "thursday"],
  fri: ["fri", "friday"],
};

function headerHasDayColumns(headerSet) {
  return ARAL_WEEKDAY_KEYS.some((key) =>
    DAY_HEADER_ALIASES[key].some((alias) => headerSet.has(alias))
  );
}

/**
 * Parse a weekly monitoring workbook against the section roster.
 * Rejects extra columns and unknown progress values. Does not invent rows.
 */
export function parseAralWeeklyWorkbook(
  buffer,
  { learners = [], weekNumber = 1 } = {}
) {
  const table = readAralWorkbookTable(buffer, { preferredSheet: "weekly" });
  if (table.errors.length) {
    return { rows: [], errors: table.errors, skipped: 0 };
  }
  if (!table.rows.length) {
    return {
      rows: [],
      errors: ["No data rows found on the weekly sheet."],
      skipped: 0,
    };
  }

  const headerKeys = table.headers.filter(Boolean);
  const extra = headerKeys.filter((key) => !WEEKLY_ALLOWED_HEADERS.has(key));
  if (extra.length) {
    return {
      rows: [],
      errors: [
        `Workbook has extra columns (${extra.slice(0, 6).join(", ")}). Download the weekly template and use only those columns.`,
      ],
      skipped: 0,
    };
  }

  const headerSet = new Set(headerKeys);
  const hasStudentCol = ARAL_STUDENT_NUMBER_KEYS.some((key) => headerSet.has(key));
  const hasDayCol = headerHasDayColumns(headerSet);
  const hasProgressCol = ["weekly_progress", "student_progress", "progress"].some(
    (key) => headerSet.has(key)
  );
  const hasTopicCol = headerSet.has("topic") || headerSet.has("activity");
  if (!hasStudentCol || (!hasDayCol && !hasProgressCol && !hasTopicCol)) {
    return {
      rows: [],
      errors: [
        "Workbook columns do not match the weekly template. Need Student Number / LRN and Mon–Fri session (or Topic / Weekly Progress).",
      ],
      skipped: 0,
    };
  }

  const byNumber = new Map();
  for (const learner of learners) {
    const key = normalizeStudentNumber(learner.studentNumber);
    if (!key) continue;
    if (!byNumber.has(key)) byNumber.set(key, []);
    byNumber.get(key).push(learner);
  }

  const resolvedWeek = Number(weekNumber) > 0 ? Number(weekNumber) : 1;
  const rows = [];
  const errors = [];
  let skipped = 0;

  table.rows.forEach((normalized, index) => {
    const studentNumberRaw = pickAralCell(normalized, ARAL_STUDENT_NUMBER_KEYS);
    const studentNumber = String(studentNumberRaw ?? "").trim();
    if (!studentNumber) {
      skipped += 1;
      return;
    }

    const matches = byNumber.get(normalizeStudentNumber(studentNumber));
    if (!matches?.length) {
      errors.push(
        `Row ${index + 2}: student number “${studentNumber}” is not in this section roster.`
      );
      return;
    }

    const dateRaw = pickAralCell(normalized, [
      "session_date",
      "observation_date",
      "date",
    ]);
    const progressRaw = pickAralCell(normalized, [
      "weekly_progress",
      "student_progress",
      "progress",
    ]);
    const sessionRaw = pickAralCell(normalized, [
      "session",
      "session_status",
      "aral_session",
    ]);
    const focusRaw = pickAralCell(normalized, ["focus", "skill_focus"]);
    const remarksRaw = stripAralWeekPrefix(
      pickAralCell(normalized, ["remarks", "teacher_remarks", "comment"])
    );
    const topicRaw = pickAralCell(normalized, ["topic"]);
    const activityRaw = pickAralCell(normalized, ["activity"]);

    const sessionDays = emptyAralSessionDays();
    if (hasDayCol) {
      for (const key of ARAL_WEEKDAY_KEYS) {
        const raw = pickAralCell(normalized, DAY_HEADER_ALIASES[key]);
        if (isPlaceholder(raw)) continue;
        const mark = parseAralSessionStatus(raw);
        if (!mark) {
          errors.push(
            `Row ${index + 2}: ${ARAL_WEEKDAY_LABELS[key]} must be Present, Absent, or Excused.`
          );
          return;
        }
        sessionDays[key] = mark;
      }
    }

    const emptyRow =
      !hasAralSessionDayMark(sessionDays) &&
      isPlaceholder(progressRaw) &&
      isPlaceholder(remarksRaw) &&
      isPlaceholder(topicRaw) &&
      isPlaceholder(activityRaw) &&
      isPlaceholder(focusRaw) &&
      isPlaceholder(sessionRaw) &&
      isPlaceholder(dateRaw);
    if (emptyRow) {
      skipped += 1;
      return;
    }

    const observationDate = parseIsoDate(dateRaw);
    if (!hasDayCol) {
      if (!isPlaceholder(sessionRaw) && !parseAralSessionStatus(sessionRaw)) {
        errors.push(
          `Row ${index + 2}: Session must be Present, Absent, or Excused.`
        );
        return;
      }
      const legacyMark = parseAralSessionStatus(sessionRaw);
      if (legacyMark && observationDate) {
        const mapped = sessionDaysFromRecord({
          session_status: legacyMark,
          observation_date: observationDate,
        });
        Object.assign(sessionDays, mapped);
      }
    }

    let progress = null;
    if (!isPlaceholder(progressRaw)) {
      progress = parseAralProgress(progressRaw);
      if (!progress) {
        errors.push(
          `Row ${index + 2}: unknown Weekly Progress “${progressRaw}”. Use ${ARAL_PROGRESS_OPTIONS.join(", ")}.`
        );
        return;
      }
    }

    if (!isPlaceholder(focusRaw) && !parseAralFocus(focusRaw)) {
      errors.push(
        `Row ${index + 2}: Focus must be Reading, Writing, Grammar, or Comprehension.`
      );
      return;
    }

    const statusRaw = pickAralCell(normalized, ["monitoring_status", "status"]);
    const status = parseStatus(statusRaw);
    if (!isPlaceholder(statusRaw) && !status) {
      errors.push(`Row ${index + 2}: unknown Monitoring Status “${statusRaw}”.`);
      return;
    }

    const fileWeek = parseWeekLabel(
      pickAralCell(normalized, ["week", "week_label", "week_number"])
    );

    for (const learner of matches) {
      rows.push({
        learner,
        weekNumber: fileWeek || resolvedWeek,
        observationDate,
        sessionDays,
        sessionStatus: summarizeAralSessionStatus(sessionDays),
        skillFocus: parseAralFocus(focusRaw),
        interventionGiven: ARAL_WEEKLY_INTERVENTION,
        studentProgress: progress,
        monitoringStatus: status || MONITORING_STATUS.ONGOING,
        teacherRemarks: clipAralRemarks(remarksRaw === "—" ? "" : remarksRaw),
        topic:
          topicRaw && topicRaw !== "—" ? String(topicRaw).trim().slice(0, 80) : "",
        activity:
          activityRaw && activityRaw !== "—"
            ? String(activityRaw).trim().slice(0, 80)
            : "",
        followUpNeeded: parseFollowUp(
          pickAralCell(normalized, ["follow_up", "follow_up_needed", "followup"])
        ),
      });
    }
  });

  if (!rows.length && !errors.length) {
    errors.push(
      "No matching students with weekly updates were found. Fill Mon–Fri or week-level fields. Empty rows are skipped."
    );
  }

  return { rows, errors, skipped };
}

/**
 * Fillable weekly template — same locked columns as the in-app grid.
 */
export async function downloadAralWeeklyTemplateExcel({
  learners = [],
  records = [],
  gradeSection = "Section",
  schoolYear = "",
  weekNumber = 1,
  generatedBy = "Facilitator",
} = {}) {
  const week = Number(weekNumber) > 0 ? Number(weekNumber) : 1;
  const byLearner = new Map();
  for (const record of records) {
    if (resolveStoredWeekNumber(record) !== week) continue;
    byLearner.set(`${record.student_id}::${record.class_id}`, record);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CNHS Learn";
  workbook.created = new Date();

  const lists = workbook.addWorksheet("Lists");
  lists.state = "veryHidden";
  lists.getCell("A1").value = "Session";
  ARAL_SESSION_OPTIONS.forEach((value, index) => {
    lists.getCell(`A${index + 2}`).value = ARAL_SESSION_LABELS[value];
  });
  lists.getCell("B1").value = "Focus";
  ARAL_FOCUS_OPTIONS.forEach((value, index) => {
    lists.getCell(`B${index + 2}`).value = value;
  });
  lists.getCell("C1").value = "Progress";
  ARAL_PROGRESS_OPTIONS.forEach((value, index) => {
    lists.getCell(`C${index + 2}`).value = value;
  });
  lists.getCell("D1").value = "Status";
  [
    MONITORING_STATUS.ONGOING,
    MONITORING_STATUS.IMPROVED,
    MONITORING_STATUS.NEEDS_FOLLOW_UP,
    MONITORING_STATUS.COMPLETED,
  ].forEach((value, index) => {
    lists.getCell(`D${index + 2}`).value = value;
  });
  lists.getCell("E1").value = "FollowUp";
  lists.getCell("E2").value = "Yes";
  lists.getCell("E3").value = "No";

  const meta = workbook.addWorksheet("Meta");
  meta.getColumn(1).width = 18;
  meta.getColumn(2).width = 40;
  meta.addRow(["School", "CAMBAOG NATIONAL HIGH SCHOOL"]);
  meta.addRow(["Report", `ARAL Weekly Progress — Week ${week}`]);
  meta.addRow(["GradeSection", gradeSection]);
  meta.addRow(["Week", week]);
  meta.addRow(["SchoolYear", schoolYear || "—"]);
  meta.addRow(["GeneratedBy", generatedBy]);
  meta.addRow([
    "Instructions",
    "Fill Weekly sheet only. LRN and name are locked. Mon–Fri is ARAL session only (not SF2). Blank is not Absent. Progress must be one of the dropdown values. Remarks max 200 characters. Empty rows are skipped.",
  ]);

  const sheet = workbook.addWorksheet("Weekly");
  sheet.columns = [
    { header: "Student Number", key: "studentNumber", width: 18 },
    { header: "Learner Name", key: "learnerName", width: 28 },
    { header: "Week", key: "week", width: 10 },
    { header: "Mon", key: "mon", width: 12 },
    { header: "Tue", key: "tue", width: 12 },
    { header: "Wed", key: "wed", width: 12 },
    { header: "Thu", key: "thu", width: 12 },
    { header: "Fri", key: "fri", width: 12 },
    { header: "Topic", key: "topic", width: 18 },
    { header: "Activity", key: "activity", width: 18 },
    { header: "Focus", key: "focus", width: 16 },
    { header: "Weekly Progress", key: "progress", width: 22 },
    { header: "Remarks", key: "remarks", width: 36 },
  ];
  sheet.getRow(1).font = { bold: true };

  learners.forEach((learner) => {
    const rec = byLearner.get(`${learner.studentId}::${learner.sourceClassId}`);
    const days = sessionDaysFromRecord(rec || {});
    sheet.addRow({
      studentNumber: learner.studentNumber || "",
      learnerName: learner.studentName || "",
      week: `Week ${week}`,
      mon: days.mon ? ARAL_SESSION_LABELS[days.mon] : "",
      tue: days.tue ? ARAL_SESSION_LABELS[days.tue] : "",
      wed: days.wed ? ARAL_SESSION_LABELS[days.wed] : "",
      thu: days.thu ? ARAL_SESSION_LABELS[days.thu] : "",
      fri: days.fri ? ARAL_SESSION_LABELS[days.fri] : "",
      topic: rec?.topic || "",
      activity: rec?.activity || "",
      focus: rec?.skill_focus || "",
      progress: rec?.student_progress || "",
      remarks: clipAralRemarks(stripAralWeekPrefix(rec?.teacher_remarks)),
    });
  });

  const last = Math.max(learners.length + 1, 2);
  const addList = (range, formula) => {
    sheet.dataValidations.add(range, {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorTitle: "Invalid value",
      error: "Choose a value from the dropdown.",
    });
  };
  addList(`D2:H${last}`, "Lists!$A$2:$A$4");
  addList(`K2:K${last}`, "Lists!$B$2:$B$5");
  addList(`L2:L${last}`, "Lists!$C$2:$C$5");

  for (let r = 2; r <= last; r += 1) {
    ["A", "B", "C"].forEach((col) => {
      sheet.getCell(`${col}${r}`).protection = { locked: true };
    });
    ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"].forEach((col) => {
      sheet.getCell(`${col}${r}`).protection = { locked: false };
    });
  }
  await sheet.protect("cnhs-aral-weekly", {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  const filename = `ARAL-Weekly-Week-${week}-${safeToken(gradeSection)}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { count: learners.length, filename };
}

/**
 * Group facilitator assignments by gradeSection.
 * @param {object[]} assignments
 */
export function groupAralAssignmentsBySection(assignments = []) {
  const bySection = new Map();

  for (const row of assignments) {
    const key = String(row.gradeSection || "Unassigned section").trim();
    if (!bySection.has(key)) {
      bySection.set(key, {
        gradeSection: key,
        learners: [],
        schoolYear: row.schoolYear || "",
        batchName: row.batchName || "",
      });
    }
    const group = bySection.get(key);
    group.learners.push(row);
    if (!group.schoolYear && row.schoolYear) {
      group.schoolYear = row.schoolYear;
    }
    if (!group.batchName && row.batchName) {
      group.batchName = row.batchName;
    }
  }

  return [...bySection.values()]
    .map((group) => ({
      ...group,
      count: group.learners.length,
    }))
    .sort((a, b) =>
      String(a.gradeSection).localeCompare(String(b.gradeSection))
    );
}

/**
 * Build flat export rows for one section's assigned ARAL learners.
 * When weekNumber is set, one row per learner for that week only.
 */
export function buildAralWeeklyProgressRows({
  learners = [],
  records = [],
  facilitatorName = "—",
  weekNumber = null,
} = {}) {
  const targetWeek =
    weekNumber != null && Number(weekNumber) > 0 ? Number(weekNumber) : null;

  const recordsByStudentClass = new Map();
  for (const record of records) {
    const key = `${record.student_id}::${record.class_id}`;
    if (!recordsByStudentClass.has(key)) {
      recordsByStudentClass.set(key, []);
    }
    recordsByStudentClass.get(key).push(record);
  }

  const rows = [];

  for (const learner of learners) {
    const key = `${learner.studentId}::${learner.sourceClassId}`;
    const raw = recordsByStudentClass.get(key) ?? [];
    const withWeeks = raw
      .map((record) => {
        const n = resolveStoredWeekNumber(record);
        return {
          id: record.id,
          observationDateRaw: record.observation_date,
          observationDate: formatRecordDate(record.observation_date),
          interventionGiven: record.intervention_given || "—",
          teacherRemarks: clipAralRemarks(
            stripAralWeekPrefix(record.teacher_remarks)
          ) || "—",
          studentProgress: record.student_progress || "—",
          monitoringStatus: record.monitoring_status || "—",
          followUpNeeded: record.follow_up_needed ? "Yes" : "No",
          sessionStatus: record.session_status
            ? ARAL_SESSION_LABELS[record.session_status] || record.session_status
            : "—",
          skillFocus: record.skill_focus || "—",
          weekNumber: n,
          weekLabel: n ? `Week ${n}` : "—",
        };
      })
      .filter((row) => row.weekNumber != null);

    if (targetWeek != null) {
      const match =
        withWeeks.find((row) => row.weekNumber === targetWeek) || null;
      rows.push({
        studentName: learner.studentName,
        studentNumber: learner.studentNumber,
        gradeSection: learner.gradeSection,
        subject: learner.subject,
        facilitator: facilitatorName,
        weekLabel: `Week ${targetWeek}`,
        observationDate: match?.observationDate || "—",
        sessionStatus: match?.sessionStatus || "—",
        skillFocus: match?.skillFocus || "—",
        interventionGiven: match?.interventionGiven || "—",
        studentProgress: match?.studentProgress || "—",
        monitoringStatus: match?.monitoringStatus || "Not Started",
        teacherRemarks: match?.teacherRemarks || "—",
        followUpNeeded: match?.followUpNeeded || "—",
        schoolYear: learner.schoolYear || "—",
      });
      continue;
    }

    if (!withWeeks.length) {
      rows.push({
        studentName: learner.studentName,
        studentNumber: learner.studentNumber,
        gradeSection: learner.gradeSection,
        subject: learner.subject,
        facilitator: facilitatorName,
        weekLabel: "—",
        observationDate: "—",
        sessionStatus: "—",
        skillFocus: "—",
        interventionGiven: "—",
        studentProgress: "—",
        monitoringStatus: "Not Started",
        teacherRemarks: "No weekly updates yet",
        followUpNeeded: "—",
        schoolYear: learner.schoolYear || "—",
      });
      continue;
    }

    for (const record of withWeeks) {
      rows.push({
        studentName: learner.studentName,
        studentNumber: learner.studentNumber,
        gradeSection: learner.gradeSection,
        subject: learner.subject,
        facilitator: facilitatorName,
        weekLabel: record.weekLabel,
        observationDate: record.observationDate,
        sessionStatus: record.sessionStatus,
        skillFocus: record.skillFocus,
        interventionGiven: record.interventionGiven,
        studentProgress: record.studentProgress,
        monitoringStatus: record.monitoringStatus,
        teacherRemarks: record.teacherRemarks,
        followUpNeeded: record.followUpNeeded,
        schoolYear: learner.schoolYear || "—",
      });
    }
  }

  return rows;
}

/**
 * Export weekly ARAL progress Excel for one grade & section.
 * @param {number|null} [options.weekNumber] — when set, export that week only
 */
export async function exportAralWeeklyProgressBySectionExcel({
  learners = [],
  gradeSection = "Section",
  schoolYear = "",
  generatedBy = "CNHS Staff",
  facilitatorName = "—",
  weekNumber = null,
} = {}) {
  const studentIds = learners.map((l) => l.studentId).filter(Boolean);
  const classIds = learners.map((l) => l.sourceClassId).filter(Boolean);
  const targetWeek =
    weekNumber != null && Number(weekNumber) > 0 ? Number(weekNumber) : null;

  const recordsResult = await listMonitoringRecordsForStudents({
    studentIds,
    classIds,
  });
  if (recordsResult.error) {
    throw recordsResult.error;
  }

  const pairKeys = new Set(
    learners
      .filter((l) => l.studentId && l.sourceClassId)
      .map((l) => `${l.studentId}::${l.sourceClassId}`)
  );
  const scopedRecords = (recordsResult.data ?? []).filter((row) =>
    pairKeys.has(`${row.student_id}::${row.class_id}`)
  );

  const tableRows = buildAralWeeklyProgressRows({
    learners,
    records: scopedRecords,
    facilitatorName,
    weekNumber: targetWeek,
  });

  const updatedCount = tableRows.filter(
    (row) =>
      row.observationDate &&
      row.observationDate !== "—" &&
      row.monitoringStatus !== "Not Started"
  ).length;
  const pendingLearners = tableRows.filter(
    (row) =>
      !row.observationDate ||
      row.observationDate === "—" ||
      row.monitoringStatus === "Not Started"
  ).length;

  const columns = [
    { key: "studentName", header: "Learner Name", width: 22 },
    { key: "studentNumber", header: "Student Number / LRN", width: 18 },
    { key: "gradeSection", header: "Grade & Section", width: 16 },
    { key: "subject", header: "Subject", width: 14 },
    { key: "facilitator", header: "Facilitator", width: 18 },
    { key: "weekLabel", header: "Week", width: 10 },
    { key: "observationDate", header: "Session Date", width: 14 },
    { key: "sessionStatus", header: "Session", width: 12 },
    { key: "skillFocus", header: "Focus", width: 14 },
    { key: "studentProgress", header: "Weekly Progress", width: 18 },
    {
      key: "monitoringStatus",
      header: "Monitoring Status",
      width: 14,
      statusRule: true,
    },
    { key: "teacherRemarks", header: "Remarks", width: 36 },
    { key: "followUpNeeded", header: "Follow-up", width: 10 },
  ];

  const sy = schoolYear || learners[0]?.schoolYear || "—";
  const weekTitle =
    targetWeek != null ? `Week ${targetWeek}` : "All weeks";
  const reportTitle =
    targetWeek != null
      ? `ARAL Weekly Progress — Week ${targetWeek}`
      : "ARAL Weekly Progress — by Section";

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle,
      schoolYear: sy,
      quarter: "Summer ARAL",
      generatedBy,
      totalRecords: tableRows.length,
    },
    metrics: [
      {
        label: "Learners in section",
        value: learners.length,
        tone: "default",
      },
      {
        label: targetWeek != null ? `${weekTitle} updated` : "Weekly updates",
        value: updatedCount,
        tone: updatedCount > 0 ? "green" : "amber",
      },
      {
        label: "No updates yet",
        value: pendingLearners,
        tone: pendingLearners > 0 ? "amber" : "green",
      },
      {
        label: "Scope",
        value:
          targetWeek != null
            ? `${gradeSection} · ${weekTitle}`
            : gradeSection,
        tone: "default",
      },
    ],
    chartSeries: [],
    table: {
      sheetName: "Detailed Report",
      title: `ARAL Weekly Progress — ${gradeSection} · ${weekTitle} · ${sy}`,
      columns,
      rows: tableRows,
    },
    coverNarrative:
      learners.length > 0
        ? targetWeek != null
          ? `This file lists Summer ARAL Program ${weekTitle} progress for ${learners.length} learner(s) in ${gradeSection}. Edit in the portal; this download is an offline copy.`
          : `This report lists Summer ARAL Program weekly progress for ${learners.length} learner(s) in ${gradeSection}. Facilitators submit weekly updates; Head Teacher review is view-only.`
        : `No ARAL learners are assigned in ${gradeSection}.`,
    narrativeContext: {
      totalClasses: 1,
      totalStudents: learners.length,
      atRisk: learners.length,
      aralLearners: learners.length,
      classroomRemedial: 0,
      averageGrade: null,
    },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename =
    targetWeek != null
      ? `CNHS-ARAL-Weekly-Week-${targetWeek}-${safeToken(gradeSection)}-${safeToken(sy)}-${dateStamp}.xlsx`
      : `CNHS-ARAL-Weekly-${safeToken(gradeSection)}-${safeToken(sy)}-${dateStamp}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { count: tableRows.length, filename };
}
