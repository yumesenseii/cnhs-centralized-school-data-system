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
 * Download a scores overview for one section + phase (offline copy).
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
    "Overview of saved scores. To replace scores, re-upload a Scores sheet from the ARAL Program file list.",
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

function paintAralTable(sheet, startRow, columns, rows) {
  columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = Math.max(
      sheet.getColumn(index + 1).width || 0,
      col.width || 14
    );
  });

  const header = sheet.getRow(startRow);
  columns.forEach((col, index) => {
    const cell = header.getCell(index + 1);
    cell.value = col.header;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF246F54" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  header.height = 20;

  rows.forEach((dataRow, rowIndex) => {
    const excelRow = sheet.getRow(startRow + 1 + rowIndex);
    columns.forEach((col, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = dataRow[col.key] ?? "—";
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (rowIndex % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
    });
  });

  return startRow + 1 + Math.max(rows.length, 1);
}

/**
 * Download Cover + Detailed ARAL report (two worksheets).
 * Detailed has Assessment then Weekly — not one merged save grid.
 */
export async function downloadAralSectionReportExcel({
  report,
  gradeSection = "Section",
  schoolYear = "",
  generatedBy = "Facilitator",
  facilitatorName = "—",
  subject = "",
  programName = "",
  weeklySummary = null,
  trends = [],
  weeklyRows = [],
} = {}) {
  const { createWorkbook, createReportCover, downloadWorkbook } = await import(
    "@/lib/reports/excelOfficialTemplate"
  );
  const {
    buildAralPhaseChartRows,
    buildAralPhaseExcelChartRows,
    buildAralBandChartRows,
    formatAralProgramLabel,
    formatAralTrendLine,
  } = await import("@/lib/monitoring/aralSectionReport");
  const { ARAL_WEEK_OPTIONS } = await import("@/lib/monitoring/aralProgress");

  const phases = report?.phases ?? [];
  const individuals = report?.individuals ?? [];
  const completePhases = phases.filter((p) => p.status === "Complete").length;
  const improved = trends.find((row) => row.label === "Improved")?.count ?? 0;
  const still = trends.find((row) => row.label === "Still For ARAL")?.count ?? 0;
  const notStarted = trends.find((row) => row.label === "Not started")?.count ?? 0;
  const incomplete = trends.find((row) => row.label === "Incomplete")?.count ?? 0;

  const programLabel = formatAralProgramLabel({ batchName: programName });
  const phaseChartRows = buildAralPhaseExcelChartRows(phases);
  const phaseGroupedRows = buildAralPhaseChartRows(phases);
  const bandChartRows = buildAralBandChartRows(weeklySummary?.bands).map(
    (row) => ({ category: row.name, value: row.value })
  );

  const workbook = createWorkbook();
  await createReportCover(workbook, {
    meta: {
      reportTitle: `ARAL Summary Cover — ${gradeSection}${subject ? ` · ${subject}` : ""}`,
      schoolYear: schoolYear || "—",
      quarter: programLabel,
      generatedBy,
      totalRecords: individuals.length,
    },
    metrics: [
      {
        label: "Assigned learners",
        value: individuals.length,
        tone: "default",
      },
      {
        label: "Phases complete",
        value: `${completePhases}/3`,
        tone: completePhases === 3 ? "green" : "amber",
      },
      {
        label: "Weekly entries",
        value: weeklySummary?.hasWeekly
          ? `Week ${weeklySummary.maxWeek} · ${weeklySummary.filled}/${weeklySummary.total}`
          : "None saved",
        tone: weeklySummary?.hasWeekly ? "green" : "default",
      },
      {
        label: "Not started / Incomplete",
        value: `${notStarted} / ${incomplete}`,
        tone: incomplete > 0 || notStarted > 0 ? "amber" : "green",
      },
      {
        label: "Improved / Still For ARAL",
        value: `${improved} / ${still}`,
        tone: still > 0 ? "amber" : "green",
      },
      {
        label: "Facilitator",
        value: facilitatorName,
        tone: "default",
      },
    ],
    chartSeries: [
      {
        title: "Pre / Mid / Post Passed vs For ARAL",
        chartType: "groupedbar",
        rows: phaseChartRows,
        chartRows: phaseGroupedRows,
      },
      {
        title: "Weekly progress bands",
        chartType: "bar",
        rows: bandChartRows,
      },
    ],
    coverNarrative:
      `Saved Pre / Mid / Post and weekly rows for ${gradeSection}. ` +
      `Trend (saved Pre → Mid → Post only; Incomplete ≠ failed): ${formatAralTrendLine(trends) || "none yet"}. ` +
      `Missing Mid/Post = not started, not zero. ` +
      `Weekly bands (latest week per learner): ${
        weeklySummary?.bands?.some((band) => band.count > 0)
          ? weeklySummary.bands.map((band) => `${band.label} ${band.count}`).join(" · ")
          : "none saved"
      }. ` +
      "Not official DepEd ARAL form. ARAL session is not SF2 and is never an Academic Prediction / RF input.",
  });

  const assessmentRows = individuals.map((row) => ({
    studentName: row.studentName,
    studentNumber: row.studentNumber || "—",
    pre: formatScoreCell(row.preScore, row.preMax),
    preResult: row.preResult || "—",
    mid: formatScoreCell(row.midScore, row.midMax),
    midResult: row.midResult || "—",
    post: formatScoreCell(row.postScore, row.postMax),
    postResult: row.postResult || "—",
    trend: row.trend || "—",
  }));

  const weeklyTableRows = (weeklyRows ?? []).map((row) => {
    const next = {
      studentName: row.studentName,
      studentNumber: row.studentNumber || "—",
    };
    for (const week of ARAL_WEEK_OPTIONS) {
      next[`w${week}`] = row.weeks?.[week]?.label || "—";
    }
    next.remarks = row.remarks || "—";
    return next;
  });

  const detail = workbook.addWorksheet("Detailed Report", {
    views: [{ showGridLines: false }],
  });

  detail.mergeCells(1, 1, 1, 9);
  const titleCell = detail.getCell(1, 1);
  titleCell.value = `Detailed Report — ${gradeSection}`;
  titleCell.font = {
    name: "Calibri",
    size: 14,
    bold: true,
    color: { argb: "FF246F54" },
  };

  detail.mergeCells(2, 1, 2, 9);
  const hintCell = detail.getCell(2, 1);
  hintCell.value =
    weeklySummary?.hasWeekly
      ? "A. Assessment then B. Weekly. Same assigned roster. Blank week = not saved (not Absent)."
      : "A. Assessment then B. Weekly. No weekly sessions saved yet. Blank is not Absent. ARAL session is not SF2.";
  hintCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };

  detail.mergeCells(4, 1, 4, 9);
  detail.getCell(4, 1).value = "A. Assessment";
  detail.getCell(4, 1).font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: "FF246F54" },
  };

  let nextRow = paintAralTable(
    detail,
    5,
    [
      { key: "studentName", header: "Learner", width: 24 },
      { key: "studentNumber", header: "LRN", width: 14 },
      { key: "pre", header: "Pre", width: 10 },
      { key: "preResult", header: "Pre result", width: 12 },
      { key: "mid", header: "Mid", width: 10 },
      { key: "midResult", header: "Mid result", width: 12 },
      { key: "post", header: "Post", width: 10 },
      { key: "postResult", header: "Post result", width: 12 },
      { key: "trend", header: "Trend", width: 16 },
    ],
    assessmentRows
  );

  nextRow += 2;
  detail.mergeCells(nextRow, 1, nextRow, 9);
  detail.getCell(nextRow, 1).value = "B. Weekly";
  detail.getCell(nextRow, 1).font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: "FF246F54" },
  };
  nextRow += 1;

  paintAralTable(
    detail,
    nextRow,
    [
      { key: "studentName", header: "Learner", width: 24 },
      { key: "studentNumber", header: "LRN", width: 14 },
      { key: "w1", header: "Week 1", width: 18 },
      { key: "w2", header: "Week 2", width: 18 },
      { key: "w3", header: "Week 3", width: 18 },
      { key: "w4", header: "Week 4", width: 18 },
      { key: "w5", header: "Week 5", width: 18 },
      { key: "w6", header: "Week 6", width: 18 },
      { key: "remarks", header: "Remarks", width: 28 },
    ],
    weeklyTableRows
  );

  const filename = `ARAL-Report-${safeToken(gradeSection)}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { filename, count: individuals.length };
}
