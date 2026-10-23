/**
 * Official DepEd School Form 9 (SF9 / Form 138) Excel Exporter
 * Clones and populates public/templates/Report Card 2026-2027.xlsx using ExcelJS.
 * Produces an exact 1:1 replica of the DepEd Cambaog NHS Excel template.
 */

import ExcelJS from "exceljs";
import {
  SF9_SCHOOL_INFO,
  SF9_MONTHS,
  formatDepEdLearnerName,
  calculateAge,
  computeTermAverage,
} from "./sf9DataService.js";

const MONTH_COL_LETTERS = [
  "R", // Jun
  "S", // Jul
  "T", // Aug
  "U", // Sep
  "V", // Oct
  "W", // Nov
  "X", // Dec
  "Y", // Jan
  "Z", // Feb
  "AA", // Mar
  "AB", // Apr
];

/**
 * Fetch template workbook buffer in browser or Node environment.
 */
async function loadTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  if (typeof window !== "undefined") {
    const response = await fetch("/templates/Report Card 2026-2027.xlsx");
    if (!response.ok) {
      throw new Error(`Failed to fetch SF9 Excel template: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
  } else {
    // Node.js environment
    await workbook.xlsx.readFile("public/templates/Report Card 2026-2027.xlsx");
  }
  return workbook;
}

/**
 * Populate an individual worksheet with student data matching Report Card 2026-2027.xlsx.
 */
function populateStudentWorksheet(ws, studentData = {}, schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  const learnerName = formatDepEdLearnerName(studentData);
  const lrn = String(studentData.lrn || studentData.studentNumber || "—");
  const age = calculateAge(studentData.birthdate);
  const sex = (studentData.gender || studentData.sex || "—").toUpperCase().charAt(0) || "—";
  const gradeLevel = String(studentData.gradeLevel || studentData.grade_level || "7");
  const sectionName = (studentData.sectionName || studentData.section_name || studentData.section || "—").toUpperCase();
  const track = studentData.track || "";
  const schoolHead = (studentData.schoolHead || SF9_SCHOOL_INFO.defaultSchoolHead).toUpperCase();
  const adviser = (studentData.adviserName || studentData.adviser || "ALLAN A. MARCELO").toUpperCase();

  // 1. School Year header
  ws.getCell("B15").value = `School Year ${schoolYear || SF9_SCHOOL_INFO.schoolYear}`;

  // 2. Learner Information
  ws.getCell("C17").value = learnerName;
  ws.getCell("I17").value = age !== "—" ? Number(age) || age : "";
  ws.getCell("K17").value = sex;

  ws.getCell("C18").value = lrn;
  ws.getCell("I18").value = gradeLevel;
  ws.getCell("K18").value = sectionName;

  ws.getCell("B19").value = `Track (SHS only): ${track}`;

  // 3. School Head & Adviser signatures (Page 1)
  ws.getCell("B27").value = schoolHead;
  ws.getCell("H27").value = adviser;

  // 4. Grades Table
  const grades = studentData.grades || {};
  const finalGradesList = [];

  const subjectRowMap = [
    { key: "filipino", row: 32 },
    { key: "english", row: 33 },
    { key: "mathematics", row: 34 },
    { key: "science", row: 35 },
    { key: "araling_panlipunan", row: 36 },
    { key: "values_education", row: 37 },
    { key: "tle", row: 38 },
  ];

  subjectRowMap.forEach(({ key, row }) => {
    const g = grades[key] || {};
    const t1 = g.t1 != null && g.t1 !== "" ? Number(g.t1) : "";
    const t2 = g.t2 != null && g.t2 !== "" ? Number(g.t2) : "";
    const t3 = g.t3 != null && g.t3 !== "" ? Number(g.t3) : "";

    ws.getCell(`F${row}`).value = t1;
    ws.getCell(`G${row}`).value = t2;
    ws.getCell(`H${row}`).value = t3;

    const finalG = computeTermAverage(t1, t2, t3);
    if (finalG !== null) {
      finalGradesList.push(finalG);
      ws.getCell(`I${row}`).value = finalG;
      ws.getCell(`J${row}`).value = finalG >= 75 ? "Passed" : "Failed";
    } else {
      ws.getCell(`I${row}`).value = "";
      ws.getCell(`J${row}`).value = "";
    }
  });

  // MAPEH & Sub-areas
  const sub1 = grades["music_arts"] || {};
  const sub2 = grades["pe_health"] || {};

  const maT1 = sub1.t1 != null && sub1.t1 !== "" ? Number(sub1.t1) : "";
  const maT2 = sub1.t2 != null && sub1.t2 !== "" ? Number(sub1.t2) : "";
  const maT3 = sub1.t3 != null && sub1.t3 !== "" ? Number(sub1.t3) : "";
  const maFinal = computeTermAverage(maT1, maT2, maT3);

  ws.getCell("F40").value = maT1;
  ws.getCell("G40").value = maT2;
  ws.getCell("H40").value = maT3;
  ws.getCell("I40").value = maFinal !== null ? maFinal : "";

  const pehT1 = sub2.t1 != null && sub2.t1 !== "" ? Number(sub2.t1) : "";
  const pehT2 = sub2.t2 != null && sub2.t2 !== "" ? Number(sub2.t2) : "";
  const pehT3 = sub2.t3 != null && sub2.t3 !== "" ? Number(sub2.t3) : "";
  const pehFinal = computeTermAverage(pehT1, pehT2, pehT3);

  ws.getCell("F41").value = pehT1;
  ws.getCell("G41").value = pehT2;
  ws.getCell("H41").value = pehT3;
  ws.getCell("I41").value = pehFinal !== null ? pehFinal : "";

  // Consolidated MAPEH
  const mapehT1 = maT1 !== "" && pehT1 !== "" ? Math.round((maT1 + pehT1) / 2) : (grades.mapeh?.t1 ?? "");
  const mapehT2 = maT2 !== "" && pehT2 !== "" ? Math.round((maT2 + pehT2) / 2) : (grades.mapeh?.t2 ?? "");
  const mapehT3 = maT3 !== "" && pehT3 !== "" ? Math.round((maT3 + pehT3) / 2) : (grades.mapeh?.t3 ?? "");
  const mapehFinal = computeTermAverage(mapehT1, mapehT2, mapehT3);

  ws.getCell("F39").value = mapehT1;
  ws.getCell("G39").value = mapehT2;
  ws.getCell("H39").value = mapehT3;

  if (mapehFinal !== null) {
    finalGradesList.push(mapehFinal);
    ws.getCell("I39").value = mapehFinal;
    ws.getCell("J39").value = mapehFinal >= 75 ? "Passed" : "Failed";
  } else {
    ws.getCell("I39").value = "";
    ws.getCell("J39").value = "";
  }

  // General Average (strictly requires all 8 subjects to be complete per DepEd rule)
  if (finalGradesList.length === 8) {
    const genAvg = Math.round(finalGradesList.reduce((a, b) => a + b, 0) / 8);
    ws.getCell("I42").value = genAvg;
    ws.getCell("J42").value = genAvg >= 75 ? "Passed" : "Failed";
  } else {
    ws.getCell("I42").value = "";
    ws.getCell("J42").value = "";
  }

  // 5. Attendance (June to April + Total)
  const attendance = studentData.attendance || {};
  let totalClassDays = 0;
  let totalPresent = 0;
  let totalAbsent = 0;

  SF9_MONTHS.forEach((m, idx) => {
    const colLetter = MONTH_COL_LETTERS[idx];
    const data = attendance[m.key] || {};
    const cd = Number(data.classDays || data.schoolDays || 0);
    const pres = Number(data.present || data.daysPresent || 0);
    const abs = Number(data.absent || data.daysAbsent || Math.max(0, cd - pres));

    totalClassDays += cd;
    totalPresent += pres;
    totalAbsent += abs;

    ws.getCell(`${colLetter}5`).value = cd > 0 ? cd : "";
    ws.getCell(`${colLetter}7`).value = cd > 0 ? pres : "";
    ws.getCell(`${colLetter}9`).value = cd > 0 ? abs : "";
  });

  ws.getCell("AC5").value = totalClassDays;
  ws.getCell("AC7").value = totalPresent;
  ws.getCell("AC9").value = totalAbsent;

  // 6. Teacher Comments
  if (studentData.comments?.t1) {
    ws.getCell("Q15").value = `Term 1\n\n${studentData.comments.t1}`;
  }
  if (studentData.comments?.t2) {
    ws.getCell("Q19").value = `Term 2\n\n${studentData.comments.t2}`;
  }
  if (studentData.comments?.t3) {
    ws.getCell("Q23").value = `Term 3\n\n${studentData.comments.t3}`;
  }

  // 7. Certificate of Transfer & Cancellation
  const nextGrade = String(Number(gradeLevel) + 1);
  ws.getCell("Q37").value = "Admitted to Grade: ____________________";
  ws.getCell("Q38").value = `Eligible for Admission to Grade: ${nextGrade}`;
  ws.getCell("Q41").value = schoolHead;
  ws.getCell("X40").value = adviser;
  ws.getCell("Q49").value = schoolHead;
}

/**
 * Generate a populated ExcelJS workbook for a single learner.
 */
export async function generateSingleStudentSf9Excel(studentData = {}, schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  const workbook = await loadTemplateWorkbook();
  const ws = workbook.getWorksheet("Sheet1") || workbook.worksheets[0];
  populateStudentWorksheet(ws, studentData, schoolYear);
  return workbook;
}

/**
 * Trigger immediate browser download of an official filled SF9 Excel file.
 */
export async function downloadSingleStudentSf9Excel(studentData = {}, schoolYear = SF9_SCHOOL_INFO.schoolYear) {
  if (typeof window === "undefined") return;

  const workbook = await generateSingleStudentSf9Excel(studentData, schoolYear);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const nameSlug = (studentData.last_name || studentData.lastName || "Learner").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_${nameSlug}_${schoolYear}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download a section batch SF9 Excel workbook containing all learners.
 */
export async function downloadSectionBatchSf9Excel(
  sectionName = "Section",
  studentList = [],
  schoolYear = SF9_SCHOOL_INFO.schoolYear,
  onProgress = null
) {
  if (typeof window === "undefined") return { success: false, error: "Window is not defined" };
  if (!Array.isArray(studentList) || studentList.length === 0) {
    return { success: false, error: "No learners provided for batch SF9 generation." };
  }

  const baseWorkbook = await loadTemplateWorkbook();
  const templateWs = baseWorkbook.getWorksheet("Sheet1") || baseWorkbook.worksheets[0];
  const total = studentList.length;

  for (let i = 0; i < total; i++) {
    const student = studentList[i];
    const sheetName = (student.lastName || `Learner_${i + 1}`).slice(0, 25).replace(/[:\\\/\?\*\[\]]/g, "_");
    const ws = i === 0 ? templateWs : baseWorkbook.addWorksheet(sheetName);
    if (i === 0) ws.name = sheetName;

    // For added worksheets, copy structure from template
    if (i > 0) {
      templateWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const newRow = ws.getRow(rowNumber);
        newRow.height = row.height;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const newCell = newRow.getCell(colNumber);
          newCell.value = cell.value;
          newCell.style = Object.assign({}, cell.style);
        });
      });
      // Copy merges
      templateWs.model.merges.forEach((merge) => {
        try {
          ws.mergeCells(merge);
        } catch {
          // ignore duplicate merge errors
        }
      });
    }

    populateStudentWorksheet(ws, student, schoolYear);
    onProgress?.({
      current: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      studentName: student.name || `${student.firstName || ""} ${student.lastName || ""}`.trim(),
    });
  }

  const buffer = await baseWorkbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const sectionSlug = String(sectionName).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `CNHS_SF9_Batch_${sectionSlug}_${schoolYear}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, filename };
}
