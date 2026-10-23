import ExcelJS from "exceljs";
import { settingsData } from "@/data/settings";
import { formatSf2LearnerName } from "@/lib/attendance/sf2Daily";
import { ECR_COMPONENTS, scoreKey } from "@/lib/ecr/constants";
import { partitionStudentsBySex } from "@/lib/ecr/gridLayout";
import {
  OFFICIAL_ECR_SHEETS,
  OFFICIAL_ECR_TEMPLATE_URL,
  OFFICIAL_INPUT,
  OFFICIAL_TERM,
  officialFemaleDataRows,
  officialMaleDataRows,
  officialScoreColumns,
} from "@/lib/ecr/officialEcrTemplateMap";
import { downloadWorkbook } from "@/lib/reports/excelOfficialTemplate";
import { parseValidGrade } from "./gradeIntegrity.js";
import { computeFinalFromTerms, termGradeDescription } from "./computeGrades.js";

function normalizeSchoolYear(schoolYear) {
  if (!schoolYear) return "";
  return String(schoolYear)
    .replace(/^SY\s*/i, "")
    .replace(/–/g, "-")
    .trim();
}

function formatOfficialSchoolYear(schoolYear) {
  const raw = normalizeSchoolYear(schoolYear);
  const match = raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (match) return `${match[1]} - ${match[2]}`;
  return raw;
}

function formatOfficialLearnerName(student) {
  const name = formatSf2LearnerName(student);
  return !name || name === "—" ? "" : name;
}

function formatGradeAndSection(gradeLevel, section) {
  const digits = String(gradeLevel ?? "").replace(/\D/g, "");
  const sec = String(section ?? "").trim().toUpperCase();
  if (digits && sec) return `${digits} - ${sec}`;
  return digits || sec;
}

function toOfficialWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return n / 100;
  return n;
}

function isFormulaCell(cell) {
  return (
    cell.type === ExcelJS.ValueType.Formula ||
    (typeof cell.value === "object" &&
      cell.value !== null &&
      ("formula" in cell.value || "sharedFormula" in cell.value))
  );
}

function setPlainValue(cell, value) {
  if (isFormulaCell(cell)) return;
  if (value === "" || value === null || value === undefined) {
    cell.value = null;
    return;
  }
  cell.value = value;
}

function rosterRows(startRow, capacity) {
  return Array.from({ length: capacity }, (_, i) => startRow + i);
}

function fillInputData(sheet, { classItem, students }) {
  const school = settingsData.school;

  setPlainValue(sheet.getCell(OFFICIAL_INPUT.schoolName), school.schoolName);
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.schoolYear),
    formatOfficialSchoolYear(
      classItem?.schoolYear || school.schoolYear
    )
  );
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.teacher),
    classItem?.teacherName ?? ""
  );
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.gradeAndSection),
    formatGradeAndSection(classItem?.gradeLevel, classItem?.section)
  );
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.subject),
    String(classItem?.subject ?? "").trim().toUpperCase()
  );

  const { male, female } = partitionStudentsBySex(students);
  const maleRows = rosterRows(
    OFFICIAL_INPUT.maleStartRow,
    OFFICIAL_INPUT.maleCapacity
  );
  const femaleRows = rosterRows(
    OFFICIAL_INPUT.femaleStartRow,
    OFFICIAL_INPUT.femaleCapacity
  );

  for (const row of [...maleRows, ...femaleRows]) {
    setPlainValue(sheet.getCell(`${OFFICIAL_INPUT.nameCol}${row}`), null);
    sheet.getCell(`F${row}`).value = null;
  }
  sheet.getCell("F11").value = "LRN";
  sheet.getCell("F62").value = "LRN";

  male.slice(0, OFFICIAL_INPUT.maleCapacity).forEach((student, index) => {
    const row = OFFICIAL_INPUT.maleStartRow + index;
    setPlainValue(
      sheet.getCell(`${OFFICIAL_INPUT.nameCol}${row}`),
      formatOfficialLearnerName(student)
    );
    sheet.getCell(`F${row}`).value = student.studentNumber || student.student_number || null;
    sheet.getCell(`F${row}`).numFmt = "@";
  });

  female.slice(0, OFFICIAL_INPUT.femaleCapacity).forEach((student, index) => {
    const row = OFFICIAL_INPUT.femaleStartRow + index;
    setPlainValue(
      sheet.getCell(`${OFFICIAL_INPUT.nameCol}${row}`),
      formatOfficialLearnerName(student)
    );
    sheet.getCell(`F${row}`).value = student.studentNumber || student.student_number || null;
    sheet.getCell(`F${row}`).numFmt = "@";
  });
}

function fillHpsRow(sheet, config = []) {
  const byComponent = Object.fromEntries(
    ECR_COMPONENTS.map((component) => [
      component,
      config.filter((row) => row.component === component),
    ])
  );

  const writeHps = (cols, rows) => {
    cols.forEach((col, index) => {
      const cfg = rows[index];
      const cell = sheet.getCell(`${col}${OFFICIAL_TERM.hpsRow}`);
      if (isFormulaCell(cell)) return;
      if (!cfg) {
        cell.value = null;
        return;
      }
      const n = Number(cfg.highest_possible_score);
      cell.value = Number.isFinite(n) ? n : null;
    });
  };

  writeHps(OFFICIAL_TERM.hpsWwCols, byComponent.WW);
  writeHps(OFFICIAL_TERM.hpsPtCols, byComponent.PT);
  writeHps(OFFICIAL_TERM.hpsQaCols, byComponent.QA);
  for (const [component, column] of [["WW", "K"], ["PT", "Q"], ["QA", "W"]]) {
    const cell = sheet.getCell(`${column}${OFFICIAL_TERM.hpsRow}`);
    const total = byComponent[component].reduce((sum, row) => sum + Number(row.highest_possible_score || 0), 0);
    if (isFormulaCell(cell)) cell.value = { formula: cell.formula, result: total || "" };
  }

  const weights = {
    ww: toOfficialWeight(byComponent.WW[0]?.component_weight),
    pt: toOfficialWeight(byComponent.PT[0]?.component_weight),
    qa: toOfficialWeight(byComponent.QA[0]?.component_weight),
  };
  if (weights.ww != null) {
    setPlainValue(sheet.getCell(OFFICIAL_TERM.weightCells.ww), weights.ww);
  }
  if (weights.pt != null) {
    setPlainValue(sheet.getCell(OFFICIAL_TERM.weightCells.pt), weights.pt);
  }
  if (weights.qa != null) {
    setPlainValue(sheet.getCell(OFFICIAL_TERM.weightCells.qa), weights.qa);
  }
}

function restoreNameFormulas(sheet, input) {
  for (const row of [...officialMaleDataRows(), ...officialFemaleDataRows()]) {
    sheet.getCell(`${OFFICIAL_TERM.nameCol}${row}`).value = {
      formula: `INPUT!B${row}`,
      result: input.getCell(`B${row}`).value || "",
    };
  }
}

function clearTermScoreRows(sheet) {
  const scoreCols = officialScoreColumns();
  const rows = [...officialMaleDataRows(), ...officialFemaleDataRows()];

  for (const row of rows) {
    for (const col of scoreCols) {
      const cell = sheet.getCell(`${col}${row}`);
      if (!isFormulaCell(cell)) cell.value = null;
    }
  }
}

function fillTermScores(sheet, { male, female, studentScores, config }) {
  const colMap = {
    WW: OFFICIAL_TERM.wwCols,
    PT: OFFICIAL_TERM.ptCols,
    QA: OFFICIAL_TERM.qaCols,
  };

  function fillBlock(students, dataStartRow, capacity) {
    students.slice(0, capacity).forEach((student, index) => {
      const row = dataStartRow + index;
      const scores = studentScores[student.id] ?? {};

      for (const component of ECR_COMPONENTS) {
        const cols = colMap[component];
        const configRows = config.filter((entry) => entry.component === component);
        cols.forEach((col, itemIndex) => {
          const cfg = configRows[itemIndex];
          if (!cfg) return;
          const key = scoreKey(cfg.component, cfg.item_index);
          const raw = scores[key];
          const cell = sheet.getCell(`${col}${row}`);
          if (isFormulaCell(cell)) return;
          if (raw === "" || raw === null || raw === undefined) {
            cell.value = null;
            return;
          }
          const num = Number(raw);
          cell.value = Number.isFinite(num) ? num : raw;
        });
      }
    });
  }

  fillBlock(male, OFFICIAL_TERM.maleDataStartRow, OFFICIAL_TERM.maleCapacity);
  fillBlock(female, OFFICIAL_TERM.femaleDataStartRow, OFFICIAL_TERM.femaleCapacity);
}

function fillTermSheet(workbook, termNumber, { students, config, studentScores, computedByStudent = {} }) {
  const sheet = workbook.getWorksheet(OFFICIAL_ECR_SHEETS.term(termNumber));
  if (!sheet) return;

  const { male, female } = partitionStudentsBySex(students);
  restoreNameFormulas(sheet, workbook.getWorksheet(OFFICIAL_ECR_SHEETS.input));
  fillHpsRow(sheet, config);
  clearTermScoreRows(sheet);
  fillTermScores(sheet, { male, female, studentScores, config });
  const fields = { K: "ww_total", L: "ww_ps", M: "ww_ws", Q: "pt_total", R: "pt_ps", S: "pt_ws",
    W: "qa_total", X: "qa_ps", Y: "qa_ws", Z: "initial_grade", AA: "term_grade", AB: "description" };
  for (const [roster, start, capacity] of [[male, 12, 50], [female, 63, 50]]) {
    for (let index = 0; index < capacity; index++) {
      const student = roster[index];
      const result = computedByStudent[student?.id] || {};
      const row = start + index;
      for (const [column, field] of Object.entries(fields)) {
        const cell = sheet.getCell(`${column}${row}`);
        const value = student ? result[field] ?? "" : "";
        if (field === "term_grade" && value !== "" && result.gradeSource !== "assessment_scores") {
          cell.value = value;
          cell.note = result.gradeOnly ? "Recorded term grade. Detailed WW/PT/examination scores are unavailable; no item scores were inferred." : "Authentic saved term grade; retained independently of the assessment formulas.";
        } else if (result.gradeOnly && value !== "" && field !== "description") {
          // Stored aggregate measurements, when present, are authentic values too.
          cell.value = value;
        } else if (isFormulaCell(cell)) {
          const formula = cell.formula;
          cell.value = { formula, result: value };
        } else cell.value = value === "" ? null : value;
      }
      // Never let Excel turn partial scores into a final grade on recalculation.
      const visible = config.flatMap((entry) => {
        const columns = { WW: OFFICIAL_TERM.wwCols, PT: OFFICIAL_TERM.ptCols, QA: OFFICIAL_TERM.qaCols }[entry.component] || [];
        const group = config.filter((item) => item.component === entry.component);
        const column = columns[group.indexOf(entry)];
        return column ? [`${column}${row}`] : [];
      });
      if (visible.length && isFormulaCell(sheet.getCell(`Z${row}`))) {
        sheet.getCell(`Z${row}`).value = { formula: `IF(COUNT(${visible.join(",")})<${config.length},"",ROUND(SUM(M${row},S${row},Y${row}),2))`, result: result.initial_grade ?? "" };
      }
      for (const column of ["AA", "AB"]) {
        const cell = sheet.getCell(`${column}${row}`);
        const prerequisite = column === "AA" ? "Z" : "AA";
        if (isFormulaCell(cell)) cell.value = { formula: `IF(COUNT(${prerequisite}${row})=0,"",${cell.formula})`, result: result[fields[column]] ?? "" };
      }
      for (const [component, columns, outputColumns] of [["WW", OFFICIAL_TERM.wwCols, ["L", "M"]], ["PT", OFFICIAL_TERM.ptCols, ["R", "S"]], ["QA", OFFICIAL_TERM.qaCols, ["X", "Y"]]]) {
        const count = config.filter((entry) => entry.component === component).length;
        if (!count) continue;
        for (const column of outputColumns) {
          const cell = sheet.getCell(`${column}${row}`);
          if (isFormulaCell(cell)) cell.value = { formula: `IF(COUNT(${columns.slice(0, count).map((col) => `${col}${row}`).join(",")})<${count},"",${cell.formula})`, result: result[fields[column]] ?? "" };
        }
      }
    }
  }
}

function clearTemplateFormulaCaches(workbook) {
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => {
    if (cell.isMerged && cell.master.address !== cell.address) return;
    if (isFormulaCell(cell)) cell.value = { formula: cell.formula, result: "" };
  }));
}

function fillSummary(workbook, students, termData) {
  const sheet = workbook.getWorksheet(OFFICIAL_ECR_SHEETS.summary);
  if (!sheet) return;
  const input = workbook.getWorksheet(OFFICIAL_ECR_SHEETS.input);
  const { male, female } = partitionStudentsBySex(students);
  for (const [roster, start] of [[male, 12], [female, 63]]) for (let index = 0; index < 50; index++) {
    const student = roster[index];
    const inputRow = start + index;
    const row = inputRow + 1;
    sheet.getCell(`B${row}`).value = { formula: `INPUT!B${inputRow}`, result: student ? formatOfficialLearnerName(student) : "" };
    const grades = [1, 2, 3].map((term) => student ? parseValidGrade(termData[term]?.computedByStudent?.[student.id]?.term_grade) : null);
    for (const [index, column] of ["F", "J", "N"].entries()) sheet.getCell(`${column}${row}`).value = {
      formula: `TERM${index + 1}!AA${inputRow}`, result: grades[index] ?? "",
    };
    const official = (termData[4]?.officialGrades || []).filter((entry) => entry.student_id === student?.id).map((entry) => parseValidGrade(entry.final_grade)).filter((grade) => grade !== null);
    const savedFinal = official.length && new Set(official).size === 1 ? official[0] : null;
    const final = savedFinal ?? (grades.every((grade) => grade !== null) ? computeFinalFromTerms(grades) : null);
    const cell = sheet.getCell(`R${row}`);
    cell.value = savedFinal !== null ? savedFinal : { formula: `IF(COUNT(F${row},J${row},N${row})<3,"",ROUND(AVERAGE(F${row},J${row},N${row}),2))`, result: final ?? "" };
    for (const column of ["V", "Z"]) {
      const output = sheet.getCell(`${column}${row}`);
      output.value = { formula: `IF(COUNT(R${row})=0,"",${output.formula || '""'})`, result: final === null ? "" : column === "Z" ? final >= 75 ? "PASSED" : "FAILED" : termGradeDescription(final) };
    }
  }
  // Header links and roster links have actual cached display values in non-calculating viewers.
  for (const worksheet of workbook.worksheets) worksheet.eachRow((row) => row.eachCell((cell) => {
    if (cell.isMerged && cell.master.address !== cell.address) return;
    const reference = cell.formula?.match(/^INPUT!([A-Z]+\d+)$/);
    if (reference) cell.value = { formula: cell.formula, result: input.getCell(reference[1]).value ?? "" };
  }));
}

function addSourceSheets(workbook, students, classItem, terms) {
  const learners = new Map(students.map((student) => [student.id, student]));
  const records = workbook.addWorksheet("GRADE RECORDS");
  records.addRow(["LRN", "Learner", "Subject", "School Year", "Term", "ECR Status", "Term Grade", "Actual Item Scores", "Grade Source", "Availability"]);
  for (const term of [1, 2, 3, 4]) for (const student of students) {
    const data = terms[term] || {};
    const computed = data.computedByStudent?.[student.id] || {};
    records.addRow([student.studentNumber || student.student_number || "", formatOfficialLearnerName(student), classItem?.subject || "", classItem?.schoolYear || "",
      term === 4 ? "Final / AVE" : `Term ${term}`, data.status || "No ECR sheet", parseValidGrade(computed.term_grade), computed.rawScoreCount || 0,
      computed.gradeSource || "unavailable", computed.gradeOnly ? "Recorded grade only; detailed assessments unavailable" : computed.rawScoreCount ? "Actual saved assessment scores" : "No assessment scores recorded"]);
  }
  const scores = workbook.addWorksheet("ASSESSMENT RECORDS");
  scores.addRow(["LRN", "Learner", "Student ID", "Class ID", "Term", "ECR Status", "Component", "Item", "HPS", "Actual Score", "Source Sheet ID"]);
  const grades = workbook.addWorksheet("SAVED GRADE SOURCES");
  grades.addRow(["LRN", "Learner", "Student ID", "Class ID", "Term", "Source", "Status", "Recorded Grade", "Initial Grade", "WW PS", "PT PS", "Exam PS", "Source Sheet ID"]);
  for (const term of [1, 2, 3, 4]) {
    const data = terms[term] || {};
    for (const source of data.officialGrades || []) {
      const student = learners.get(source.student_id) || {};
      grades.addRow([student.studentNumber || student.student_number || "", formatOfficialLearnerName(student), source.student_id, source.class_id,
        `Term ${term}`, "Recorded subject grade", "Existing record", source.final_grade, null, null, null, null, null]);
    }
    for (const block of data.sourceBlocks || []) {
      for (const source of block.scores || []) {
        if (source.raw_score == null) continue;
        const student = learners.get(source.student_id) || {};
        const config = block.config.find((entry) => entry.component === source.component && Number(entry.item_index) === Number(source.item_index));
        scores.addRow([student.studentNumber || student.student_number || "", formatOfficialLearnerName(student), source.student_id, block.classId,
          `Term ${term}`, block.termSheet.status, source.component, source.item_index, config?.highest_possible_score ?? null, source.raw_score, block.termSheet.id]);
      }
      for (const source of block.computed || []) {
        const student = learners.get(source.student_id) || {};
        grades.addRow([student.studentNumber || student.student_number || "", formatOfficialLearnerName(student), source.student_id, block.classId,
          `Term ${term}`, "Saved ECR grade", block.termSheet.status, source.term_grade, source.initial_grade, source.ww_ps, source.pt_ps, source.qa_ps, block.termSheet.id]);
      }
    }
  }
  for (const sheet of [records, scores, grades]) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((column) => { column.width = 22; });
    sheet.getColumn(1).numFmt = "@";
  }
}

function buildFilename(classItem) {
  const gradeDigits = String(classItem?.gradeLevel ?? "").replace(/\D/g, "");
  const grade = gradeDigits ? `GRADE${gradeDigits}` : "GRADE";
  const section = String(classItem?.section ?? "SECTION")
    .toUpperCase()
    .replace(/[\s\-–—]/g, "");
  const year = normalizeSchoolYear(classItem?.schoolYear).replace(/\s+/g, "");
  const sy = year ? `SY${year}` : "SY";
  const raw = `${grade}_${section}_${sy}`;
  const safe = raw.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/_+/g, "_");
  return `${safe || "EXPORT"}.xlsx`;
}

/**
 * Export official DepEd ECR from the GRADE7_SCIENCE layout.
 * Fills authentic raw scores and saved grades; preserves formulas with current caches.
 */
export async function buildEcrWorkbook({
  classItem,
  term,
  students = [],
  config = [],
  studentScores = {},
  computedByStudent = {},
  termDataByTerm = {},
  templateBuffer = null,
} = {}) {
  if (!templateBuffer) {
    const response = await fetch(OFFICIAL_ECR_TEMPLATE_URL);
    if (!response.ok) throw new Error("Unable to load the official E-Class Record template.");
    templateBuffer = await response.arrayBuffer();
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  clearTemplateFormulaCaches(workbook);
  workbook.calcProperties.fullCalcOnLoad = true;

  const inputSheet = workbook.getWorksheet(OFFICIAL_ECR_SHEETS.input);
  if (inputSheet) {
    fillInputData(inputSheet, { classItem, students });
  }

  const mergedTerms = { ...termDataByTerm };
  if (term && term !== "summary" && !mergedTerms[term]) {
    mergedTerms[term] = {
      config,
      studentScores,
      computedByStudent,
    };
  }

  for (const termNumber of [1, 2, 3]) {
    const data = mergedTerms[termNumber];
    fillTermSheet(workbook, termNumber, {
      students,
      config: data?.config?.length ? data.config : config,
      studentScores: data?.studentScores ?? {},
      computedByStudent: data?.computedByStudent ?? {},
    });
  }

  fillSummary(workbook, students, mergedTerms);
  addSourceSheets(workbook, students, classItem, mergedTerms);
  return workbook;
}

export async function exportEcrTermExcel(payload = {}) {
  const workbook = await buildEcrWorkbook(payload);
  await downloadWorkbook(workbook, buildFilename(payload.classItem));
}
