/**
 * HT school / meeting / class PDF downloads — real .pdf via jsPDF.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SCHOOL_NAME } from "@/lib/constants/brand";
import {
  reportsClassFilename,
  reportsSchoolFilename,
} from "@/lib/reports/exportFilenames";
import {
  normalizeAdminClassRow,
  normalizeExportSections,
  resolveAdminReportTermLabel,
} from "@/lib/admin/reportsExportShared";

const GREEN = [47, 125, 95];
const MARGIN_X = 48;
const PAGE_RIGHT = 564;

function resolveTermLabel(quarter) {
  return resolveAdminReportTermLabel(quarter);
}

function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("PDF download is only available in the browser.");
  }
}

function drawHeader(doc, { subtitle = "School Reports" } = {}) {
  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text("CNHS Learn", MARGIN_X, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(String(SCHOOL_NAME || "Cambaog National High School"), MARGIN_X, y);
  y += 6;
  doc.setFontSize(8);
  doc.text(subtitle, MARGIN_X, y + 10);
  y += 18;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.2);
  doc.line(MARGIN_X, y, PAGE_RIGHT, y);
  return y + 20;
}

function drawTitle(doc, y, title, subtitle) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN_X, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(subtitle, MARGIN_X, y);
  return y + 18;
}

function drawSectionLabel(doc, y, label) {
  if (y > 700) {
    doc.addPage();
    y = 48;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text(String(label).toUpperCase(), MARGIN_X, y);
  return y + 12;
}

function drawKeyValues(doc, y, pairs) {
  for (const [label, value] of pairs) {
    if (y > 720) {
      doc.addPage();
      y = 48;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`${label}:`, MARGIN_X, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(String(value ?? "—"), MARGIN_X + 150, y);
    y += 13;
  }
  return y + 4;
}

function drawBulletList(doc, y, lines) {
  if (!lines.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("None under the current filters.", MARGIN_X, y);
    return y + 14;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  for (const line of lines) {
    if (y > 720) {
      doc.addPage();
      y = 48;
    }
    const wrapped = doc.splitTextToSize(`•  ${line}`, PAGE_RIGHT - MARGIN_X);
    doc.text(wrapped, MARGIN_X, y);
    y += wrapped.length * 12 + 2;
  }
  return y + 6;
}

function attentionLines(actionCounts = {}) {
  const lines = [];
  const files = Number(actionCounts.pendingFiles) || 0;
  const approvals = Number(actionCounts.pendingAralApprovals) || 0;
  const unassigned = Number(actionCounts.unassignedFacilitators) || 0;
  if (files > 0) {
    lines.push(
      `${files} class report${files === 1 ? "" : "s"} for review`
    );
  }
  if (approvals > 0) {
    lines.push(
      `${approvals} ARAL recommendation${approvals === 1 ? "" : "s"} to approve`
    );
  }
  if (unassigned > 0) {
    lines.push(
      `${unassigned} learner${unassigned === 1 ? "" : "s"} need${
        unassigned === 1 ? "s" : ""
      } an ARAL facilitator`
    );
  }
  return lines;
}

function supportSectionLines(sections = [], limit = 8) {
  return (sections ?? []).slice(0, limit).map((row) => {
    const bits = [];
    if (row.aral > 0) {
      bits.push(`${row.aral} ARAL learner${row.aral === 1 ? "" : "s"}`);
    }
    if (row.atRisk > 0) {
      bits.push(
        `${row.atRisk} learner${row.atRisk === 1 ? "" : "s"} needing support`
      );
    }
    return `${row.label} — ${bits.join(" · ") || "—"}`;
  });
}

function drawFooterNote(doc, y) {
  if (y > 720) {
    doc.addPage();
    y = 48;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Grades from class records. Attendance from Morning and Afternoon marks.",
    MARGIN_X,
    y
  );
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Reviewed / certified by Head Teacher:", MARGIN_X, y);
  doc.setDrawColor(...GREEN);
  doc.line(MARGIN_X, y + 28, MARGIN_X + 200, y + 28);
}

function savePdf(doc, filename) {
  const name = String(filename || "CNHS-Report.pdf");
  doc.save(name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`);
}

/**
 * School-wide PDF with optional sections (chooser).
 */
export function downloadAdminReportsPdf({
  schoolYear = "",
  quarter = "",
  summary = {},
  schoolSummary = {},
  classReports = [],
  dailyAttendance = null,
  supportSections = [],
  actionCounts = null,
  sections: sectionsInput = null,
  generatedAt = new Date(),
  printTitle = null,
} = {}) {
  ensureBrowser();
  const sections = normalizeExportSections(sectionsInput ?? {});
  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const qLabel = resolveTermLabel(quarter);
  const rows = classReports.map(normalizeAdminClassRow).filter(Boolean);

  const learners = summary?.totalStudents ?? schoolSummary?.totalLearners ?? 0;
  const atRisk = schoolSummary?.atRisk ?? "—";
  const aralLearners =
    summary?.aralScreeningCount ?? schoolSummary?.aralScreening ?? 0;
  const averageGrade =
    summary?.averageClassGrade ?? schoolSummary?.overallAverage ?? "—";
  const classroomRemedial =
    summary?.classroomRemedialCount ??
    schoolSummary?.classroomRemedial ??
    schoolSummary?.classroomRemediation ??
    0;
  const passing =
    summary?.passingRate == null ? "—" : `${summary.passingRate}%`;
  const lowest = summary?.lowestSubject ?? "—";
  const lpApproved = schoolSummary?.lessonPlansApproved ?? "—";
  const lpPending = schoolSummary?.lpPending ?? "—";

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = drawHeader(doc, { subtitle: "School Reports" });
  y = drawTitle(
    doc,
    y,
    "SCHOOL PERFORMANCE REPORT",
    `${schoolYear || "—"} · ${qLabel}`
  );

  y = drawKeyValues(doc, y, [
    ["School year", schoolYear || "—"],
    ["Term", qLabel],
    ["Date generated", dateGenerated],
  ]);

  if (sections.schoolSummary) {
    y = drawSectionLabel(doc, y, "School summary");
    y = drawKeyValues(doc, y, [
      ["Learners", learners],
      ["At-risk learners", atRisk],
      ["ARAL Learners", aralLearners],
      ["Classroom remedial", classroomRemedial],
      ["Passing rate", passing],
      ["Lowest performing subject", lowest],
      ["Lesson plans approved", lpApproved],
      ["Lesson plans pending review", lpPending],
      ["Class average", averageGrade],
    ]);
    const attention = attentionLines(actionCounts);
    if (attention.length) {
      y = drawSectionLabel(doc, y, "Needs your attention");
      y = drawBulletList(doc, y, attention);
    }
  }

  if (sections.learnersNeedingSupport) {
    y = drawSectionLabel(doc, y, "Learners needing support");
    y = drawKeyValues(doc, y, [
      ["ARAL Learners", aralLearners],
      ["Classroom remedial", classroomRemedial],
      ["At-risk learners", atRisk],
    ]);
    y = drawBulletList(doc, y, supportSectionLines(supportSections, 8));
  }

  if (sections.classesTable) {
    y = drawSectionLabel(doc, y, "Classes");
    const tableRows = rows.map((row) => [
      row.gradeSection || "—",
      row.subject || "—",
      row.termDisplay || "—",
      row.teacherName || "—",
      String(row.students ?? "—"),
      String(row.averageGrade ?? "—"),
      String(row.requiringIntervention ?? 0),
      String(row.aralScreeningDisplay ?? "—"),
      String(row.classroomRemedial ?? "—"),
    ]);
    autoTable(doc, {
      startY: y,
      head: [
        [
          "Class",
          "Subject",
          "Term",
          "Teacher",
          "Learners",
          "Avg",
          "Support",
          "ARAL",
          "Remedial",
        ],
      ],
      body: tableRows.length
        ? tableRows
        : [["No class reports for the selected filters.", "", "", "", "", "", "", "", ""]],
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
        textColor: [40, 40, 40],
      },
      headStyles: {
        fillColor: GREEN,
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 248, 246] },
      margin: { left: MARGIN_X, right: MARGIN_X },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 16;
  }

  if (sections.attendanceThisMonth) {
    y = drawSectionLabel(doc, y, "Attendance this month");
    if (dailyAttendance) {
      y = drawKeyValues(doc, y, [
        ["Month", dailyAttendance.monthName],
        ["School attendance rate", dailyAttendance.sessionRateLabel],
        [
          "Sections with attendance",
          `${dailyAttendance.sectionsWithMarks} / ${dailyAttendance.sectionsTotal}`,
        ],
        ["Sections without attendance", dailyAttendance.sectionsWaiting],
      ]);
    } else {
      y = drawBulletList(doc, y, [
        "No Morning and Afternoon attendance recorded for this month yet.",
      ]);
    }
  }

  drawFooterNote(doc, y + 8);

  const filename =
    printTitle ||
    reportsSchoolFilename({
      schoolYear,
      termLabel: qLabel,
      ext: "pdf",
    });
  savePdf(doc, filename);
}

/**
 * Short meeting brief PDF.
 */
export function downloadAdminMeetingBriefPdf({
  schoolYear = "",
  quarter = "",
  summary = {},
  schoolSummary = {},
  lessonSummary = null,
  actionCounts = {},
  supportSections = [],
  dailyAttendance = null,
  generatedAt = new Date(),
} = {}) {
  ensureBrowser();
  const dateGenerated = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const qLabel = resolveTermLabel(quarter);

  const learners = summary?.totalStudents ?? schoolSummary?.totalLearners ?? 0;
  const atRisk = schoolSummary?.atRisk ?? 0;
  const aralLearners =
    summary?.aralScreeningCount ?? schoolSummary?.aralScreening ?? 0;
  const classroomRemedial =
    summary?.classroomRemedialCount ??
    schoolSummary?.classroomRemedial ??
    schoolSummary?.classroomRemediation ??
    0;
  const passing =
    summary?.passingRate == null ? "—" : `${summary.passingRate}%`;
  const lowest = summary?.lowestSubject ?? "—";
  const lpPending = lessonSummary?.pending ?? schoolSummary?.lpPending ?? 0;

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = drawHeader(doc, { subtitle: "Meeting brief" });
  y = drawTitle(doc, y, "SCHOOL MEETING BRIEF", `${schoolYear || "—"} · ${qLabel}`);
  y = drawKeyValues(doc, y, [
    ["School year", schoolYear || "—"],
    ["Term", qLabel],
    ["Date generated", dateGenerated],
  ]);

  y = drawSectionLabel(doc, y, "Key figures");
  y = drawKeyValues(doc, y, [
    ["Learners", learners],
    ["At-risk learners", atRisk],
    ["ARAL Learners", aralLearners],
    ["Classroom remedial", classroomRemedial],
  ]);

  const attention = attentionLines(actionCounts);
  if (attention.length) {
    y = drawSectionLabel(doc, y, "Needs your attention");
    y = drawBulletList(doc, y, attention);
  }

  y = drawSectionLabel(doc, y, "Sections needing attention");
  y = drawBulletList(doc, y, supportSectionLines(supportSections, 5));

  y = drawSectionLabel(doc, y, "Quick rates");
  y = drawKeyValues(doc, y, [
    ["Passing rate", passing],
    ["Lowest performing subject", lowest],
    ["Lesson plans pending review", lpPending],
  ]);

  if (dailyAttendance) {
    y = drawSectionLabel(doc, y, `Attendance — ${dailyAttendance.monthName}`);
    y = drawBulletList(doc, y, [
      `${dailyAttendance.sessionRateLabel} school attendance · ${dailyAttendance.sectionsWithMarks} of ${dailyAttendance.sectionsTotal} sections with attendance · ${dailyAttendance.sectionsWaiting} without attendance`,
    ]);
  }

  drawFooterNote(doc, y + 8);

  const filename = reportsSchoolFilename({
    schoolYear,
    termLabel: `Meeting-Brief-${qLabel}`,
    ext: "pdf",
  });
  savePdf(doc, filename);
}

/**
 * Single-class PDF download.
 */
export function downloadAdminClassReportPdf({
  classReport,
  schoolYear = "",
  quarter = "",
} = {}) {
  const row = normalizeAdminClassRow(classReport);
  if (!row) {
    throw new Error("Class report is required.");
  }
  downloadAdminReportsPdf({
    schoolYear: row.schoolYear || schoolYear,
    quarter: row.quarter || quarter,
    summary: {
      totalClasses: 1,
      totalStudents: row.students,
      aralScreeningCount: row.aralEligible ? row.aralScreening : 0,
      classroomRemedialCount: row.classroomRemedialRecommended ? 1 : 0,
      averageClassGrade: row.averageGradeValue ?? row.averageGrade,
    },
    schoolSummary: {
      atRisk: row.highRisk,
      aralScreening: row.aralEligible ? row.aralScreening : 0,
      classroomRemediation: row.classroomRemedialRecommended ? 1 : 0,
      overallAverage: row.averageGradeValue ?? row.averageGrade,
      totalLearners: row.students,
    },
    classReports: [classReport],
    sections: {
      schoolSummary: true,
      classesTable: true,
      learnersNeedingSupport: false,
      attendanceThisMonth: false,
    },
    printTitle: reportsClassFilename({
      gradeSection: row.gradeSection,
      subject: row.subject,
      termLabel: resolveTermLabel(row.quarter || quarter),
      schoolYear: row.schoolYear || schoolYear,
      ext: "pdf",
    }),
  });
}
