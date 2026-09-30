/**
 * Academic Records Excel — visible class list from ECR (not risk/ARAL).
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
  classes = [],
  summaryCards = [],
  schoolYear = "",
  quarter = "",
  periodLabel = "",
  classTitle = "",
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

  const rows =
    students.length > 0
      ? students
      : (classes ?? []).flatMap((cls) =>
          (cls.students ?? []).map((row) => ({
            ...row,
            classLabel: `${cls.subject} · ${cls.gradeSection} · ${cls.termLabel}`,
          }))
        );

  const workbook = await buildOfficialExcelReport({
    meta: {
      reportTitle: classTitle
        ? `Academic Records — ${classTitle}`
        : "Academic Records — Class lists",
      schoolYear: schoolYear || "—",
      quarter: quarter || periodLabel || "—",
      generatedBy: "Principal / Admin",
      totalRecords: rows.length,
    },
    metrics,
    chartSeries: [],
    table: {
      sheetName: "Class List",
      title: classTitle || `Class lists — ${periodLabel || schoolYear || "SY"}`,
      columns: [
        { key: "studentNumber", header: "Student Number", width: 16 },
        { key: "studentName", header: "Learner Name", width: 24 },
        { key: "gender", header: "Gender", width: 10 },
        { key: "term1", header: "Term 1", width: 10, numeric: true, gradeRule: true },
        { key: "term2", header: "Term 2", width: 10, numeric: true, gradeRule: true },
        { key: "term3", header: "Term 3", width: 10, numeric: true, gradeRule: true },
        { key: "final", header: "Final", width: 10, numeric: true, gradeRule: true },
        {
          key: "termGrade",
          header: "Class term grade",
          width: 14,
          numeric: true,
          gradeRule: true,
        },
      ],
      rows,
    },
    narrativeContext: {
      totalClasses: summaryCards.find((c) => c.id === "uploaded")?.value ?? 0,
      totalStudents: rows.length,
      averageGrade: null,
      atRisk: 0,
      aralLearners: 0,
      classroomRemedial: 0,
    },
  });

  const quarterDigit = String(quarter).replace(/\D/g, "") || "All";
  await downloadWorkbook(
    workbook,
    `Academic_Records_${safeToken(schoolYear || "SY")}_Q${quarterDigit}.xlsx`
  );
}
