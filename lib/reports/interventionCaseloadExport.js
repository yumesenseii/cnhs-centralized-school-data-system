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
    const pathway =
      row.interventionPathway ||
      (String(row.recommendation || "").toLowerCase().includes("aral")
        ? "ARAL Program (RA 12028)"
        : "Classroom Remediation");

    return {
      learner: learnerDisplayName(row),
      lrn: row.studentNumber || "—",
      section: row.gradeSection || "—",
      subject: row.subject || "—",
      pathway,
      tierOrLevel:
        row.aralPlacementTier ||
        row.readingLevel ||
        row.readingLevelOrPlacement ||
        "—",
      risk: row.riskLevel || "—",
      type: interventionTypeLabel(row),
      facilitator: row.aralFacilitatorName || "—",
      status: displayInterventionStatus(row.monitoringStatus),
      latest: progress.label || "—",
      baseline:
        progress.baseline?.percent != null
          ? `${progress.baseline.percent}%`
          : row.beginningAssessmentScore != null
            ? `${row.beginningAssessmentScore}%`
            : "—",
      endScore:
        row.endAssessmentScore != null
          ? `${row.endAssessmentScore}%`
          : progress.latest?.percent != null
            ? `${progress.latest.percent}%`
            : "—",
      improvement:
        progress.improvement != null ? `${progress.improvement} points` : "—",
      movement: row.movementOutcome || "In Progress",
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
      { key: "section", header: "Section", width: 20 },
      { key: "subject", header: "Subject", width: 16 },
      { key: "pathway", header: "Intervention Pathway", width: 22 },
      { key: "tierOrLevel", header: "Placement Tier / Level", width: 20 },
      { key: "risk", header: "Risk", width: 14 },
      { key: "type", header: "Type", width: 16 },
      { key: "facilitator", header: "Facilitator", width: 20 },
      { key: "status", header: "Status", width: 20 },
      { key: "baseline", header: "Baseline", width: 12 },
      { key: "latest", header: "Latest Assessment", width: 16 },
      { key: "endScore", header: "End Score", width: 12 },
      { key: "improvement", header: "Score Difference", width: 16 },
      { key: "movement", header: "Movement Outcome", width: 18 },
      { key: "evaluation", header: "Teacher Evaluation", width: 22 },
      { key: "nextAction", header: "Next Action", width: 20 },
    ],
    rows,
    narrative:
      "Recorded Progress only. Official placement and qualification are determined by diagnostic assessments (e.g. Phil-IRI, RMA) and school head endorsement. Latest Assessment and Baseline vs Latest are saved Pre/Mid/Post scores. Teacher Evaluation is separate. Attendance is not an Academic Prediction input.",
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
        label: "ARAL Program",
        value: rows.filter((r) => r.pathway.includes("ARAL")).length,
        tone: "purple",
      },
      {
        label: "Classroom Remedial",
        value: rows.filter((r) => r.pathway.includes("Remediation")).length,
        tone: "blue",
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
