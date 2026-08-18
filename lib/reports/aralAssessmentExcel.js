/**
 * ARAL Pre/Mid/Post assessment Excel template download + upload parse.
 * Simple Scores sheet for facilitator fill (ECR-like round-trip).
 */

import ExcelJS from "exceljs";
import { downloadWorkbook } from "@/lib/reports/excelOfficialTemplate";
import {
  aralAssessmentPhaseLabel,
  computeAralAssessmentResult,
  normalizeAralAssessmentPhase,
  parseOptionalScore,
} from "@/lib/monitoring/aralAssessments";
import {
  ARAL_STUDENT_NUMBER_KEYS,
  normalizeStudentNumber,
  pickAralCell,
  readAralWorkbookTable,
} from "@/lib/reports/aralExcelParse";

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}


/**
 * Download a scores snapshot for one section + phase (offline copy).
 * Prefills Student Number, Name, Score, Max, Notes, and Result from current drafts.
 */
export async function downloadAralAssessmentTemplateExcel({
  learners = [],
  drafts = {},
  gradeSection = "Section",
  phase = "pre",
  maxScore = 40,
  passPercent = 75,
  schoolYear = "",
  generatedBy = "Facilitator",
} = {}) {
  const resolvedPhase = normalizeAralAssessmentPhase(phase);
  const phaseLabel = aralAssessmentPhaseLabel(resolvedPhase);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CNHS Learn";
  workbook.created = new Date();

  const meta = workbook.addWorksheet("Meta");
  meta.getColumn(1).width = 18;
  meta.getColumn(2).width = 36;
  meta.addRow(["School", "CAMBAOG NATIONAL HIGH SCHOOL"]);
  meta.addRow(["Report", `ARAL ${phaseLabel} Scores`]);
  meta.addRow(["GradeSection", gradeSection]);
  meta.addRow(["Phase", resolvedPhase]);
  meta.addRow(["PhaseLabel", phaseLabel]);
  meta.addRow(["MaxScore", Number(maxScore) || 40]);
  meta.addRow(["PassPercent", Number(passPercent) || 75]);
  meta.addRow(["SchoolYear", schoolYear || "—"]);
  meta.addRow(["GeneratedBy", generatedBy]);
  meta.addRow([
    "Instructions",
    "Snapshot of saved scores. To replace scores, re-upload a Scores sheet from the ARAL Program file list.",
  ]);

  const sheet = workbook.addWorksheet("Scores");
  sheet.columns = [
    { header: "Student Number", key: "studentNumber", width: 18 },
    { header: "Learner Name", key: "learnerName", width: 28 },
    { header: "Score", key: "score", width: 10 },
    { header: "Max Score", key: "maxScore", width: 12 },
    { header: "Notes", key: "notes", width: 32 },
    { header: "Result", key: "result", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const learner of learners) {
    const draft = drafts[learner.studentId] || {};
    const scoreValue =
      draft.score === "" || draft.score == null ? null : Number(draft.score);
    const rowMax =
      draft.maxScore != null && Number(draft.maxScore) > 0
        ? Number(draft.maxScore)
        : Number(maxScore) || 40;
    const rowPass =
      draft.passPercent != null
        ? Number(draft.passPercent)
        : Number(passPercent) || 75;
    const result =
      draft.result ||
      computeAralAssessmentResult(scoreValue, rowMax, rowPass) ||
      "";
    sheet.addRow({
      studentNumber: learner.studentNumber,
      learnerName: learner.studentName,
      score: Number.isFinite(scoreValue) ? scoreValue : null,
      maxScore: rowMax,
      notes: draft.notes || "",
      result,
    });
  }

  const filename = `ARAL-${safeToken(phaseLabel)}-${safeToken(gradeSection)}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { filename, count: learners.length };
}

/**
 * Parse uploaded assessment workbook against a section roster.
 * @returns {{ rows: object[], errors: string[], skipped: number }}
 */
export function parseAralAssessmentWorkbook(
  buffer,
  { learners = [], passPercent = 75, defaultMaxScore = 40 } = {}
) {
  const table = readAralWorkbookTable(buffer, { preferredSheet: "score" });
  if (table.errors.length) {
    return { rows: [], errors: table.errors, skipped: 0 };
  }
  if (!table.rows.length) {
    return {
      rows: [],
      errors: ["No data rows found on the Scores sheet."],
      skipped: 0,
    };
  }

  const headerKeys = new Set(table.headers.filter(Boolean));
  const hasStudentCol = ARAL_STUDENT_NUMBER_KEYS.some((key) =>
    headerKeys.has(key)
  );
  const hasScoreCol = ["score", "raw_score", "points"].some((key) =>
    headerKeys.has(key)
  );
  if (!hasStudentCol || !hasScoreCol) {
    const missing = [];
    if (!hasStudentCol) missing.push("Student Number");
    if (!hasScoreCol) missing.push("Score");
    return {
      rows: [],
      errors: [
        `Workbook columns do not match this section. Missing: ${missing.join(" and ")}. Use a Scores sheet with Student Number and Score.`,
      ],
      skipped: 0,
    };
  }

  const byNumber = new Map();
  for (const learner of learners) {
    const key = normalizeStudentNumber(learner.studentNumber);
    if (key) byNumber.set(key, learner);
  }

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

    const learner = byNumber.get(normalizeStudentNumber(studentNumber));
    if (!learner) {
      errors.push(
        `Row ${index + 2}: student number “${studentNumber}” is not in this section roster.`
      );
      return;
    }

    const score = parseOptionalScore(
      pickAralCell(normalized, ["score", "raw_score", "points"])
    );
    const maxFromFile = parseOptionalScore(
      pickAralCell(normalized, ["max_score", "maximum", "max", "total"])
    );
    const notes = String(
      pickAralCell(normalized, ["notes", "remarks", "comment"]) ?? ""
    ).trim();

    if (score == null && !notes) {
      skipped += 1;
      return;
    }

    const maxScore =
      maxFromFile != null && maxFromFile > 0
        ? maxFromFile
        : Number(defaultMaxScore) || 40;
    if (score != null && score < 0) {
      errors.push(
        `Row ${index + 2}: score for ${studentNumber} cannot be negative.`
      );
      return;
    }
    if (score != null && score > maxScore) {
      errors.push(
        `Row ${index + 2}: score ${score} exceeds max ${maxScore} for ${studentNumber}.`
      );
      return;
    }

    rows.push({
      studentId: learner.studentId,
      assignmentId: learner.id,
      studentNumber: learner.studentNumber,
      studentName: learner.studentName,
      score,
      maxScore,
      passPercent: Number(passPercent) || 75,
      result: computeAralAssessmentResult(score, maxScore, passPercent),
      notes,
    });
  });

  if (!rows.length && !errors.length) {
    errors.push(
      "No matching students with scores were found. Check Student Number values against this section roster."
    );
  }

  return { rows, errors, skipped };
}

function formatScoreCell(score, max) {
  if (score == null) return "—";
  if (max == null) return String(score);
  return `${score}/${max}`;
}

/**
 * Download class + individual ARAL section summary Excel.
 */
export async function downloadAralSectionReportExcel({
  report,
  gradeSection = "Section",
  schoolYear = "",
  generatedBy = "Facilitator",
  facilitatorName = "—",
  weeklySummary = null,
} = {}) {
  const { buildOfficialExcelReport } = await import(
    "@/lib/reports/excelOfficialTemplate"
  );

  const phases = report?.phases ?? [];
  const individuals = report?.individuals ?? [];

  const summaryRows = phases.map((p) => ({
    phase: p.label,
    status: p.status,
    scored: `${p.scored}/${p.total}`,
    passed: p.passed,
    forAral: p.forAral,
    avgPercent:
      p.avgPercent == null ? "—" : `${p.avgPercent.toFixed(1)}%`,
  }));

  const detailRows = individuals.map((row) => ({
    studentName: row.studentName,
    studentNumber: row.studentNumber,
    pre: formatScoreCell(row.preScore, row.preMax),
    preResult: row.preResult || "—",
    mid: formatScoreCell(row.midScore, row.midMax),
    midResult: row.midResult || "—",
    post: formatScoreCell(row.postScore, row.postMax),
    postResult: row.postResult || "—",
    trend: row.trend,
  }));

  const completePhases = phases.filter((p) => p.status === "Complete").length;

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "ARAL Section Assessment Report",
      schoolYear: schoolYear || "—",
      quarter: "Summer ARAL",
      generatedBy,
      totalRecords: detailRows.length,
    },
    metrics: [
      {
        label: "Learners",
        value: individuals.length,
        tone: "default",
      },
      {
        label: "Phases complete",
        value: `${completePhases}/3`,
        tone: completePhases === 3 ? "green" : "amber",
      },
      {
        label: "Facilitator",
        value: facilitatorName,
        tone: "default",
      },
      {
        label: "Weekly",
        value: weeklySummary?.maxWeek
          ? `Week ${weeklySummary.maxWeek} · ${weeklySummary.filled}/${weeklySummary.total}`
          : "None saved",
        tone: weeklySummary?.maxWeek ? "green" : "default",
      },
    ],
    table: {
      title: `Class summary — ${gradeSection}`,
      columns: [
        { key: "phase", header: "Phase", width: 14 },
        { key: "status", header: "Status", width: 14 },
        { key: "scored", header: "Scored", width: 12 },
        { key: "passed", header: "Passed", width: 10 },
        { key: "forAral", header: "For ARAL", width: 12 },
        { key: "avgPercent", header: "Avg %", width: 10 },
      ],
      rows: summaryRows,
    },
    narrative: `Individual Pre / Mid / Post results for ${gradeSection} from saved scores. Weekly progress: ${
      weeklySummary?.maxWeek
        ? `Week 1–${weeklySummary.maxWeek}, ${weeklySummary.filled} of ${weeklySummary.total} learners with entries`
        : "no weekly files saved yet"
    }. Trend compares earliest to latest available result.`,
  });

  // Second detailed sheet for individuals (official template is cover + one table).
  // Append a simple Detail sheet for the learner rows.
  const detail = workbook.addWorksheet("Individual Results");
  detail.columns = [
    { header: "Learner Name", key: "studentName", width: 24 },
    { header: "Student Number", key: "studentNumber", width: 16 },
    { header: "Pre", key: "pre", width: 10 },
    { header: "Pre Result", key: "preResult", width: 12 },
    { header: "Mid", key: "mid", width: 10 },
    { header: "Mid Result", key: "midResult", width: 12 },
    { header: "Post", key: "post", width: 10 },
    { header: "Post Result", key: "postResult", width: 12 },
    { header: "Trend", key: "trend", width: 16 },
  ];
  detail.getRow(1).font = { bold: true };
  for (const row of detailRows) detail.addRow(row);

  const filename = `ARAL-Report-${safeToken(gradeSection)}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { filename, count: detailRows.length };
}
