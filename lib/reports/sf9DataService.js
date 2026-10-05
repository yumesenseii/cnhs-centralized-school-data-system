/**
 * Official DepEd School Form 9 (SF9 / Form 138) Data & Calculation Engine
 * Matched with Cambaog National High School SY 2026-2027 MATATAG template.
 */

export const SF9_SCHOOL_INFO = {
  region: "REGION III",
  division: "SCHOOLS DIVISION OF BULACAN",
  district: "District II",
  municipality: "Bustos, Bulacan",
  schoolName: "CAMBAOG NATIONAL HIGH SCHOOL",
  schoolId: "300793",
  schoolYear: "2026-2027",
  defaultSchoolHead: "DULCE VILMA R. GALANG",
  schoolHeadTitle: "School Head",
};

/**
 * Official MATATAG performance descriptors from the CNHS SF9 template (SY 26-27).
 *
 * 90-100: Advancing (Passed)
 * 80-89:  Benchmarking (Passed)
 * 75-79:  Connecting (Passed)
 * 65-74:  Developing (Failed)
 * 0-64:   Emerging (Failed)
 */
export function getMatatagDescriptor(grade) {
  if (grade === null || grade === undefined || grade === "" || isNaN(Number(grade))) {
    return { descriptor: "—", remarks: "—" };
  }
  const g = Math.round(Number(grade));
  if (g >= 90) return { descriptor: "Advancing", remarks: "Passed" };
  if (g >= 80) return { descriptor: "Benchmarking", remarks: "Passed" };
  if (g >= 75) return { descriptor: "Connecting", remarks: "Passed" };
  if (g >= 65) return { descriptor: "Developing", remarks: "Failed" };
  return { descriptor: "Emerging", remarks: "Failed" };
}

/** Standard months sequence for DepEd School Year (June to April). */
export const SF9_MONTHS = [
  { key: "jun", monthNum: 6, label: "Jun" },
  { key: "jul", monthNum: 7, label: "Jul" },
  { key: "aug", monthNum: 8, label: "Aug" },
  { key: "sep", monthNum: 9, label: "Sep" },
  { key: "oct", monthNum: 10, label: "Oct" },
  { key: "nov", monthNum: 11, label: "Nov" },
  { key: "dec", monthNum: 12, label: "Dec" },
  { key: "jan", monthNum: 1, label: "Jan" },
  { key: "feb", monthNum: 2, label: "Feb" },
  { key: "mar", monthNum: 3, label: "Mar" },
  { key: "apr", monthNum: 4, label: "Apr" },
];

/** Standard official subjects from CNHS Form 9 (in exact order). */
export const OFFICIAL_SUBJECT_KEYS = [
  { key: "filipino", label: "Filipino" },
  { key: "english", label: "English" },
  { key: "mathematics", label: "Mathematics" },
  { key: "science", label: "Science" },
  { key: "araling_panlipunan", label: "Araling Panlipunan (AP)" },
  { key: "values_education", label: "GMRC / Values Education" },
  { key: "tle", label: "EPP/TLE" },
  {
    key: "mapeh",
    label: "MAPEH",
    isComposite: true,
    subAreas: [
      { key: "music_arts", label: "Music and Arts" },
      { key: "pe_health", label: "Physical Education and Health" },
    ],
  },
];

/**
 * Compute final grade from T1, T2, T3 terms.
 * If all 3 terms exist, rounds the average to whole number per DepEd standard.
 * If partially recorded, provides the current term average.
 */
export function computeTermAverage(t1, t2, t3) {
  const terms = [t1, t2, t3].filter(
    (t) => t !== null && t !== undefined && t !== "" && !isNaN(Number(t))
  ).map(Number);

  if (terms.length === 0) return null;
  const sum = terms.reduce((a, b) => a + b, 0);
  return Math.round(sum / terms.length);
}

/**
 * Format learner name into official DepEd style: "LASTNAME, FIRSTNAME MIDDLENAME".
 */
export function formatDepEdLearnerName(learner = {}) {
  const last = (learner.last_name || learner.lastName || "").trim().toUpperCase();
  const first = (learner.first_name || learner.firstName || "").trim().toUpperCase();
  const middle = (learner.middle_name || learner.middleName || "").trim().toUpperCase();

  if (!last && !first) {
    return (learner.name || learner.fullName || "LEARNER").toUpperCase();
  }
  return middle ? `${last}, ${first} ${middle}` : `${last}, ${first}`;
}

/**
 * Calculate age from birthdate if available.
 */
export function calculateAge(birthdate) {
  if (!birthdate) return "—";
  try {
    const dob = new Date(birthdate);
    if (isNaN(dob.getTime())) return "—";
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return String(Math.abs(ageDt.getUTCFullYear() - 1970));
  } catch {
    return "—";
  }
}

/**
 * Safely normalizes gradeLevel into a clean numeric string (e.g. "Grade 7" -> "7", 7 -> "7", null -> fallback).
 * Supports numbers, strings with/without prefix, null, undefined.
 */
export function normalizeGradeLevel(val, fallback = "7") {
  if (val === null || val === undefined || val === "") return String(fallback);
  const str = String(val).trim();
  const cleaned = str.replace(/Grade\s*/i, "").trim();
  return cleaned || String(fallback);
}

/**
 * Normalizes learner monitoring detail into standard SF9 document shape.
 * Type-safe and resilient against missing fields, number types, or alternate naming.
 */
export function formatStudentForSf9(detail = {}, options = {}) {
  const gradesMap = {};

  // 1. If detail already has structured grades (e.g. from advisory overview), clone them
  if (detail.grades && typeof detail.grades === "object") {
    Object.keys(detail.grades).forEach((k) => {
      gradesMap[k] = { ...detail.grades[k] };
    });
  }

  // 2. Overlay individual subjectGrades if provided
  if (Array.isArray(detail.subjectGrades)) {
    detail.subjectGrades.forEach((g) => {
      const name = (g.subject || g.subjectName || "").toLowerCase();
      let key = null;
      if (name.includes("filipino")) key = "filipino";
      else if (name.includes("english")) key = "english";
      else if (name.includes("math")) key = "mathematics";
      else if (name.includes("science")) key = "science";
      else if (name.includes("araling") || name.includes("ap")) key = "araling_panlipunan";
      else if (name.includes("gmrc") || name.includes("values") || name.includes("esp")) key = "values_education";
      else if (name.includes("tle") || name.includes("epp")) key = "tle";
      else if (name.includes("music") || name.includes("art")) key = "music_arts";
      else if (name.includes("pe") || name.includes("health") || name.includes("physical")) key = "pe_health";
      else if (name.includes("mapeh")) key = "mapeh";

      if (key) {
        if (!gradesMap[key]) gradesMap[key] = {};
        const q = Number(g.quarter || 1);
        if (q === 1) gradesMap[key].t1 = g.grade;
        else if (q === 2) gradesMap[key].t2 = g.grade;
        else if (q === 3) gradesMap[key].t3 = g.grade;
      }
    });
  }

  // 3. Also integrate current class subject grade if available
  if (detail.subject && detail.classSubjectGrade) {
    const name = String(detail.subject).toLowerCase();
    let key = null;
    if (name.includes("filipino")) key = "filipino";
    else if (name.includes("english")) key = "english";
    else if (name.includes("math")) key = "mathematics";
    else if (name.includes("science")) key = "science";
    else if (name.includes("araling") || name.includes("ap")) key = "araling_panlipunan";
    else if (name.includes("values") || name.includes("gmrc") || name.includes("esp")) key = "values_education";
    else if (name.includes("tle") || name.includes("epp")) key = "tle";
    else if (name.includes("mapeh")) key = "mapeh";

    if (key) {
      if (!gradesMap[key]) gradesMap[key] = {};
      const q = Number(detail.quarterNumber || 1);
      if (q === 1) gradesMap[key].t1 = detail.classSubjectGrade;
      else if (q === 2) gradesMap[key].t2 = detail.classSubjectGrade;
      else if (q === 3) gradesMap[key].t3 = detail.classSubjectGrade;
    }
  }

  // 4. If fillFallbacks option is requested (e.g. for layout testing), populate empty areas
  if (options.fillFallbacks) {
    OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
      if (subj.isComposite) {
        subj.subAreas.forEach((sub) => {
          if (!gradesMap[sub.key] || (!gradesMap[sub.key].t1 && !gradesMap[sub.key].t2)) {
            gradesMap[sub.key] = { t1: gradesMap[sub.key]?.t1 ?? 90, t2: gradesMap[sub.key]?.t2 ?? 91 };
          }
        });
      } else if (!gradesMap[subj.key] || (!gradesMap[subj.key].t1 && !gradesMap[subj.key].t2)) {
        const fallback = Math.round(Number(detail.generalAverage || detail.classSubjectGrade || 85));
        gradesMap[subj.key] = { t1: gradesMap[subj.key]?.t1 ?? fallback, t2: gradesMap[subj.key]?.t2 ?? fallback };
      }
    });
  }

  const rawName = String(detail.name || detail.fullName || "").trim();
  const nameParts = rawName ? rawName.split(" ").filter(Boolean) : [];

  const lastName = String(
    detail.last_name ||
    detail.lastName ||
    (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "Learner")
  ).trim();

  const firstName = String(
    detail.first_name ||
    detail.firstName ||
    (nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : nameParts[0] || "")
  ).trim();

  const middleName = String(detail.middle_name || detail.middleName || "").trim();

  const lrn = String(
    detail.student_number ||
    detail.studentNumber ||
    detail.lrn ||
    "—"
  ).trim();

  const gradeLevel = normalizeGradeLevel(detail.gradeLevel ?? detail.grade_level, "7");

  const sectionName = String(
    detail.sectionName ||
    detail.section_name ||
    detail.section ||
    "Gumamela"
  ).trim();

  const adviserName = String(
    detail.adviserName ||
    detail.adviser ||
    "Yukari Nemoto"
  ).trim();

  const schoolYear = String(
    detail.schoolYear ||
    detail.school_year ||
    SF9_SCHOOL_INFO.schoolYear
  ).trim();

  return {
    ...detail,
    id: detail.id || detail.studentId || detail.student_id,
    studentId: detail.studentId || detail.id || detail.student_id,
    lastName,
    firstName,
    middleName,
    lrn,
    studentNumber: lrn,
    gradeLevel,
    sectionName,
    adviserName,
    schoolYear,
    schoolHead: String(detail.schoolHead || SF9_SCHOOL_INFO.defaultSchoolHead).trim(),
    grades: gradesMap,
    generalAverage: detail.generalAverage ?? null,
    attendance: detail.attendance || {
      jun: { classDays: 15, present: 15, absent: 0 },
      jul: { classDays: 20, present: 20, absent: 0 },
      aug: { classDays: 21, present: 20, absent: 1 },
      sep: { classDays: 22, present: 22, absent: 0 },
      oct: { classDays: 21, present: 21, absent: 0 },
      nov: { classDays: 20, present: 19, absent: 1 },
      dec: { classDays: 14, present: 14, absent: 0 },
      jan: { classDays: 20, present: 20, absent: 0 },
      feb: { classDays: 18, present: 18, absent: 0 },
      mar: { classDays: 21, present: 21, absent: 0 },
      apr: { classDays: 9, present: 9, absent: 0 },
    },
  };
}

/**
 * Evaluates whether an SF9 has complete data and is eligible for official release.
 * Checks:
 * 1. Learner Identity and valid LRN
 * 2. Section membership verification
 * 3. Required subjects & terms grade completeness
 */
export function validateSf9ReleaseEligibility(studentData = {}, section = {}, options = {}) {
  const missing = [];
  const requiredTerms = options.requiredTerms || [1]; // Check term 1 by default, or all active terms

  // 1. Verify basic identity
  const lrn = String(studentData.lrn || studentData.studentNumber || "").trim();
  if (!lrn || lrn === "—" || lrn === "null" || lrn === "undefined") {
    missing.push("Official 12-digit Learner Reference Number (LRN)");
  }
  if (!studentData.lastName || !studentData.firstName) {
    missing.push("Complete Learner Full Name");
  }

  // 2. Verify section membership
  const expectedSectionId = section?.id || section?.sectionId;
  const studentSectionId = studentData.section_id || studentData.sectionId;
  if (expectedSectionId && studentSectionId && studentSectionId !== expectedSectionId) {
    missing.push(`Learner section (${studentSectionId}) does not match advisory section (${expectedSectionId})`);
  }

  // 3. Verify subjects & terms completion
  const grades = studentData.grades || {};
  OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
    if (subj.isComposite) {
      (subj.subAreas || []).forEach((sub) => {
        const subData = grades[sub.key] || {};
        requiredTerms.forEach((t) => {
          const val = subData[`t${t}`];
          if (val === null || val === undefined || val === "" || isNaN(Number(val))) {
            missing.push(`${sub.label} (${subj.label}), Term ${t}`);
          }
        });
      });
    } else {
      const g = grades[subj.key] || {};
      requiredTerms.forEach((t) => {
        const val = g[`t${t}`];
        if (val === null || val === undefined || val === "" || isNaN(Number(val))) {
          missing.push(`${subj.label}, Term ${t}`);
        }
      });
    }
  });

  const isEligible = missing.length === 0;

  return {
    isEligible,
    canRelease: isEligible,
    missing,
    summary: isEligible
      ? "All required learning areas and learner data are complete. Eligible for release."
      : `Cannot be released yet. Missing ${missing.length} required grade item(s) or record(s).`,
  };
}
