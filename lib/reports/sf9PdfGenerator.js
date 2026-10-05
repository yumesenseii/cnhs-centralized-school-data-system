/**
 * Official DepEd School Form 9 (SF9 / Form 138) PDF Generator
 * Built with jsPDF and jspdf-autotable.
 * Matches Cambaog National High School SY 2026-2027 MATATAG template.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SF9_SCHOOL_INFO,
  SF9_MONTHS,
  OFFICIAL_SUBJECT_KEYS,
  getMatatagDescriptor,
  computeTermAverage,
  formatDepEdLearnerName,
  calculateAge,
} from "./sf9DataService.js";

const BRAND_DARK = [30, 41, 59]; // slate-800
const BRAND_GREEN = [36, 111, 84]; // CNHS forest green
const BRAND_GRAY = [100, 116, 139]; // slate-500
const BORDER_COLOR = [148, 163, 184]; // slate-400

/**
 * Render Page 1 (Front Side - Academic Progress & Achievement)
 */
function renderFrontPage(doc, studentData, schoolYear) {
  const marginX = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;
  let y = 28;

  // 1. DepEd Official Letterhead
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text("Republic of the Philippines", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Department of Education", pageWidth / 2, y, { align: "center" });
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(SF9_SCHOOL_INFO.region, pageWidth / 2, y, { align: "center" });
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(SF9_SCHOOL_INFO.division, pageWidth / 2, y, { align: "center" });
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(SF9_SCHOOL_INFO.district, pageWidth / 2, y, { align: "center" });
  y += 9;
  doc.text(SF9_SCHOOL_INFO.municipality, pageWidth / 2, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(SF9_SCHOOL_INFO.schoolName, pageWidth / 2, y, { align: "center" });
  y += 13;
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);
  doc.text(`School Year ${schoolYear || SF9_SCHOOL_INFO.schoolYear}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 16;

  // 2. Student Information Block
  const learnerName = formatDepEdLearnerName(studentData);
  const lrn = studentData.lrn || studentData.studentNumber || "—";
  const age = calculateAge(studentData.birthdate);
  const sex = (studentData.gender || studentData.sex || "—").toUpperCase().charAt(0) || "—";
  const gradeLevel = studentData.gradeLevel || studentData.grade_level || "10";
  const sectionName = (studentData.sectionName || studentData.section_name || studentData.section || "—").toUpperCase();
  const track = studentData.track || "";

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Name:", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(learnerName, marginX + 32, y);

  doc.setFont("helvetica", "bold");
  doc.text("Age:", marginX + 330, y);
  doc.setFont("helvetica", "normal");
  doc.text(age, marginX + 355, y);

  doc.setFont("helvetica", "bold");
  doc.text("Sex:", marginX + 440, y);
  doc.setFont("helvetica", "normal");
  doc.text(sex, marginX + 465, y);
  y += 13;

  doc.setFont("helvetica", "bold");
  doc.text("LRN:", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(lrn, marginX + 32, y);

  doc.setFont("helvetica", "bold");
  doc.text("Grade:", marginX + 330, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(gradeLevel), marginX + 365, y);

  doc.setFont("helvetica", "bold");
  doc.text("Section:", marginX + 410, y);
  doc.setFont("helvetica", "normal");
  doc.text(sectionName, marginX + 450, y);
  y += 13;

  doc.setFont("helvetica", "bold");
  doc.text("Track (SHS only):", marginX, y);
  doc.setFont("helvetica", "normal");
  doc.text(track ? track : "__________________________________________________", marginX + 85, y);
  y += 16;

  // 3. Dear Parents Note
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Dear Parents,", marginX, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "This Performance Report presents your child's progress and achievement in the different learning areas.",
    marginX + 20,
    y
  );
  y += 9;
  doc.text(
    "The school welcomes you to reach out should you wish to know more about your child's learning and performance.",
    marginX + 20,
    y
  );
  y += 24;

  // 4. Signatures (School Head & Adviser)
  const schoolHead = (studentData.schoolHead || SF9_SCHOOL_INFO.defaultSchoolHead).toUpperCase();
  const adviser = (studentData.adviserName || studentData.adviser || "ALLAN A. MARCELO").toUpperCase();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(schoolHead, marginX + 80, y, { align: "center" });
  doc.text(adviser, pageWidth - marginX - 80, y, { align: "center" });

  doc.setDrawColor(...BRAND_DARK);
  doc.setLineWidth(0.75);
  doc.line(marginX + 20, y + 2, marginX + 140, y + 2);
  doc.line(pageWidth - marginX - 140, y + 2, pageWidth - marginX - 20, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(SF9_SCHOOL_INFO.schoolHeadTitle, marginX + 80, y + 10, { align: "center" });
  doc.text("Adviser", pageWidth - marginX - 80, y + 10, { align: "center" });
  y += 20;

  // 5. Title for Learning Progress Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_DARK);
  doc.text("LEARNING PROGRESS AND ACHIEVEMENT", pageWidth / 2, y, { align: "center" });
  y += 6;

  // Build Subjects Data Rows
  const gradesMap = studentData.grades || {};
  const tableBody = [];
  const finalGradesList = [];

  OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
    if (subj.isComposite) {
      // MAPEH composite row
      const sub1 = gradesMap["music_arts"] || {};
      const sub2 = gradesMap["pe_health"] || {};
      const t1Vals = [sub1.t1, sub2.t1].filter((v) => v != null && v !== "").map(Number);
      const t2Vals = [sub1.t2, sub2.t2].filter((v) => v != null && v !== "").map(Number);
      const t3Vals = [sub1.t3, sub2.t3].filter((v) => v != null && v !== "").map(Number);

      const mapehT1 = t1Vals.length ? Math.round(t1Vals.reduce((a, b) => a + b, 0) / t1Vals.length) : (gradesMap.mapeh?.t1 ?? "");
      const mapehT2 = t2Vals.length ? Math.round(t2Vals.reduce((a, b) => a + b, 0) / t2Vals.length) : (gradesMap.mapeh?.t2 ?? "");
      const mapehT3 = t3Vals.length ? Math.round(t3Vals.reduce((a, b) => a + b, 0) / t3Vals.length) : (gradesMap.mapeh?.t3 ?? "");
      const mapehFinal = computeTermAverage(mapehT1, mapehT2, mapehT3);
      if (mapehFinal !== null) finalGradesList.push(mapehFinal);
      const mapehDesc = getMatatagDescriptor(mapehFinal);

      tableBody.push([
        { content: subj.label, styles: { fontStyle: "bold" } },
        mapehT1 || "",
        mapehT2 || "",
        mapehT3 || "",
        mapehFinal !== null ? String(mapehFinal) : "",
        mapehDesc.remarks,
      ]);

      // Sub-areas
      subj.subAreas.forEach((sub) => {
        const subData = gradesMap[sub.key] || {};
        const subFinal = computeTermAverage(subData.t1, subData.t2, subData.t3);
        const subDesc = getMatatagDescriptor(subFinal);
        tableBody.push([
          { content: `   ${sub.label}`, styles: { fontStyle: "italic", textColor: BRAND_GRAY } },
          subData.t1 || "",
          subData.t2 || "",
          subData.t3 || "",
          subFinal !== null ? String(subFinal) : "",
          subDesc.remarks,
        ]);
      });
    } else {
      const g = gradesMap[subj.key] || {};
      const t1 = g.t1 ?? "";
      const t2 = g.t2 ?? "";
      const t3 = g.t3 ?? "";
      const finalG = computeTermAverage(t1, t2, t3);
      if (finalG !== null) finalGradesList.push(finalG);
      const desc = getMatatagDescriptor(finalG);

      tableBody.push([
        subj.label,
        t1 || "",
        t2 || "",
        t3 || "",
        finalG !== null ? String(finalG) : "",
        desc.remarks,
      ]);
    }
  });

  // General Average Row
  let generalAverage = null;
  if (finalGradesList.length > 0) {
    generalAverage = Math.round(finalGradesList.reduce((a, b) => a + b, 0) / finalGradesList.length);
  }
  const genAvgDesc = getMatatagDescriptor(generalAverage);

  tableBody.push([
    { content: "General Average", styles: { fontStyle: "bold", halign: "center" }, colSpan: 4 },
    { content: generalAverage !== null ? String(generalAverage) : "", styles: { fontStyle: "bold", halign: "center" } },
    { content: genAvgDesc.remarks, styles: { fontStyle: "bold", halign: "center" } },
  ]);

  // Render Table using autoTable - Exact 540pt width
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: 540,
    head: [
      [
        { content: "Learning Areas", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "TERM", colSpan: 3, styles: { halign: "center" } },
        { content: "Final\nGrade", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "Remarks", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
      ],
      [
        { content: "T1", styles: { halign: "center" } },
        { content: "T2", styles: { halign: "center" } },
        { content: "T3", styles: { halign: "center" } },
      ],
    ],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: BRAND_DARK,
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: BRAND_DARK,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
      cellPadding: 2.8,
    },
    columnStyles: {
      0: { cellWidth: 250, halign: "left" },
      1: { cellWidth: 45, halign: "center" },
      2: { cellWidth: 45, halign: "center" },
      3: { cellWidth: 45, halign: "center" },
      4: { cellWidth: 75, halign: "center" },
      5: { cellWidth: 80, halign: "center" },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 12;

  // 6. Performance Descriptors Legend - Exact 240pt width
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_DARK);
  doc.text("PERFORMANCE DESCRIPTORS", marginX, finalY);

  autoTable(doc, {
    startY: finalY + 4,
    margin: { left: marginX },
    tableWidth: 240,
    head: [
      [
        { content: "Grading Scale", styles: { halign: "center" } },
        { content: "Descriptors", styles: { halign: "center" } },
        { content: "Remarks", styles: { halign: "center" } },
      ],
    ],
    body: [
      ["90-100", "Advancing", "Passed"],
      ["80-89", "Benchmarking", "Passed"],
      ["75-79", "Connecting", "Passed"],
      ["65-74", "Developing", "Failed"],
      ["0-64", "Emerging", "Failed"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: BRAND_DARK,
      fontStyle: "bold",
      fontSize: 7,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: BRAND_DARK,
      cellPadding: 2,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    columnStyles: {
      0: { cellWidth: 75, halign: "center" },
      1: { cellWidth: 105, halign: "center" },
      2: { cellWidth: 60, halign: "center" },
    },
  });
}

/**
 * Render Page 2 (Back Side - Attendance, Comments, and Certificate of Transfer)
 */
function renderBackPage(doc, studentData, schoolYear) {
  const marginX = 36;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 32;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_DARK);
  doc.text("REPORT ON ATTENDANCE", pageWidth / 2, y, { align: "center" });
  y += 10;

  // 1. Attendance Grid (Jun to Apr + Total) - 13 columns total
  const attendance = studentData.attendance || {};
  const monthHeaders = SF9_MONTHS.map((m) => m.label).concat(["Total"]);

  const classDaysRow = ["No. of Class Days"];
  const presentDaysRow = ["No. of Days Present"];
  const absentDaysRow = ["No. of Days Absent"];

  let totalClassDays = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  SF9_MONTHS.forEach((m) => {
    const data = attendance[m.key] || {};
    const cd = Number(data.classDays || data.schoolDays || 0);
    const pres = Number(data.present || data.daysPresent || 0);
    const abs = Number(data.absent || data.daysAbsent || Math.max(0, cd - pres));

    totalClassDays += cd;
    totalPresent += pres;
    totalAbsent += abs;

    classDaysRow.push(cd > 0 ? String(cd) : "—");
    presentDaysRow.push(cd > 0 ? String(pres) : "—");
    absentDaysRow.push(cd > 0 ? String(abs) : "—");
  });

  classDaysRow.push(String(totalClassDays));
  presentDaysRow.push(String(totalPresent));
  absentDaysRow.push(String(totalAbsent));

  // 540pt available width: 108pt for label, 36pt each for 12 month columns
  const attColumnStyles = { 0: { cellWidth: 108, halign: "left", fontStyle: "bold" } };
  for (let i = 1; i <= 12; i++) {
    attColumnStyles[i] = { cellWidth: 36, halign: "center" };
  }

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [["Month", ...monthHeaders]],
    body: [classDaysRow, presentDaysRow, absentDaysRow],
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: BRAND_DARK,
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: BRAND_DARK,
      halign: "center",
      cellPadding: 3,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    columnStyles: attColumnStyles,
  });

  y = doc.lastAutoTable.finalY + 18;

  // 2. Teacher's Comments / Remarks & Parent Signature Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TEACHER'S COMMENTS / REMARKS & PARENT'S SIGNATURE", pageWidth / 2, y, {
    align: "center",
  });
  y += 6;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [
      [
        { content: "Period", styles: { halign: "center" } },
        { content: "Teacher's Comments / Remarks", styles: { halign: "center" } },
        { content: "Parent / Guardian Signature", styles: { halign: "center" } },
      ],
    ],
    body: [
      [
        { content: "Term 1", styles: { fontStyle: "bold", halign: "center" } },
        studentData.comments?.t1 || "",
        "",
      ],
      [
        { content: "Term 2", styles: { fontStyle: "bold", halign: "center" } },
        studentData.comments?.t2 || "",
        "",
      ],
      [
        { content: "Term 3", styles: { fontStyle: "bold", halign: "center" } },
        studentData.comments?.t3 || "",
        "",
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: BRAND_DARK,
      fontStyle: "bold",
      fontSize: 7.5,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: BRAND_DARK,
      cellPadding: 10,
      lineWidth: 0.5,
      lineColor: BORDER_COLOR,
    },
    columnStyles: {
      0: { cellWidth: 70, halign: "center" },
      1: { cellWidth: 270 },
      2: { cellWidth: 200 },
    },
  });

  y = doc.lastAutoTable.finalY + 20;

  // 3. Certificate of Transfer Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CERTIFICATE OF TRANSFER", pageWidth / 2, y, { align: "center" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.",
    marginX,
    y
  );
  y += 12;

  const nextGrade = String(Number(studentData.gradeLevel || 10) + 1);
  doc.setFont("helvetica", "bold");
  doc.text("Admitted to Grade: ____________________", marginX, y);
  doc.text(`Eligible for Admission to Grade: ${nextGrade}`, marginX + 270, y);
  y += 24;

  const schoolHead = (studentData.schoolHead || SF9_SCHOOL_INFO.defaultSchoolHead).toUpperCase();
  const adviser = (studentData.adviserName || studentData.adviser || "ALLAN A. MARCELO").toUpperCase();

  doc.text(schoolHead, marginX + 80, y, { align: "center" });
  doc.text(adviser, pageWidth - marginX - 80, y, { align: "center" });

  doc.setLineWidth(0.75);
  doc.line(marginX + 20, y + 2, marginX + 140, y + 2);
  doc.line(pageWidth - marginX - 140, y + 2, pageWidth - marginX - 20, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("School Head", marginX + 80, y + 10, { align: "center" });
  doc.text("Class Adviser", pageWidth - marginX - 80, y + 10, { align: "center" });
  y += 20;

  // 4. Cancellation of Eligibility
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CANCELLATION OF ELIGIBILITY TO TRANSFER", pageWidth / 2, y, { align: "center" });
  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Admitted in (School): __________________________________________________", marginX, y);
  doc.text("Date: ____________________", marginX + 330, y);
}

/**
 * Generate full official SF9 PDF for one or multiple students.
 * Each student receives a 2-page duplex pair (Page 1: Front, Page 2: Back).
 *
 * @param {object|object[]} students - Single studentData object or array of studentData objects.
 * @param {string} [schoolYear]
 * @returns {jsPDF}
 */
export function generateSf9PdfDocument(students = [], schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  const studentList = Array.isArray(students) ? students : [students];
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });

  studentList.forEach((student, index) => {
    if (index > 0) doc.addPage("letter", "portrait");
    renderFrontPage(doc, student, schoolYear);

    // Page 2: Back Side
    doc.addPage("letter", "portrait");
    renderBackPage(doc, student, schoolYear);
  });

  return doc;
}

/**
 * Trigger immediate browser download of single student SF9 PDF.
 */
export function downloadSingleStudentSf9Pdf(studentData = {}, schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  if (typeof window === "undefined") return;
  const doc = generateSf9PdfDocument(studentData, schoolYear);
  const nameSlug = (studentData.last_name || studentData.lastName || "Learner").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_${nameSlug}_${schoolYear}.pdf`;
  doc.save(filename);
}

/**
 * Trigger immediate browser download of batch section SF9 PDF.
 */
export function downloadSectionBatchSf9Pdf(sectionName = "Section", studentList = [], schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  if (typeof window === "undefined") return;
  const doc = generateSf9PdfDocument(studentList, schoolYear);
  const sectionSlug = String(sectionName).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_Batch_${sectionSlug}_${schoolYear}.pdf`;
  doc.save(filename);
}
