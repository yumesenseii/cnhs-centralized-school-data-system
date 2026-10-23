/**
 * Official DepEd School Form 9 (SF9 / Form 138) PDF Generator
 * Built with jsPDF and jspdf-autotable.
 * Exact 1:1 replica of Cambaog National High School SY 2026-2027 MATATAG template
 * (Report Card 2026-2027.xlsx) formatted for official A4 portrait paper.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SF9_SCHOOL_INFO,
  SF9_MONTHS,
  OFFICIAL_SUBJECT_KEYS,
  computeTermAverage,
  formatDepEdLearnerName,
  calculateAge,
} from "./sf9DataService.js";
import { DEPED_SEAL_BASE64, CNHS_LOGO_BASE64 } from "./sf9Logos.js";

const BORDER_BLACK = [0, 0, 0];
const TEXT_BLACK = [0, 0, 0];
const LINE_GRAY = [80, 80, 80];

/**
 * Render Page 1 (Front Side - Academic Progress & Achievement)
 * Exactly replicates Columns A to L of Report Card 2026-2027.xlsx in A4 portrait.
 */
function renderFrontPage(doc, studentData, schoolYear) {
  const marginX = 24;
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const contentWidth = 547; // 595.28 - 48 = 547.28 pt
  let y = 22;

  // 1. Dual Official Logos (DepEd Seal on Left, CNHS Seal on Right)
  try {
    if (DEPED_SEAL_BASE64) {
      doc.addImage(DEPED_SEAL_BASE64, "PNG", marginX + 4, y, 56, 56);
    }
  } catch (e) {
    console.warn("[SF9] DepEd logo draw skipped:", e);
  }

  try {
    if (CNHS_LOGO_BASE64) {
      doc.addImage(CNHS_LOGO_BASE64, "PNG", pageWidth - marginX - 60, y, 56, 56);
    }
  } catch (e) {
    console.warn("[SF9] CNHS logo draw skipped:", e);
  }

  // 2. Official DepEd Letterhead (Bookman Old Style / Serif styling)
  doc.setTextColor(...TEXT_BLACK);
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Republic of the Philippines", pageWidth / 2, y, { align: "center" });
  y += 13;

  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text("Department of Education", pageWidth / 2, y, { align: "center" });
  y += 12.5;

  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(SF9_SCHOOL_INFO.region, pageWidth / 2, y, { align: "center" });
  y += 12.5;

  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text(SF9_SCHOOL_INFO.division, pageWidth / 2, y, { align: "center" });
  y += 12.5;

  doc.text(SF9_SCHOOL_INFO.district, pageWidth / 2, y, { align: "center" });
  y += 13.5;

  doc.text(SF9_SCHOOL_INFO.municipality, pageWidth / 2, y, { align: "center" });
  y += 18;

  doc.setFont("times", "bold");
  doc.setFontSize(13.5);
  doc.text(SF9_SCHOOL_INFO.schoolName, pageWidth / 2, y, { align: "center" });
  y += 16;

  doc.setFont("times", "normal");
  doc.setFontSize(9.5);
  doc.text(`School Year ${schoolYear || SF9_SCHOOL_INFO.schoolYear}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 24;

  // 3. Student Information Block with underline styling
  const learnerName = formatDepEdLearnerName(studentData);
  const lrn = studentData.lrn || studentData.studentNumber || "—";
  const age = calculateAge(studentData.birthdate);
  const sex = (studentData.gender || studentData.sex || "—").toUpperCase().charAt(0) || "—";
  const gradeLevel = studentData.gradeLevel || studentData.grade_level || "7";
  const sectionName = (studentData.sectionName || studentData.section_name || studentData.section || "—").toUpperCase();
  const track = studentData.track || "";

  doc.setDrawColor(...BORDER_BLACK);
  doc.setLineWidth(0.5);

  // Line 1: Name, Age, Sex
  doc.setFontSize(9.5);
  doc.setFont("times", "normal");
  doc.text("Name:", marginX, y);

  doc.setFont("times", "bold");
  doc.text(learnerName, marginX + 36, y);
  doc.line(marginX + 32, y + 2, marginX + 315, y + 2);

  doc.setFont("times", "normal");
  doc.text("Age:", marginX + 330, y);
  doc.setFont("times", "bold");
  doc.text(age !== "—" ? String(age) : "—", marginX + 365, y, { align: "center" });
  doc.line(marginX + 355, y + 2, marginX + 415, y + 2);

  doc.setFont("times", "normal");
  doc.text("Sex:", marginX + 430, y);
  doc.setFont("times", "bold");
  doc.text(sex, marginX + 475, y, { align: "center" });
  doc.line(marginX + 455, y + 2, pageWidth - marginX, y + 2);
  y += 20;

  // Line 2: LRN, Grade, Section
  doc.setFont("times", "normal");
  doc.text("LRN:", marginX, y);
  doc.setFont("times", "bold");
  doc.text(lrn, marginX + 36, y);
  doc.line(marginX + 32, y + 2, marginX + 315, y + 2);

  doc.setFont("times", "normal");
  doc.text("Grade:", marginX + 330, y);
  doc.setFont("times", "bold");
  doc.text(String(gradeLevel), marginX + 375, y, { align: "center" });
  doc.line(marginX + 365, y + 2, marginX + 415, y + 2);

  doc.setFont("times", "normal");
  doc.text("Section:", marginX + 430, y);
  doc.setFont("times", "bold");
  doc.text(sectionName, marginX + 488, y, { align: "center" });
  doc.line(marginX + 470, y + 2, pageWidth - marginX, y + 2);
  y += 20;

  // Line 3: Track (SHS only)
  doc.setFont("times", "normal");
  doc.text("Track (SHS only):", marginX, y);
  if (track) {
    doc.setFont("times", "bold");
    doc.text(track, marginX + 95, y);
  }
  doc.line(marginX + 90, y + 2, pageWidth - marginX, y + 2);
  y += 24;

  // 4. Dear Parents Note
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.text("Dear Parents,", marginX, y);
  y += 12;
  doc.text(
    "This Performance Report presents your child's progress and achievement in the different learning areas.",
    marginX + 16,
    y
  );
  y += 12;
  doc.text(
    "The school welcomes you to reach out should you wish to know more about your child's learning and performance.",
    marginX + 16,
    y
  );
  y += 28;

  // 5. Signatures (School Head & Adviser)
  const schoolHead = (studentData.schoolHead || SF9_SCHOOL_INFO.defaultSchoolHead).toUpperCase();
  const adviser = (studentData.adviserName || studentData.adviser || "ALLAN A. MARCELO").toUpperCase();

  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.text(schoolHead, marginX + 90, y, { align: "center" });
  doc.text(adviser, pageWidth - marginX - 90, y, { align: "center" });

  doc.line(marginX + 15, y + 2, marginX + 165, y + 2);
  doc.line(pageWidth - marginX - 165, y + 2, pageWidth - marginX - 15, y + 2);

  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text("School Head", marginX + 90, y + 13, { align: "center" });
  doc.text("Adviser", pageWidth - marginX - 90, y + 13, { align: "center" });
  y += 26;

  // 6. Title for Learning Progress Table
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.text("LEARNING PROGRESS AND ACHIEVEMENT", pageWidth / 2, y, { align: "center" });
  y += 10;

  // 7. Learning Areas Table Body (8 Subjects + MAPEH sub-areas + General Average)
  const gradesMap = studentData.grades || {};
  const tableBody = [];
  const finalGradesList = [];

  OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
    if (subj.isComposite) {
      // MAPEH composite row
      const sub1 = gradesMap["music_arts"] || {};
      const sub2 = gradesMap["pe_health"] || {};

      const maT1 = sub1.t1 != null && sub1.t1 !== "" ? Number(sub1.t1) : null;
      const maT2 = sub1.t2 != null && sub1.t2 !== "" ? Number(sub1.t2) : null;
      const maT3 = sub1.t3 != null && sub1.t3 !== "" ? Number(sub1.t3) : null;
      const maFinal = computeTermAverage(maT1, maT2, maT3);

      const pehT1 = sub2.t1 != null && sub2.t1 !== "" ? Number(sub2.t1) : null;
      const pehT2 = sub2.t2 != null && sub2.t2 !== "" ? Number(sub2.t2) : null;
      const pehT3 = sub2.t3 != null && sub2.t3 !== "" ? Number(sub2.t3) : null;
      const pehFinal = computeTermAverage(pehT1, pehT2, pehT3);

      // Composite term averages (only valid if both components exist for that term)
      const mapehT1 =
        maT1 !== null && pehT1 !== null
          ? Math.round((maT1 + pehT1) / 2)
          : gradesMap.mapeh?.t1 != null && gradesMap.mapeh?.t1 !== ""
          ? Number(gradesMap.mapeh.t1)
          : null;

      const mapehT2 =
        maT2 !== null && pehT2 !== null
          ? Math.round((maT2 + pehT2) / 2)
          : gradesMap.mapeh?.t2 != null && gradesMap.mapeh?.t2 !== ""
          ? Number(gradesMap.mapeh.t2)
          : null;

      const mapehT3 =
        maT3 !== null && pehT3 !== null
          ? Math.round((maT3 + pehT3) / 2)
          : gradesMap.mapeh?.t3 != null && gradesMap.mapeh?.t3 !== ""
          ? Number(gradesMap.mapeh.t3)
          : null;

      // Final Grade only computed if all 3 terms are completely present
      const mapehFinal = computeTermAverage(mapehT1, mapehT2, mapehT3);
      if (mapehFinal !== null) finalGradesList.push(mapehFinal);

      tableBody.push([
        { content: subj.label, styles: { font: "times", fontStyle: "normal" } },
        mapehT1 !== null ? String(mapehT1) : "",
        mapehT2 !== null ? String(mapehT2) : "",
        mapehT3 !== null ? String(mapehT3) : "",
        mapehFinal !== null ? String(mapehFinal) : "",
        mapehFinal !== null ? (mapehFinal >= 75 ? "Passed" : "Failed") : "",
      ]);

      // Sub-areas (Music and Arts, Physical Education and Health) - Indented & Italic
      tableBody.push([
        { content: `   Music and Arts`, styles: { font: "times", fontStyle: "italic" } },
        maT1 !== null ? String(maT1) : "",
        maT2 !== null ? String(maT2) : "",
        maT3 !== null ? String(maT3) : "",
        maFinal !== null ? String(maFinal) : "",
        "",
      ]);

      tableBody.push([
        { content: `   Physical Education and Health`, styles: { font: "times", fontStyle: "italic" } },
        pehT1 !== null ? String(pehT1) : "",
        pehT2 !== null ? String(pehT2) : "",
        pehT3 !== null ? String(pehT3) : "",
        pehFinal !== null ? String(pehFinal) : "",
        "",
      ]);
    } else {
      const g = gradesMap[subj.key] || {};
      const t1 = g.t1 != null && g.t1 !== "" ? Number(g.t1) : null;
      const t2 = g.t2 != null && g.t2 !== "" ? Number(g.t2) : null;
      const t3 = g.t3 != null && g.t3 !== "" ? Number(g.t3) : null;

      // DepEd rule: Final Grade ONLY computed if T1, T2, T3 are all present
      const finalG = computeTermAverage(t1, t2, t3);
      if (finalG !== null) finalGradesList.push(finalG);

      tableBody.push([
        { content: subj.label, styles: { font: "times", fontStyle: "normal" } },
        t1 !== null ? String(t1) : "",
        t2 !== null ? String(t2) : "",
        t3 !== null ? String(t3) : "",
        finalG !== null ? String(finalG) : "",
        finalG !== null ? (finalG >= 75 ? "Passed" : "Failed") : "",
      ]);
    }
  });

  // General Average: DepEd rule: ONLY compute if ALL 8 subjects have complete final grades
  let generalAverage = null;
  let genAvgRemark = "";
  if (finalGradesList.length === 8) {
    generalAverage = Math.round(finalGradesList.reduce((a, b) => a + b, 0) / 8);
    genAvgRemark = generalAverage >= 75 ? "Passed" : "Failed";
  }

  tableBody.push([
    {
      content: "General Average",
      colSpan: 4,
      styles: { font: "times", fontStyle: "bolditalic", halign: "right" },
    },
    {
      content: generalAverage !== null ? String(generalAverage) : "",
      styles: { font: "times", fontStyle: "bold", halign: "center" },
    },
    {
      content: genAvgRemark,
      styles: { font: "times", fontStyle: "bold", halign: "center" },
    },
  ]);

  // Render Table - Exact 547pt table width for A4
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [
      [
        { content: "Learning Areas", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "TERM", colSpan: 3, styles: { halign: "center" } },
        { content: "Final Grade", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
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
      fillColor: [255, 255, 255],
      textColor: TEXT_BLACK,
      font: "times",
      fontStyle: "bold",
      fontSize: 8.5,
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
      cellPadding: 5.0,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: TEXT_BLACK,
      font: "times",
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
      cellPadding: 8.2,
    },
    columnStyles: {
      0: { cellWidth: 259, halign: "left" },
      1: { cellWidth: 42, halign: "center" },
      2: { cellWidth: 42, halign: "center" },
      3: { cellWidth: 42, halign: "center" },
      4: { cellWidth: 81, halign: "center" },
      5: { cellWidth: 81, halign: "center" },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 22;

  // 8. Performance Descriptors Section (Clean Boxed Grid format matching Reference 2)
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("PERFORMANCE DESCRIPTORS", pageWidth / 2, finalY, { align: "center" });

  const descTableWidth = 360;
  const descMarginLeft = (pageWidth - descTableWidth) / 2;

  autoTable(doc, {
    startY: finalY + 8,
    margin: { left: descMarginLeft },
    tableWidth: descTableWidth,
    head: [
      [
        { content: "Grading Scale", styles: { halign: "center" } },
        { content: "Descriptors", styles: { halign: "center" } },
        { content: "Remarks", styles: { halign: "center" } },
      ],
    ],
    body: [
      ["90–100", "Advancing", "Passed"],
      ["80–89", "Benchmarking", "Passed"],
      ["75–79", "Connecting", "Passed"],
      ["65–74", "Developing", "Failed"],
      ["0–64", "Emerging", "Failed"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: TEXT_BLACK,
      font: "times",
      fontStyle: "bold",
      fontSize: 8.5,
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
      cellPadding: 4.8,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: TEXT_BLACK,
      font: "times",
      cellPadding: 6.5,
      halign: "center",
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
    },
    columnStyles: {
      0: { cellWidth: 110, halign: "center" },
      1: { cellWidth: 140, halign: "center" },
      2: { cellWidth: 110, halign: "center" },
    },
  });
}

/**
 * Render Page 2 (Back Side - Attendance, Comments, and Certificate of Transfer)
 * Exactly replicates Columns Q to AC of Report Card 2026-2027.xlsx in A4 portrait.
 */
function renderBackPage(doc, studentData, schoolYear) {
  const marginX = 24;
  const pageWidth = doc.internal.pageSize.getWidth(); // 595.28 pt
  const contentWidth = 547;
  let y = 26;

  // Title
  doc.setTextColor(...TEXT_BLACK);
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.text("REPORT ON ATTENDANCE", pageWidth / 2, y, { align: "center" });
  y += 10;

  // 1. Attendance Grid (Jun to Apr + Total) - 13 columns total
  const attendance = studentData.attendance || {};
  const monthHeaders = SF9_MONTHS.map((m) => m.label).concat(["Total"]);

  const classDaysRow = [{ content: "No. of Class Days", styles: { fontStyle: "normal", halign: "left" } }];
  const presentDaysRow = [{ content: "No. of Days Present", styles: { fontStyle: "normal", halign: "left" } }];
  const absentDaysRow = [{ content: "No. of Days Absent", styles: { fontStyle: "normal", halign: "left" } }];

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

    classDaysRow.push(cd > 0 ? String(cd) : "");
    presentDaysRow.push(cd > 0 ? String(pres) : "");
    absentDaysRow.push(cd > 0 ? String(abs) : "");
  });

  classDaysRow.push(String(totalClassDays));
  presentDaysRow.push(String(totalPresent));
  absentDaysRow.push(String(totalAbsent));

  // 547pt content width: 103pt for labels, 37pt each for 12 month columns (103 + 444 = 547)
  const attColumnStyles = { 0: { cellWidth: 103, halign: "left" } };
  for (let i = 1; i <= 12; i++) {
    attColumnStyles[i] = { cellWidth: 37, halign: "center" };
  }

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    head: [["Month", ...monthHeaders]],
    body: [classDaysRow, presentDaysRow, absentDaysRow],
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: TEXT_BLACK,
      font: "times",
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
      cellPadding: 4.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: TEXT_BLACK,
      font: "times",
      halign: "center",
      cellPadding: 5.5,
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
    },
    columnStyles: attColumnStyles,
  });

  y = doc.lastAutoTable.finalY + 24;

  // 2. Teacher's Comments / Remarks
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("TEACHER'S COMMENTS / REMARKS", pageWidth / 2, y, { align: "center" });
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    body: [
      [
        {
          content: `Term 1\n\n${studentData.comments?.t1 || ""}`,
          styles: { cellPadding: 8, minCellHeight: 62, valign: "top" },
        },
      ],
      [
        {
          content: `Term 2\n\n${studentData.comments?.t2 || ""}`,
          styles: { cellPadding: 8, minCellHeight: 62, valign: "top" },
        },
      ],
      [
        {
          content: `Term 3\n\n${studentData.comments?.t3 || ""}`,
          styles: { cellPadding: 8, minCellHeight: 62, valign: "top" },
        },
      ],
    ],
    theme: "grid",
    bodyStyles: {
      fontSize: 8.5,
      textColor: TEXT_BLACK,
      font: "times",
      lineWidth: 0.5,
      lineColor: BORDER_BLACK,
    },
  });

  y = doc.lastAutoTable.finalY + 24;

  // 3. Parent / Guardian's Signature
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("PARENT/S GUARDIAN'S SIGNATURE", pageWidth / 2, y, { align: "center" });
  y += 18;

  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setLineWidth(0.5);

  doc.text("Term 1", marginX + 30, y);
  doc.line(marginX + 80, y + 1, pageWidth - marginX - 30, y + 1);
  y += 20;

  doc.text("Term 2", marginX + 30, y);
  doc.line(marginX + 80, y + 1, pageWidth - marginX - 30, y + 1);
  y += 20;

  doc.text("Term 3", marginX + 30, y);
  doc.line(marginX + 80, y + 1, pageWidth - marginX - 30, y + 1);
  y += 28;

  // 4. Certificate of Transfer Box
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("CERTIFICATE OF TRANSFER", pageWidth / 2, y, { align: "center" });
  y += 14;

  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text(
    "This is to certify that the above-named learner has satisfactorily completed the requirements for the grade level indicated.",
    marginX,
    y
  );
  y += 14;

  const nextGrade = String(Number(studentData.gradeLevel || 7) + 1);
  doc.text("Admitted to Grade: ____________________", marginX, y);
  doc.text(`Eligible for Admission to Grade: ${nextGrade}`, marginX + 280, y);
  y += 26;

  const schoolHead = (studentData.schoolHead || SF9_SCHOOL_INFO.defaultSchoolHead).toUpperCase();
  const adviser = (studentData.adviserName || studentData.adviser || "ALLAN A. MARCELO").toUpperCase();

  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text("Approved:", marginX, y - 12);

  doc.text(schoolHead, marginX + 90, y, { align: "center" });
  doc.text(adviser, pageWidth - marginX - 90, y, { align: "center" });

  doc.line(marginX + 20, y + 1.5, marginX + 160, y + 1.5);
  doc.line(pageWidth - marginX - 160, y + 1.5, pageWidth - marginX - 20, y + 1.5);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("School Head", marginX + 90, y + 11, { align: "center" });
  doc.text("Adviser", pageWidth - marginX - 90, y + 11, { align: "center" });
  y += 26;

  // 5. Cancellation of Eligibility
  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.text("CANCELLATION OF ELIGIBILITY TO TRANSFER", pageWidth / 2, y, { align: "center" });
  y += 14;

  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text("Admitted in: __________________________________________________", marginX, y);
  doc.text("Date: ____________________", marginX + 360, y);
  y += 24;

  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text(schoolHead, marginX + 90, y, { align: "center" });
  doc.line(marginX + 20, y + 1.5, marginX + 160, y + 1.5);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("School Head", marginX + 90, y + 11, { align: "center" });
}

/**
 * Generate full official SF9 PDF for one or multiple students in A4 portrait format.
 * Each student receives a 2-page duplex pair (Page 1: Front, Page 2: Back).
 *
 * @param {object|object[]} students - Single studentData object or array of studentData objects.
 * @param {string} [schoolYear]
 * @returns {jsPDF}
 */
export function generateSf9PdfDocument(students = [], schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  const studentList = Array.isArray(students) ? students : [students];
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

  studentList.forEach((student, index) => {
    if (index > 0) doc.addPage("a4", "portrait");
    renderFrontPage(doc, student, schoolYear);

    // Page 2: Back Side
    doc.addPage("a4", "portrait");
    renderBackPage(doc, student, schoolYear);
  });

  return doc;
}

/**
 * Generate a single page (Page 1: Front, Page 2: Back) of official SF9 PDF in A4 portrait for preview.
 *
 * @param {object} student - Student data object.
 * @param {string} [schoolYear]
 * @param {number} [pageNumber=1] - 1 for front page, 2 for back page.
 * @returns {jsPDF}
 */
export function generateSf9SinglePageDocument(student = {}, schoolYear = SF9_SCHOOL_INFO.schoolYear, pageNumber = 1) {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  if (Number(pageNumber) === 2) {
    renderBackPage(doc, student, schoolYear);
  } else {
    renderFrontPage(doc, student, schoolYear);
  }
  return doc;
}

/**
 * Trigger immediate browser download of single student SF9 PDF in A4 portrait.
 */
export function downloadSingleStudentSf9Pdf(studentData = {}, schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  if (typeof window === "undefined") return;
  const doc = generateSf9PdfDocument(studentData, schoolYear);
  const nameSlug = (studentData.last_name || studentData.lastName || "Learner").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_${nameSlug}_${schoolYear}.pdf`;
  doc.save(filename);
}

/**
 * Trigger immediate browser download of batch section SF9 PDF in A4 portrait.
 */
export function downloadSectionBatchSf9Pdf(sectionName = "Section", studentList = [], schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  if (typeof window === "undefined") return;
  const doc = generateSf9PdfDocument(studentList, schoolYear);
  const sectionSlug = String(sectionName).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_Batch_${sectionSlug}_${schoolYear}.pdf`;
  doc.save(filename);
}

/**
 * Asynchronously generate and download batch section SF9 PDF in A4 portrait with real-time progress callbacks.
 */
export async function downloadSectionBatchSf9PdfAsync(
  sectionName = "Section",
  studentList = [],
  schoolYear = SF9_SCHOOL_INFO.schoolYear,
  onProgress = null
) {
  if (typeof window === "undefined") return { success: false, error: "Window is not defined" };
  if (!Array.isArray(studentList) || studentList.length === 0) {
    return { success: false, error: "No learners provided for batch SF9 generation." };
  }

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const total = studentList.length;

  for (let i = 0; i < total; i++) {
    const student = studentList[i];
    if (i > 0) doc.addPage("a4", "portrait");
    renderFrontPage(doc, student, schoolYear);

    // Page 2: Back Side
    doc.addPage("a4", "portrait");
    renderBackPage(doc, student, schoolYear);

    onProgress?.({
      current: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      studentName:
        student.name ||
        `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
        `Learner ${i + 1}`,
    });

    if (i % 2 === 0 || i === total - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const sectionSlug = String(sectionName).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_Batch_${sectionSlug}_${schoolYear}.pdf`;
  doc.save(filename);
  return { success: true, filename };
}
