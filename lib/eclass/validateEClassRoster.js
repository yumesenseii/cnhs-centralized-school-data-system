import { createClient } from "@/lib/supabase/client";
import {
  normalizeKey,
  normalizePersonName,
  normalizeText,
} from "@/lib/eclass/normalize";
import { splitLearnerName } from "@/lib/teacher/myClassesMappers";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import { parseTermNumber } from "@/lib/academic/termLabels";

/**
 * Validate incoming E-Record learners against the official centralized section roster.
 *
 * Categories:
 * - MATCHED: Learner exists in the official section roster (section_id matches).
 * - NEEDS_VERIFICATION: Partial match (e.g., LRN matched but name differs, or name matches official roster but LRN differs).
 * - WRONG_SECTION: Learner exists in CNHS Learn, but belongs to another official section.
 * - UNMATCHED: No student record found in the centralized database.
 * - DUPLICATE: Learner matches section, but a grade record already exists for this subject, term, and school year.
 */
export async function validateEClassRoster({
  learners = [],
  classItem,
  quarter = null,
}) {
  const supabase = createClient();
  const sectionId = classItem.sectionId ?? classItem.section_id ?? null;
  const classId = classItem.id;
  const targetQuarter =
    quarter ??
    parseTermNumber(classItem.quarter) ??
    parseTermNumber(classItem.currentQuarter) ??
    1;
  const schoolYear = classItem.schoolYear ?? classItem.school_year ?? null;

  if (!sectionId) {
    throw new Error("Target class is missing an assigned section.");
  }

  // 1. Fetch official section details and adviser
  const { data: sectionData, error: sectionErr } = await supabase
    .from("sections")
    .select(`
      id,
      section_name,
      grade_level,
      school_year,
      adviser_id,
      adviser:teachers!adviser_id (
        id,
        first_name,
        middle_name,
        last_name
      )
    `)
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionErr) throw sectionErr;

  // 2. Fetch all learners currently enrolled in this official section
  const { data: officialStudents, error: officialErr } = await supabase
    .from("students")
    .select("id, student_number, first_name, middle_name, last_name, sex, section_id")
    .eq("section_id", sectionId);

  if (officialErr) throw officialErr;

  // Build lookup maps for official section learners
  const officialByLrn = new Map();
  const officialByName = new Map();

  for (const s of officialStudents ?? []) {
    const lrn = String(s.student_number ?? "").trim();
    if (lrn) officialByLrn.set(lrn, s);

    const nameKey = normalizePersonName(
      `${s.last_name || ""}, ${s.first_name || ""} ${s.middle_name || ""}`
    );
    if (nameKey) officialByName.set(nameKey, s);
  }

  // 3. Query all students across the entire school matching any LRN from the uploaded file
  const uploadedLrns = [
    ...new Set(
      learners
        .map((l) => String(l.student_number ?? "").trim())
        .filter(Boolean)
    ),
  ];

  let globalStudents = [];
  if (uploadedLrns.length > 0) {
    // Chunk queries to avoid URL length issues
    const chunkSize = 80;
    for (let i = 0; i < uploadedLrns.length; i += chunkSize) {
      const chunk = uploadedLrns.slice(i, i + chunkSize);
      const { data: chunkData, error: chunkErr } = await supabase
        .from("students")
        .select(`
          id,
          student_number,
          first_name,
          middle_name,
          last_name,
          sex,
          section_id,
          section:sections!section_id (
            id,
            section_name,
            grade_level,
            school_year
          )
        `)
        .in("student_number", chunk);

      if (chunkErr) throw chunkErr;
      if (chunkData) globalStudents.push(...chunkData);
    }
  }

  const globalByLrn = new Map();
  for (const s of globalStudents) {
    const lrn = String(s.student_number ?? "").trim();
    if (lrn) globalByLrn.set(lrn, s);
  }

  // 4. Fetch existing grades for this class to detect DUPLICATE records
  const { data: existingGrades, error: gradesErr } = await supabase
    .from("grades")
    .select("id, student_id, quarter, final_grade, school_year, class_id")
    .eq("class_id", classId);

  if (gradesErr) throw gradesErr;

  const existingGradeMap = new Map();
  for (const g of existingGrades ?? []) {
    const key = `${g.student_id}:${Number(g.quarter)}`;
    existingGradeMap.set(key, g);
  }

  // 5. Match and categorize each learner
  const validatedLearners = [];

  for (let index = 0; index < learners.length; index++) {
    const learner = learners[index];
    const lrn = String(learner.student_number ?? "").trim();
    const rawFullName = normalizeText(learner.full_name);
    const parsedNames = splitLearnerName(rawFullName);
    const normalizedNameKey = normalizePersonName(rawFullName);

    // Quarterly grade for target quarter or primary grade
    const termGrades = learner.term_grades ?? {};
    const recordedGrade =
      parseRecordedGrade(termGrades[targetQuarter]) ??
      parseRecordedGrade(learner.quarterly_grade);

    let status = "UNMATCHED";
    let matchedStudent = null;
    let validationMessage = "";
    let existingGradeRecord = null;
    let defaultIncluded = false;

    // A. Check against official section roster by LRN
    if (lrn && officialByLrn.has(lrn)) {
      matchedStudent = officialByLrn.get(lrn);
      const officialFullName = `${matchedStudent.last_name}, ${matchedStudent.first_name}`;
      const officialNormalized = normalizePersonName(officialFullName);

      // Check name similarity
      const isNameClose =
        normalizedNameKey === officialNormalized ||
        normalizedNameKey.includes(normalizeKey(matchedStudent.last_name || "")) ||
        officialNormalized.includes(normalizeKey(parsedNames.last_name || ""));

      if (isNameClose) {
        // Check if grade already exists for this student and quarter
        const gradeKey = `${matchedStudent.id}:${targetQuarter}`;
        if (existingGradeMap.has(gradeKey)) {
          existingGradeRecord = existingGradeMap.get(gradeKey);
          status = "DUPLICATE";
          validationMessage = `Grade already recorded (${existingGradeRecord.final_grade}). Check to overwrite.`;
          defaultIncluded = true;
        } else {
          status = "MATCHED";
          validationMessage = "Matched to official section roster.";
          defaultIncluded = true;
        }
      } else {
        // LRN matches official section roster, but name has notable discrepancy
        status = "NEEDS_VERIFICATION";
        validationMessage = `LRN belongs to "${officialFullName}" in official roster. Verify learner name.`;
        defaultIncluded = false;
      }
    }
    // B. Check if LRN exists in global students (Wrong Section)
    else if (lrn && globalByLrn.has(lrn)) {
      const foreignStudent = globalByLrn.get(lrn);
      matchedStudent = foreignStudent;
      const otherSectionName =
        foreignStudent.section?.section_name
          ? `Grade ${foreignStudent.section.grade_level} — ${foreignStudent.section.section_name}`
          : "another section";

      status = "WRONG_SECTION";
      validationMessage = `Learner officially belongs to ${otherSectionName}. Cannot reassign section via E-Record.`;
      defaultIncluded = false;
    }
    // C. Check if Full Name matches someone in the official section roster (LRN discrepancy)
    else if (normalizedNameKey && officialByName.has(normalizedNameKey)) {
      matchedStudent = officialByName.get(normalizedNameKey);
      status = "NEEDS_VERIFICATION";
      validationMessage = `Name matches official learner, but LRN in file (${lrn || "none"}) differs from official LRN (${matchedStudent.student_number}).`;
      defaultIncluded = false;
    }
    // D. Not found anywhere
    else {
      status = "UNMATCHED";
      validationMessage = lrn
        ? `No student record found with LRN ${lrn}. Official adviser roster must establish enrollment first.`
        : "Missing LRN. Cannot match to centralized student master.";
      defaultIncluded = false;
    }

    validatedLearners.push({
      index: index + 1,
      sourceRow: learner.source_row ?? index + 1,
      student_number: lrn,
      full_name: rawFullName,
      gender: learner.gender ?? null,
      quarterly_grade: recordedGrade,
      term_grades: termGrades,
      status,
      matchedStudent: matchedStudent
        ? {
            id: matchedStudent.id,
            student_number: matchedStudent.student_number,
            first_name: matchedStudent.first_name,
            middle_name: matchedStudent.middle_name,
            last_name: matchedStudent.last_name,
            section_id: matchedStudent.section_id,
            section_name: matchedStudent.section?.section_name,
            grade_level: matchedStudent.section?.grade_level,
          }
        : null,
      existingGrade: existingGradeRecord?.final_grade ?? null,
      validationMessage,
      included: defaultIncluded,
    });
  }

  // 6. Compute summary counts
  const summary = {
    total: validatedLearners.length,
    matchedCount: validatedLearners.filter((l) => l.status === "MATCHED").length,
    needsVerificationCount: validatedLearners.filter(
      (l) => l.status === "NEEDS_VERIFICATION"
    ).length,
    wrongSectionCount: validatedLearners.filter(
      (l) => l.status === "WRONG_SECTION"
    ).length,
    unmatchedCount: validatedLearners.filter((l) => l.status === "UNMATCHED").length,
    duplicateCount: validatedLearners.filter((l) => l.status === "DUPLICATE").length,
    readyCount: validatedLearners.filter((l) => l.included).length,
  };

  return {
    sectionInfo: {
      id: sectionData?.id ?? sectionId,
      sectionName: sectionData?.section_name || "Section",
      gradeLevel: sectionData?.grade_level || 7,
      schoolYear: sectionData?.school_year || schoolYear,
      adviserName: sectionData?.adviser
        ? [
            sectionData.adviser.first_name,
            sectionData.adviser.middle_name,
            sectionData.adviser.last_name,
          ]
            .filter(Boolean)
            .join(" ")
        : "Class Adviser",
      officialRosterSize: officialStudents?.length ?? 0,
    },
    targetQuarter,
    summary,
    validatedLearners,
  };
}
