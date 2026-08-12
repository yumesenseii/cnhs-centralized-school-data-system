/**
 * Export ARAL Learners weekly progress by grade & section (Excel).
 * For Summer ARAL facilitators / HT offline review.
 */

import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import {
  ARAL_PROGRESS_OPTIONS,
  ARAL_WEEKLY_INTERVENTION,
  withWeekNumbers,
} from "@/lib/monitoring/aralProgress";
import { MONITORING_STATUS } from "@/lib/monitoring/recommendations";
import { weekNumberFromRemarks } from "@/lib/monitoring/aralSectionFiles";
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

function resolveWeekNumber(record) {
  const tagged = weekNumberFromRemarks(record.teacherRemarks);
  if (tagged) return tagged;
  return record.weekNumber || null;
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

function parseProgress(value) {
  const s = String(value ?? "").trim();
  if (isPlaceholder(s)) return ARAL_PROGRESS_OPTIONS[2];
  const match = ARAL_PROGRESS_OPTIONS.find(
    (option) => option.toLowerCase() === s.toLowerCase()
  );
  return match || s;
}

function parseStatus(value) {
  const s = String(value ?? "").trim();
  if (isPlaceholder(s) || s.toLowerCase() === "not started") {
    return MONITORING_STATUS.ONGOING;
  }
  const options = Object.values(MONITORING_STATUS);
  const match = options.find((option) => option.toLowerCase() === s.toLowerCase());
  return match || MONITORING_STATUS.ONGOING;
}

/**
 * Parse a weekly monitoring workbook against the section roster.
 */
export function parseAralWeeklyWorkbook(
  buffer,
  { learners = [], weekNumber = 1 } = {}
) {
  const table = readAralWorkbookTable(buffer, { preferredSheet: "detail" });
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

  const headerKeys = new Set(table.headers.filter(Boolean));
  const hasStudentCol = ARAL_STUDENT_NUMBER_KEYS.some((key) =>
    headerKeys.has(key)
  );
  if (!hasStudentCol) {
    return {
      rows: [],
      errors: [
        "Workbook columns do not match this section. Missing Student Number. Weekly files need Student Number, Observation Date, Intervention, Weekly Progress, Monitoring Status, and Remarks.",
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
  const today = new Date().toISOString().slice(0, 10);

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

    const observationDate =
      parseIsoDate(
        pickAralCell(normalized, [
          "observation_date",
          "date",
          "observation",
        ])
      ) || today;
    const remarksRaw = String(
      pickAralCell(normalized, ["remarks", "teacher_remarks", "comment"]) ?? ""
    )
      .trim()
      .replace(/^\[Week\s+\d+\]\s*/i, "");
    const progress = parseProgress(
      pickAralCell(normalized, [
        "weekly_progress",
        "student_progress",
        "progress",
      ])
    );
    const status = parseStatus(
      pickAralCell(normalized, ["monitoring_status", "status"])
    );
    const intervention =
      String(
        pickAralCell(normalized, ["intervention", "intervention_given"]) ?? ""
      ).trim() || ARAL_WEEKLY_INTERVENTION;

    if (
      isPlaceholder(
        pickAralCell(normalized, ["observation_date", "date", "observation"])
      ) &&
      isPlaceholder(remarksRaw) &&
      (status === MONITORING_STATUS.ONGOING ||
        String(
          pickAralCell(normalized, ["monitoring_status", "status"]) ?? ""
        ).toLowerCase() === "not started")
    ) {
      skipped += 1;
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
        interventionGiven: intervention === "—" ? ARAL_WEEKLY_INTERVENTION : intervention,
        studentProgress: progress,
        monitoringStatus: status,
        teacherRemarks: remarksRaw === "—" ? "" : remarksRaw,
        followUpNeeded: parseFollowUp(
          pickAralCell(normalized, ["follow_up", "follow_up_needed", "followup"])
        ),
      });
    }
  });

  if (!rows.length && !errors.length) {
    errors.push(
      "No matching students with weekly updates were found. Check Student Number values against this section roster."
    );
  }

  return { rows, errors, skipped };
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
      });
    }
    const group = bySection.get(key);
    group.learners.push(row);
    if (!group.schoolYear && row.schoolYear) {
      group.schoolYear = row.schoolYear;
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
    const mapped = raw.map((record) => ({
      id: record.id,
      observationDateRaw: record.observation_date,
      observationDate: formatRecordDate(record.observation_date),
      interventionGiven: record.intervention_given || "—",
      teacherRemarks: record.teacher_remarks || "—",
      studentProgress: record.student_progress || "—",
      monitoringStatus: record.monitoring_status || "—",
      followUpNeeded: record.follow_up_needed ? "Yes" : "No",
    }));
    const withWeeks = withWeekNumbers(mapped).map((row) => {
      const n = resolveWeekNumber(row);
      return {
        ...row,
        weekNumber: n,
        weekLabel: n ? `Week ${n}` : row.weekLabel || "—",
      };
    });

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
    { key: "observationDate", header: "Observation Date", width: 14 },
    { key: "interventionGiven", header: "Intervention", width: 22 },
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
