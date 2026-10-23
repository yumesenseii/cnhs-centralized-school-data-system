import { getEcrTemplateForSubject } from "../../lib/ecr/constants.js";
import { partitionGradeWrites } from "../../lib/ecr/gradeIntegrity.js";

export let fixture;
export function resetEcrFixture({ size = 41, graded = 40 } = {}) {
  const classes = [1, 2, 3, 4].map((quarter) => ({ id: `class-${quarter}`, quarter, subject_id: "science", section_id: "ponce", teacher_id: "teacher-1", school_year: "2026-2027" }));
  const students = Array.from({ length: size }, (_, index) => ({ id: `student-${index + 1}`, student_number: String(100000000001 + index),
    first_name: `Learner${index + 1}`, last_name: "Fixture", sex: index % 2 ? "Female" : "Male", status: "Active" }));
  const books = [1, 2].map((term) => ({ id: `book-${term}`, class_id: `class-${term}`, teacher_id: "teacher-1", school_year: "2026-2027", source: "import", status: "draft" }));
  const sheets = books.flatMap((book) => [1, 2, 3].map((term) => ({ id: `${book.id}-term-${term}`, workbook_id: book.id, term, status: "draft" })));
  const config = sheets.flatMap((sheet) => getEcrTemplateForSubject("Science").map((row, index) => ({ ...row, id: `${sheet.id}-${index}`, term_sheet_id: sheet.id, sort_order: index })));
  const computed = [1, 2].flatMap((term) => students.slice(0, graded).map((student) => ({ id: `computed-${term}-${student.id}`, term_sheet_id: `book-${term}-term-${term}`,
    student_id: student.id, term_grade: term === 1 ? 85 : 88, description: "Very Satisfactory" })));
  const grades = [1, 2].flatMap((term) => students.slice(0, graded).map((student) => ({ id: `official-${term}-${student.id}`, class_id: `class-${term}`, subject_id: "science",
    student_id: student.id, quarter: term, school_year: "2026-2027", final_grade: term === 1 ? 85 : 88 })));
  fixture = { signedIn: true, calls: [], fail: null, serial: 0, tables: {
    classes, students, ecr_workbooks: books, ecr_term_sheets: sheets, ecr_component_config: config, ecr_component_scores: [], ecr_computed_grades: computed, grades,
    class_students: classes.flatMap((row) => students.map((student) => ({ id: `enroll-${row.id}-${student.id}`, class_id: row.id, student_id: student.id }))),
  } };
  return fixture;
}
resetEcrFixture();
const clone = (value) => structuredClone(value);
function enrich(table, row) {
  if (table === "ecr_workbooks") return { ...row, ecr_term_sheets: fixture.tables.ecr_term_sheets.filter((sheet) => sheet.workbook_id === row.id).map((sheet) => ({ ...sheet })) };
  if (table === "ecr_term_sheets") return { ...row, ecr_workbooks: fixture.tables.ecr_workbooks.find((book) => book.id === row.workbook_id) };
  return row;
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.operation = "select"; }
  select() { return this; }
  eq(key, value) { this.filters.push((row) => row[key] === value); return this; }
  in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
  match(values) { Object.entries(values).forEach(([key,value]) => this.eq(key,value)); return this; }
  order(key, { ascending = true } = {}) { this.orderBy ||= []; this.orderBy.push([key, ascending]); return this; }
  range(first, last) { this.bounds = [first, last + 1]; return this; }
  limit(max) { this.bounds = [0, max]; return this; }
  insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
  upsert(payload, options) { this.operation = "upsert"; this.payload = payload; this.options = options; return this; }
  update(payload) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async single() { const result = await this.execute(); return { ...result, data: result.data?.[0] || null }; }
  maybeSingle() { return this.single(); }
  async execute() {
    fixture.calls.push({ table: this.table, operation: this.operation, payload: clone(this.payload), options: this.options });
    if (!fixture.signedIn) return { data: null, error: new Error("Not authenticated") };
    if (fixture.fail?.table === this.table && fixture.fail.operation === this.operation) return { data: null, error: new Error("Injected storage failure") };
    const table = fixture.tables[this.table] ||= [];
    let rows = table.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === "update") rows.forEach((row) => Object.assign(row, clone(this.payload)));
    if (this.operation === "insert" || this.operation === "upsert") {
      rows = [];
      for (const input of Array.isArray(this.payload) ? this.payload : [this.payload]) {
        const keys = this.options?.onConflict?.split(",") || [];
        let row = keys.length ? table.find((candidate) => keys.every((key) => candidate[key] === input[key])) : null;
        if (!row) { row = { id: `new-${++fixture.serial}` }; table.push(row); }
        Object.assign(row, clone(input)); rows.push(row);
      }
    }
    if (this.operation === "delete") { fixture.tables[this.table] = table.filter((row) => !rows.includes(row)); }
    if (this.orderBy) rows = [...rows].sort((a,b) => { for (const [key,ascending] of this.orderBy) { const n = String(a[key]).localeCompare(String(b[key]), "en", { numeric: true }); if(n) return ascending ? n : -n; } return 0; });
    if (this.bounds) rows = rows.slice(...this.bounds);
    return { data: clone(rows.map((row) => enrich(this.table, row))), error: null };
  }
}
const client = { from: (table) => new Query(table), auth: { getSession: async () => ({ data: {} }) } };
export function createClient() { return client; }
export async function getCurrentTeacherSession() { return fixture.signedIn ? { data: { teacherId: "teacher-1", profile: { full_name: "Fixture Teacher" } }, error: null } : { data: null, error: new Error("Not authenticated") }; }
export async function getClassById(id) {
  const row = fixture.tables.classes.find((row) => row.id === id);
  return { data: row ? { ...row, subjects: { subject_name: "Science" }, sections: { grade_level: "10", section_name: "Ponce" }, teachers: { first_name: "Fixture", last_name: "Teacher" } } : null, error: null };
}
export async function getClassStudents(classId) { return { data: fixture.tables.class_students.filter((row) => row.class_id === classId).map((row) => ({ ...row, students: fixture.tables.students.find((student) => student.id === row.student_id) })), error: null }; }
export async function getTeacherClasses() { return { data: clone(fixture.tables.classes), error: null }; }
export async function upsertGrades(rows) {
  const valid = partitionGradeWrites(rows);
  if (valid.duplicates.length || valid.skipped.length) return { error: new Error("Invalid grade write") };
  const snapshot = clone(fixture.tables.grades);
  const result = await client.from("grades").upsert(valid.writable, { onConflict: "student_id,class_id,subject_id,quarter,school_year" });
  return { ...result, count: rows.length, snapshot };
}
export async function restoreGradeSnapshot(snapshot) { fixture.tables.grades = clone(snapshot); return { error: null }; }
