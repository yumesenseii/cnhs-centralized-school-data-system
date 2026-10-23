import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { fixture, resetEcrFixture } from "./test-support/ecr-fixture.mjs";
import { loadEcrClassFamily, loadEcrTermSheet, saveEcrTermSheet, syncEcrFromImport, syncEcrTermToGrades, syncEcrAveToGrades } from "../lib/supabase/queries/ecr.js";
import { buildEcrTermView } from "../lib/ecr/recordData.js";
import { readImportTermGrade } from "../lib/eclass/importIntegrity.js";
import { parseEClassRecordBuffer } from "../lib/eclass/parseEClassCore.js";
import { validateEClassRoster } from "../lib/eclass/validateEClassRoster.js";
import { buildEcrWorkbook } from "../lib/ecr/exportTermSheet.js";
import { officialScoreColumns } from "../lib/ecr/officialEcrTemplateMap.js";

const family = () => loadEcrClassFamily({ classId: "class-1", teacherId: "teacher-1" });
const classItem = { id: "class-1", subjectId: "science", subject: "Science", sectionId: "ponce", section: "Ponce", schoolYear: "2026-2027", gradeLevel: "10", teacherId: "teacher-1", teacherName: "Fixture Teacher", quarter: 1 };
const view = (source, term) => buildEcrTermView({ students: fixture.tables.students, config: source.termData[term]?.config,
  scoreRows: source.termData[term]?.scores, computedRows: source.termData[term]?.computed,
  officialGrades: source.officialGrades.filter((row) => row.quarter === term), status: source.termData[term]?.termSheet.status });
const writes = () => fixture.calls.filter((call) => call.operation !== "select");
const config = () => fixture.tables.ecr_component_config.filter((row) => row.term_sheet_id === "book-1-term-1");
const save = (studentScores, extra = {}) => saveEcrTermSheet({ termSheetId: "book-1-term-1", config: config(), studentScores,
  classMeta: { subjectId: "science" }, siblingClassMap: { 1: "class-1", 2: "class-2", 3: "class-3", 4: "class-4" }, ...extra });
const fullScores = () => Object.fromEntries(config().map((row) => [`${row.component}:${row.item_index}`, row.highest_possible_score]));

test("reads sibling Term 2 records, separates final grades from raw-score counts, and never writes on read", async () => {
  resetEcrFixture();
  const result = await family(); assert.ifError(result.error);
  assert.equal(result.data.termData[2].classId, "class-2");
  for (const term of [1,2]) {
    const data = view(result.data, term);
    assert.equal(data.availability.withAssessments, 0);
    assert.equal(data.availability.withTermGrades, 40);
    assert.equal(data.availability.total, 41);
    assert.equal(data.computedByStudent["student-1"].term_grade, term === 1 ? 85 : 88);
    assert.equal(data.computedByStudent["student-41"].term_grade, null);
    assert.equal(data.computedByStudent["student-1"].gradeOnly, true);
  }
  assert.deepEqual(writes(), []);
  fixture.tables.ecr_computed_grades = [];
  const officialOnly = await family(); assert.ifError(officialOnly.error);
  assert.equal(view(officialOnly.data, 2).computedByStudent["student-1"].gradeSource, "recorded_subject_grade");
});

test("filters class/subject/year/teacher and keeps competing sheets intact", async () => {
  resetEcrFixture();
  const outsider = { ...fixture.tables.classes[0], id: "other", subject_id: "math" };
  fixture.tables.classes.push(outsider);
  fixture.tables.grades.push({ ...fixture.tables.grades[0], id: "other-grade", class_id: "other", subject_id: "math", final_grade: 99 });
  fixture.tables.classes[1].school_year = "SY 2026-2027";
  fixture.tables.ecr_computed_grades.push({ id: "conflict", term_sheet_id: "book-1-term-2", student_id: "student-1", term_grade: 91 });
  const result = await family(); assert.ifError(result.error);
  assert.equal(result.data.classes.length, 4);
  assert.equal(result.data.officialGrades.length, 80);
  assert.equal(result.data.termSheets.find((row) => row.term === 2).readConflict, true);
  assert.equal(result.data.blocks.filter((block) => block.termSheet.term === 2).length, 2);
  assert.deepEqual(writes(), []);
  fixture.tables.classes[0].teacher_id = "other-teacher";
  assert.match((await family()).error.message, /not assigned/);
  resetEcrFixture(); fixture.signedIn = false;
  assert.ok((await family()).error);
});

test("reads beyond the Supabase 1000-row page", async () => {
  resetEcrFixture({ size: 110, graded: 110 });
  fixture.tables.ecr_component_scores = fixture.tables.students.flatMap((student) => config().map((row) => ({
    id: `${student.id}-${row.id}`, student_id: student.id, term_sheet_id: "book-1-term-1", component: row.component, item_index: row.item_index, raw_score: 1,
  })));
  const result = await loadEcrTermSheet("book-1-term-1"); assert.ifError(result.error);
  assert.equal(result.data.scores.length, 1210);
});

test("saves partial evidence without overwriting final grades; validates before mutation; blank preserves existing score", async () => {
  resetEcrFixture(); const grades = structuredClone(fixture.tables.grades); const computed = structuredClone(fixture.tables.ecr_computed_grades);
  assert.ifError((await save({ "student-1": { "WW:1": "20" } })).error);
  assert.deepEqual(fixture.tables.grades, grades);
  assert.deepEqual(fixture.tables.ecr_computed_grades, computed);
  assert.equal(fixture.tables.ecr_component_scores[0].raw_score, 20);
  assert.ifError((await save({ "student-1": { "WW:1": "", "PT:1": "18" } })).error);
  assert.equal(fixture.tables.ecr_component_scores.find((row) => row.component === "WW").raw_score, 20);
  const reloaded = await family(); assert.equal(view(reloaded.data, 1).studentScores["student-1"]["PT:1"], "18");
  assert.equal(view(reloaded.data, 2).studentScores["student-1"], undefined);
  fixture.calls = [];
  assert.match((await save({ "student-1": { "WW:1": 500 } })).error.message, /outside/);
  assert.deepEqual(writes(), []);
  assert.match((await save({ outsider: { "WW:1": 10 } })).error.message, /not enrolled/);
  assert.deepEqual(writes(), []);
});

test("publication stays explicit, requires complete roster/evidence, preserves published protection and rollback", async () => {
  resetEcrFixture({ size: 2, graded: 1 });
  assert.ok((await save({}, { publish: true })).error);
  assert.equal(fixture.tables.ecr_term_sheets[0].status, "draft");
  assert.ifError((await save({ "student-2": fullScores() })).error);
  assert.equal(fixture.tables.grades.filter((row) => row.quarter === 1).length, 1);
  assert.ifError((await save({}, { publish: true })).error);
  assert.equal(fixture.tables.ecr_term_sheets[0].status, "published");
  assert.equal(fixture.tables.grades.find((row) => row.student_id === "student-2" && row.quarter === 1).final_grade, 100);
  assert.ok((await save({ "student-1": { "WW:1": 1 } })).error);
  assert.ok((await syncEcrFromImport({ classItem, teacherId: "teacher-1", learners: [] })).error);
  resetEcrFixture({ size: 1, graded: 1 });
  assert.ifError((await save({ "student-1": { "WW:1": 20 } })).error);
  assert.ok((await syncEcrTermToGrades({ termSheetId: "book-1-term-1", subjectId: "science", requireCompleteRoster: true })).error);
  resetEcrFixture({ size: 1, graded: 1 });
  const before = structuredClone(fixture.tables.grades);
  fixture.fail = { table: "ecr_term_sheets", operation: "update" };
  assert.ok((await save({ "student-1": fullScores() }, { publish: true })).error);
  assert.deepEqual(fixture.tables.grades, before);
  assert.equal(fixture.tables.ecr_term_sheets[0].status, "draft");
});

test("saving unchanged authentic scores preserves the saved grade; only an actual correction recomputes it", async () => {
  resetEcrFixture({ size: 1, graded: 1 });
  const scores = fullScores();
  fixture.tables.ecr_component_scores = config().map((row) => ({ id: row.id, term_sheet_id: "book-1-term-1", student_id: "student-1",
    component: row.component, item_index: row.item_index, raw_score: row.highest_possible_score }));
  assert.ifError((await save({ "student-1": scores })).error);
  assert.equal(fixture.tables.ecr_computed_grades[0].term_grade, 85);
  assert.ifError((await save({ "student-1": { ...scores, "WW:1": 24 } })).error);
  assert.notEqual(fixture.tables.ecr_computed_grades[0].term_grade, 85);
  assert.equal(fixture.tables.grades[0].final_grade, 85);
});

test("imports keep partial score-only evidence and reject duplicates before changing HPS or records", async () => {
  resetEcrFixture({ size: 1, graded: 0 });
  const learner = { student_id: "student-1", term_grades: {}, component_scores: { 1: { "WW:2": 18 } } };
  assert.ifError((await syncEcrFromImport({ classItem, teacherId: "teacher-1", learners: [learner] })).error);
  assert.equal(fixture.tables.ecr_component_scores.length, 1);
  assert.equal(fixture.tables.ecr_computed_grades.length, 0);
  const snapshot = structuredClone(fixture.tables);
  fixture.calls = [];
  learner.component_layout = { 1: { hps: { WW: [50] } } };
  assert.ok((await syncEcrFromImport({ classItem, teacherId: "teacher-1", learners: [learner,learner] })).error);
  assert.deepEqual(fixture.tables, snapshot);
  assert.deepEqual(writes(), []);
  const wrongSection = { ...fixture.tables.classes[1], id: "wrong-section", section_id: "other" };
  fixture.tables.classes.push(wrongSection);
  const result = await save({}, { siblingClassMap: { 1: "wrong-section" } });
  assert.match(result.error.message, /same assigned/);
});

test("final publication uses all three real sibling sources and requires published terms", async () => {
  resetEcrFixture({ size: 1, graded: 1 });
  const args = { workbookId: "book-1", subjectId: "science", siblingClassMap: { 4: "class-4" }, termSheetIdsByTerm: { 1: "book-1-term-1", 2: "book-2-term-2", 3: "book-1-term-3" } };
  assert.ok((await syncEcrAveToGrades(args)).error);
  fixture.tables.ecr_term_sheets.forEach((row) => row.status = "published");
  fixture.tables.ecr_computed_grades.push({ id: "term3", term_sheet_id: "book-1-term-3", student_id: "student-1", term_grade: 90 });
  const result = await syncEcrAveToGrades(args); assert.ifError(result.error);
  assert.equal(fixture.tables.grades.find((row) => row.quarter === 4).final_grade, 87.67);
});

test("supplied PONCE workbook: authentic scores survive roster validation, import, reload, and Excel roundtrip", async () => {
  const buffer = await readFile(new URL("../docs/PONCE.xlsx", import.meta.url));
  const parsed = parseEClassRecordBuffer(buffer, { includeGrades: true, quarter: 1 }); assert.equal(parsed.ok, true);
  assert.equal(parsed.learners.length, 42);
  assert.equal(parsed.learners.filter((row) => row.term_grades?.[1] != null).length, 1);
  assert.equal(parsed.learners.filter((row) => !row.lrn_is_generated).length, 0);
  const learner = parsed.learners.find((row) => Object.keys(row.component_scores?.[1] || {}).length);
  const raw = learner.component_scores[1];
  assert.equal(Object.keys(raw).length, 10); assert.equal(raw["WW:1"], undefined);
  assert.equal(Object.keys(raw).filter((key) => key.startsWith("PT:")).length, 3);
  const term2 = parseEClassRecordBuffer(buffer, { includeGrades: true, quarter: 2 });
  assert.equal(term2.learners.filter((row) => row.term_grades?.[2] != null).length, 0);
  assert.equal(term2.learners.reduce((n,row) => n + Object.keys(row.component_scores?.[2] || {}).length, 0), 0);
  assert.equal(readImportTermGrade({ term_grades: { 1: 85 }, quarterly_grade: 85 }, 2), null);
  resetEcrFixture({ size: 1, graded: 0 });
  Object.assign(fixture.tables.students[0], { section_id: "ponce", last_name: "", first_name: learner.full_name });
  fixture.tables.sections = [{ id: "ponce", section_name: "Ponce", grade_level: "10", school_year: "2026-2027" }];
  const verified = await validateEClassRoster({ learners: [learner], classItem });
  const validated = verified.validatedLearners[0];
  assert.equal(validated.status, "NEEDS_VERIFICATION"); assert.equal(validated.included, false);
  assert.deepEqual(validated.component_scores[1], raw);
  assert.ok(validated.matchedStudent);
  const confirmed = { ...validated, included: true, student_id: validated.matchedStudent.id };
  const imported = await syncEcrFromImport({ classItem, teacherId: "teacher-1", learners: [confirmed] }); assert.ifError(imported.error);
  assert.equal(imported.counts.scoresWritten, 10);
  assert.equal(fixture.tables.ecr_computed_grades[0].term_grade, 85);
  assert.equal(fixture.tables.ecr_component_scores.length, 10);
  assert.equal(fixture.tables.grades.length, 0);
  assert.equal(fixture.tables.ecr_term_sheets[0].status, "draft");
  const reimported = await syncEcrFromImport({ classItem, teacherId: "teacher-1", learners: [confirmed] }); assert.ifError(reimported.error);
  assert.equal(fixture.tables.ecr_component_scores.length, 10);
  assert.equal(fixture.tables.ecr_computed_grades.length, 1);
  const source = (await family()).data;
  const terms = Object.fromEntries([1,2,3].map((term) => [term, { ...view(source,term), officialGrades: [], sourceBlocks: source.blocks.filter((row) => row.termSheet.term === term) }]));
  const workbook = await buildEcrWorkbook({ classItem, students: fixture.tables.students, config: config(), termDataByTerm: terms,
    templateBuffer: await readFile(new URL("../public/templates/official-ecr-template.xlsx", import.meta.url)) });
  const exported = await workbook.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook(); await read.xlsx.load(exported);
  assert.equal(read.getWorksheet("TERM1").getCell("AA12").value, 85);
  assert.equal(read.getWorksheet("TERM1").getCell("F12").value, null);
  for (const [key,value] of Object.entries(raw)) {
    const [component,index] = key.split(":");
    const col = { WW: ["F","G","H","I","J"], PT: ["N","O","P"], QA: ["T","U","V"] }[component][Number(index)-1];
    assert.equal(read.getWorksheet("TERM1").getCell(`${col}12`).value, value);
  }
  for (const col of officialScoreColumns()) assert.equal(read.getWorksheet("TERM2").getCell(`${col}12`).value, null);
  assert.equal(read.getWorksheet("TERM2").getCell("AA12").result, undefined);
  assert.equal(read.getWorksheet("ASSESSMENT RECORDS").rowCount, 11);
  assert.equal(read.getWorksheet("SUMMARY OF GRADES").getCell("F13").result, 85);
  const roundtrip = parseEClassRecordBuffer(exported, { includeGrades: true, quarter: 1 }); assert.equal(roundtrip.ok, true);
  assert.equal(roundtrip.learners.length, 1);
  assert.equal(roundtrip.learners[0].lrn_is_generated, false);
  assert.equal(roundtrip.learners[0].student_number, fixture.tables.students[0].student_number);
  assert.deepEqual(roundtrip.learners[0].component_scores[1], raw);
});

test("Excel exports authentic final-only Term 1/2 grades and status with zero invented item scores", async () => {
  resetEcrFixture({ size: 2, graded: 1 });
  fixture.tables.ecr_term_sheets.find((row) => row.id === "book-2-term-2").status = "published";
  const source = (await family()).data;
  const terms = Object.fromEntries([1,2,3].map((term) => [term, { ...view(source,term), officialGrades: source.officialGrades.filter((row) => row.quarter === term),
    sourceBlocks: source.blocks.filter((row) => row.termSheet.term === term) }]));
  const wb = await buildEcrWorkbook({ classItem, students: fixture.tables.students, config: config(), termDataByTerm: terms,
    templateBuffer: await readFile(new URL("../public/templates/official-ecr-template.xlsx", import.meta.url)) });
  assert.equal(wb.getWorksheet("TERM1").getCell("AA12").value, 85);
  assert.equal(wb.getWorksheet("TERM2").getCell("AA12").value, 88);
  for (const term of [1,2,3]) for (const col of officialScoreColumns()) assert.equal(wb.getWorksheet(`TERM${term}`).getCell(`${col}12`).value, null);
  assert.equal(wb.getWorksheet("ASSESSMENT RECORDS").rowCount, 1);
  assert.equal(wb.getWorksheet("SAVED GRADE SOURCES").rowCount, 5);
  assert.equal(wb.getWorksheet("SUMMARY OF GRADES").getCell("R13").result, "");
  assert.match(wb.getWorksheet("SUMMARY OF GRADES").getCell("R13").formula, /COUNT\(F13,J13,N13\)<3/);
  assert.equal(wb.getWorksheet("TERM1").getCell("B12").result, "Fixture, Learner1");
});
