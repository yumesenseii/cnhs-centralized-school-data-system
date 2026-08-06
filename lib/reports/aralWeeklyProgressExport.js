/**
 * Export ARAL Learners weekly progress by grade & section (Excel).
 * For Summer ARAL facilitators / HT offline review.
 */

import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import { withWeekNumbers } from "@/lib/monitoring/aralProgress";
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
 * One Excel row per weekly monitoring record; learners with no updates
 * still appear once with empty week fields.
 */
export function buildAralWeeklyProgressRows({
  learners = [],
  records = [],
  facilitatorName = "—",
} = {}) {
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
    const withWeeks = withWeekNumbers(mapped);

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
 * @param {object} options
 * @param {object[]} options.learners — assignments in that section
 * @param {string} options.gradeSection
 * @param {string} [options.schoolYear]
 * @param {string} [options.generatedBy]
 * @param {string} [options.facilitatorName]
 */
export async function exportAralWeeklyProgressBySectionExcel({
  learners = [],
  gradeSection = "Section",
  schoolYear = "",
  generatedBy = "CNHS Staff",
  facilitatorName = "—",
} = {}) {
  const studentIds = learners.map((l) => l.studentId).filter(Boolean);
  const classIds = learners.map((l) => l.sourceClassId).filter(Boolean);

  const recordsResult = await listMonitoringRecordsForStudents({
    studentIds,
    classIds,
  });
  if (recordsResult.error) {
    throw recordsResult.error;
  }

  // Keep only records that match an assignment pair (student + source class).
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
  });

  const updatedCount = tableRows.filter(
    (row) => row.weekLabel && row.weekLabel !== "—"
  ).length;
  const pendingLearners = learners.filter((learner) => {
    const key = `${learner.studentId}::${learner.sourceClassId}`;
    return !scopedRecords.some(
      (r) => `${r.student_id}::${r.class_id}` === key
    );
  }).length;

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

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "ARAL Weekly Progress — by Section",
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
        label: "Weekly updates",
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
        value: gradeSection,
        tone: "default",
      },
    ],
    chartSeries: [],
    table: {
      sheetName: "Detailed Report",
      title: `ARAL Weekly Progress — ${gradeSection} · ${sy}`,
      columns,
      rows: tableRows,
    },
    coverNarrative:
      learners.length > 0
        ? `This report lists Summer ARAL Program weekly progress for ${learners.length} learner(s) in ${gradeSection}. Facilitators submit weekly updates; Head Teacher review is view-only.`
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
  const filename = `CNHS-ARAL-Weekly-${safeToken(gradeSection)}-${safeToken(sy)}-${dateStamp}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { count: tableRows.length, filename };
}
