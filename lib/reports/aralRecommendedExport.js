/**
 * Export Recommended ARAL Learners — official CNHS Excel template.
 *
 * For offline educator review only (no HT Approve PLP workflow).
 * Rows are ARAL-eligible classes (English / Filipino) with ARAL recommendation.
 */

import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import {
  RECOMMENDATION,
  normalizeRecommendationType,
} from "@/lib/monitoring/recommendations";

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

function isAralEligibleRow(learner = {}) {
  return Boolean(
    learner.aralEligible ?? learner.subjectAralEligible ?? false
  );
}

/**
 * Keep only English/Filipino class rows recommended for ARAL Learners.
 * @param {object[]} learners
 */
export function filterAralRecommendedLearners(learners = []) {
  return (learners ?? []).filter((learner) => {
    if (!isAralEligibleRow(learner)) return false;
    return (
      normalizeRecommendationType(learner.recommendation) ===
      RECOMMENDATION.ARAL
    );
  });
}

function countByGradeSection(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const key = row.gradeSection || `${row.grade ?? ""} ${row.section ?? ""}`.trim() || "—";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * @param {object} options
 * @param {object[]} options.learners — monitoring roster rows (already filtered by UI if desired)
 * @param {string} [options.schoolYear]
 * @param {string} [options.quarter]
 * @param {string} [options.periodLabel]
 * @param {string} [options.generatedBy]
 * @param {string} [options.scopeLabel] — e.g. class name or "School-wide"
 * @param {boolean} [options.includeTeacherColumn] — admin exports
 */
export async function exportAralRecommendedExcel({
  learners = [],
  schoolYear = "",
  quarter = "",
  periodLabel = "",
  generatedBy = "CNHS Staff",
  scopeLabel = "School-wide",
  includeTeacherColumn = false,
} = {}) {
  const rows = filterAralRecommendedLearners(learners);
  const period = periodLabel || quarter || "—";
  const bySection = countByGradeSection(rows);

  const columns = [
    { key: "studentName", header: "Learner Name", width: 22 },
    { key: "studentNumber", header: "Student Number / LRN", width: 18 },
    { key: "gradeSection", header: "Grade & Section", width: 16 },
    ...(includeTeacherColumn
      ? [{ key: "teacherName", header: "Teacher", width: 18 }]
      : []),
    { key: "subject", header: "Subject (English/Filipino)", width: 18 },
    { key: "reasons", header: "Subject Gaps / Reasons", width: 36 },
    {
      key: "riskLevel",
      header: "Risk Level",
      width: 14,
      statusRule: true,
    },
    { key: "recommendation", header: "System Recommendation", width: 20 },
    { key: "approvalStatus", header: "HT Approval Status", width: 18 },
    { key: "period", header: "Term / Period", width: 14 },
  ];

  const tableRows = rows.map((row) => ({
    studentName: row.name ?? row.studentName ?? "—",
    studentNumber: row.studentNumber ?? row.lrn ?? "—",
    gradeSection:
      row.gradeSection ||
      `${row.grade ?? ""} ${row.section ?? ""}`.trim() ||
      "—",
    teacherName: row.teacherName ?? row.teacher ?? row.adviserName ?? "—",
    subject: row.subject ?? "—",
    reasons:
      row.recommendationReason ||
      (Array.isArray(row.recommendationReasons)
        ? row.recommendationReasons.join("; ")
        : "") ||
      (Array.isArray(row.weakSubjects) ? row.weakSubjects.join(", ") : "") ||
      row.weakSubject ||
      "—",
    riskLevel: row.riskLevel ?? "—",
    recommendation: normalizeRecommendationType(row.recommendation),
    approvalStatus: row.aralApprovalStatus || "Suggested",
    period: row.quarter || period,
  }));

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "ARAL Recommended Learners — for review",
      schoolYear: schoolYear || "—",
      quarter: period,
      generatedBy,
      totalRecords: tableRows.length,
    },
    metrics: [
      {
        label: "Recommended for ARAL",
        value: tableRows.length,
        tone: tableRows.length > 0 ? "amber" : "green",
      },
      {
        label: "Scope",
        value: scopeLabel,
        tone: "default",
      },
      {
        label: "Review note",
        value: "System suggestion",
        tone: "default",
      },
    ],
    chartSeries: bySection.length
      ? [
          {
            title: "ARAL Recommended by Grade & Section",
            chartType: "bar",
            categoryHeader: "Grade & Section",
            valueHeader: "Learners",
            rows: bySection.slice(0, 12),
          },
        ]
      : [],
    table: {
      sheetName: "Detailed Report",
      title: `ARAL Recommended — ${scopeLabel} · ${schoolYear || "SY"} · ${period}`,
      columns,
      rows: tableRows,
    },
    coverNarrative:
      tableRows.length > 0
        ? `This list contains ${tableRows.length} learner(s) recommended for ARAL Learners based on ECR grades (English/Filipino). It is a system recommendation for educator review before implementing interventions. Attendance is not used in this prediction.`
        : `No learners are currently recommended for ARAL Learners under the selected filters. This export is for educator review only.`,
    narrativeContext: {
      totalClasses: bySection.length,
      totalStudents: tableRows.length,
      atRisk: tableRows.filter(
        (r) =>
          r.riskLevel === "High Risk" || r.riskLevel === "Moderate Risk"
      ).length,
      aralLearners: tableRows.length,
      classroomRemedial: 0,
      averageGrade: null,
    },
  });

  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `CNHS-ARAL-Recommended-${safeToken(scopeLabel)}-${safeToken(schoolYear || "SY")}-${dateStamp}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return { count: tableRows.length, filename };
}
