/**
 * Thin Academic Records Excel export — live learner payload only.
 */

import {
  buildOfficialExcelReport,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";

function safeToken(value) {
  return (
    String(value ?? "")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 40) || "NA"
  );
}

export async function exportAcademicRecordsExcel({
  students = [],
  summaryCards = [],
  schoolYear = "",
  quarter = "",
  periodLabel = "",
} = {}) {
  const metrics = (summaryCards ?? []).slice(0, 8).map((card) => ({
    label: card.label,
    value: card.value,
    tone:
      card.tone === "red"
        ? "red"
        : card.tone === "orange"
          ? "amber"
          : card.tone === "green"
            ? "green"
            : "default",
  }));

  const riskSeries = [
    {
      title: "Risk Distribution (unique learners)",
      chartType: "donut",
      categoryHeader: "Risk Level",
      valueHeader: "Learners",
      rows: ["High Risk", "Moderate Risk", "Low Risk"].map((level) => ({
        category: level,
        value: students.filter((s) => s.riskLevel === level).length,
      })),
    },
  ];

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: "Academic Records — Learner Risk Register",
      schoolYear: schoolYear || "—",
      quarter: quarter || periodLabel || "—",
      generatedBy: "Head Teacher / Admin",
      totalRecords: students.length,
    },
    metrics,
    chartSeries: riskSeries,
    table: {
      sheetName: "Detailed Report",
      title: `Learner Records — ${periodLabel || schoolYear || "SY"}`,
      columns: [
        { key: "studentNumber", header: "Student Number", width: 16 },
        { key: "studentName", header: "Student Name", width: 22 },
        { key: "gradeSection", header: "Grade & Section", width: 16 },
        {
          key: "generalAverage",
          header: "General Average",
          width: 14,
          numeric: true,
          gradeRule: true,
        },
        { key: "weakSubject", header: "Weak Subject", width: 16 },
        {
          key: "riskLevel",
          header: "Risk Level",
          width: 14,
          statusRule: true,
        },
        {
          key: "systemRecommendation",
          header: "Recommendation",
          width: 28,
        },
        {
          key: "reviewStatus",
          header: "Review Status",
          width: 16,
          statusRule: true,
        },
      ],
      rows: students.map((row) => ({
        ...row,
        weakSubject: row.weakSubject ?? "—",
        generalAverage: row.generalAverageValue ?? row.generalAverage,
      })),
    },
    narrativeContext: {
      totalClasses: summaryCards.find((c) => c.id === "uploaded")?.value ?? 0,
      totalStudents: students.length,
      averageGrade: null,
      atRisk: students.filter(
        (s) =>
          s.riskLevel === "High Risk" || s.riskLevel === "Moderate Risk"
      ).length,
      aralLearners: students.filter((s) =>
        String(s.systemRecommendation).includes("ARAL")
      ).length,
      classroomRemedial: students.filter((s) =>
        String(s.systemRecommendation).toLowerCase().includes("remed")
      ).length,
    },
  });

  const quarterDigit = String(quarter).replace(/\D/g, "") || "All";
  await downloadWorkbook(
    workbook,
    `Academic_Records_${safeToken(schoolYear || "SY")}_Q${quarterDigit}.xlsx`
  );
}
