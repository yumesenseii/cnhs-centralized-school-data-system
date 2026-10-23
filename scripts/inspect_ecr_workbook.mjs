import { readFile } from "node:fs/promises";
import { parseEClassRecordBuffer } from "../lib/eclass/parseEClassCore.js";
import { readWorkbookSheetNames } from "../lib/eclass/xlsxRead.js";

const path = process.argv[2];
if (!path) throw new Error("Pass the local ECR workbook path.");
const buffer = await readFile(path);
console.log(JSON.stringify({ worksheets: readWorkbookSheetNames(buffer) }));
for (const term of [1, 2, 3]) {
  const parsed = parseEClassRecordBuffer(buffer, { includeGrades: true, quarter: term });
  const learners = parsed.learners || [];
  const counts = { term, learners: learners.length, termGrades: 0, withAssessmentItems: 0, itemScores: 0, componentItems: {}, lrnsPresent: 0 };
  for (const learner of learners) {
    if (learner.term_grades?.[term] != null) counts.termGrades++;
    if (learner.student_number && !learner.lrn_is_generated) counts.lrnsPresent++;
    const scores = learner.component_scores?.[term] || {};
    const entries = Object.entries(scores).filter(([, value]) => value != null && String(value).trim() !== "");
    if (entries.length) counts.withAssessmentItems++;
    counts.itemScores += entries.length;
    for (const [key] of entries) { const component = key.split(":")[0]; counts.componentItems[component] = (counts.componentItems[component] || 0) + 1; }
  }
  console.log(JSON.stringify({ ok: parsed.ok, metadata: { grade: parsed.metadata?.grade_level, section: parsed.metadata?.section,
    subject: parsed.metadata?.subject, schoolYear: parsed.metadata?.school_year }, counts }));
}
