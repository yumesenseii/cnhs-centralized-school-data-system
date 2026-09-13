/**
 * Class / school intervention caseload Excel.
 * Wording: Recorded Progress, Latest Assessment, Baseline vs Latest, Teacher Evaluation.
 */

import {
  displayInterventionStatus,
  interventionTypeLabel,
  isInterventionCandidate,
  learnerDisplayName,
} from "@/lib/monitoring/interventionLifecycle";

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

function caseloadRows(learners = [], progressByStudent = {}) {
  return learners.filter(isInterventionCandidate).map((row) => {
    const progress = progressByStudent[row.studentId] || {};
    return {
      learner: learnerDisplayName(row),
      lrn: row.studentNumber || "—",
      section: row.gradeSection || "—",
      subject: row.subject || "—",
      risk: row.riskLevel || "—",
      type: interventionTypeLabel(row),
      facilitator: row.aralFacilitatorName || "—",
      status: displayInterventionStatus(row.monitoringStatus),
      latest: progress.label || "—",
      baseline:
        progress.baseline?.percent != null
          ? `${progress.baseline.percent}%`
          : "—",
      improvement:
        progress.improvement != null ? `${progress.improvement} points` : "—",
      evaluation: row.progressEvaluation || "—",
      nextAction: row.nextAction || "—",
    };
  });
}

export async function appendInterventionSheet(
  workbook,
  { learners = [], progressByStudent = {} } = {}
) {
  const { createDetailedReportSheet } = await import(
    "@/lib/reports/excelOfficialTemplate"
  );
  const rows = caseloadRows(learners, progressByStudent);
  createDetailedReportSheet(workbook, {
    title: "Learners under intervention",
    sheetName: "Learners under intervention",
    columns: [
      { key: "learner", header: "Learner", width: 24 },
      { key: "lrn", header: "LRN", width: 14 },
      { key: "section", header: "Section", width: 22 },
      { key: "subject", header: "Subject", width: 16 },
      { key: "risk", header: "Risk", width: 14 },
      { key: "type", header: "Type", width: 16 },
      { key: "facilitator", header: "Facilitator", width: 20 },
      { key: "status", header: "Status", width: 20 },
      { key: "baseline", header: "Baseline", width: 12 },
      { key: "latest", header: "Latest Assessment", width: 16 },
      { key: "improvement", header: "Baseline vs Latest", width: 16 },
      { key: "evaluation", header: "Teacher Evaluation", width: 22 },
      { key: "nextAction", header: "Next Action", width: 20 },
    ],
    rows,
    narrative:
      "Recorded Progress only. Latest Assessment and Baseline vs Latest are saved Pre/Mid/Post scores. Teacher Evaluation is separate. Do not read this as intervention improved academic performance by a measured percent. Attendance is not an Academic Prediction input.",
  });
  return rows.length;
}

export async function downloadInterventionCaseloadExcel({
  learners = [],
  progressByStudent = {},
  generatedBy = "Teacher",
  scopeLabel = "Caseload",
  gradeSection = "Intervention",
} = {}) {
  const { createWorkbook, createReportCover, downloadWorkbook } = await import(
    "@/lib/reports/excelOfficialTemplate"
  );

  const workbook = createWorkbook();
  const rows = caseloadRows(learners, progressByStudent);
  await createReportCover(workbook, {
    meta: {
      reportTitle: `Intervention caseload — ${scopeLabel}`,
      schoolYear: learners[0]?.schoolYear || "—",
      quarter: "Academic Monitoring",
      generatedBy,
      totalRecords: rows.length,
    },
    metrics: [
      { label: "Learners", value: rows.length, tone: "default" },
      {
        label: "ARAL",
        value: rows.filter((r) => r.type === "ARAL Learners").length,
        tone: "green",
      },
    ],
    coverNarrative:
      `Learners under intervention for ${scopeLabel}. Latest Assessment and Baseline vs Latest are Recorded Progress from saved Pre/Mid/Post only. Teacher Evaluation is separate. Not a claim that intervention improved academic performance by a measured percent.`,
  });

  await appendInterventionSheet(workbook, { learners, progressByStudent });

  const filename = `Intervention-Caseload-${safeToken(gradeSection)}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { filename, count: rows.length };
}
