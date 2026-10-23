/**
 * Production shaped fixtures for the P0-04B trend forecast tests.
 *
 * The fixture mirrors the CNHS LEARN data model:
 *   - one `classes` row per (subject, section, school year, quarter),
 *   - Term 1 / Term 2 / Term 3 grades live in the class row of their quarter,
 *   - one `ecr_workbooks` row per class row with three term sheets,
 *   - quarter 4 holds the general average (never a grading term).
 */
import { getActiveSchoolYear, normalizeSchoolYear } from "@/lib/academic/activeSchoolYear";

export const LEARNER_ID = "std-001";
export const SECTION_ID = "sec-01";
export const ADMIN_USER_ID = "user-admin-1";
export const TEACHER_USER_ID = "user-teacher-1";
export const TEACHER_ROW_ID = "teacher-row-1";
export const OTHER_TEACHER_ROW_ID = "teacher-row-2";
export const FORECAST_SUBJECT = "English";
export const FORECAST_SUBJECT_ID = "subj-english";

const ACTIVE = normalizeSchoolYear(getActiveSchoolYear());
export const SCHOOL_YEAR = ACTIVE.raw;
export const SCHOOL_YEAR_STANDARD = ACTIVE.standard;
export const SCHOOL_YEAR_VARIANTS = ACTIVE.variants;

const START_YEAR = Number(ACTIVE.raw.slice(0, 4));
export const PRIOR_SCHOOL_YEAR = `${START_YEAR - 1}-${START_YEAR}`;

export const SUBJECT_SEEDS = [
  { id: "subj-english", name: "English", code: "ENG", t1: 85, t2: 87 },
  { id: "subj-filipino", name: "Filipino", code: "FIL", t1: 88, t2: 88 },
  { id: "subj-mathematics", name: "Mathematics", code: "MATH", t1: 82, t2: 84 },
  { id: "subj-science", name: "Science", code: "SCI", t1: 84, t2: 86 },
  {
    id: "subj-araling-panlipunan",
    name: "Araling Panlipunan",
    code: "AP",
    t1: 86,
    t2: 87,
  },
  { id: "subj-mapeh", name: "MAPEH", code: "MAPEH", t1: 89, t2: 90 },
  { id: "subj-tle", name: "TLE", code: "TLE", t1: 90, t2: 91 },
  {
    id: "subj-values-education",
    name: "Values Education",
    code: "ESP",
    t1: 91,
    t2: 92,
  },
];

export function classIdFor(subjectId, schoolYear, quarter) {
  return `cls-${subjectId}-${schoolYear}-q${quarter}`;
}

/**
 * @param {object} [options]
 * @param {"admin"|"teacher"} [options.role]
 * @param {"published"|"draft"} [options.ownSheetStatus] status of the forecast
 *        subject's own term sheets in the current school year
 * @param {number[]} [options.ownSheetTerms] which term sheets exist for the
 *        forecast subject (a missing term is a distinct "missing" state)
 * @param {"published"|"draft"} [options.unrelatedSheetStatus] status of the
 *        other subjects' term sheets in the current school year
 * @param {boolean} [options.priorSchoolYearDraft] put a draft sheet on the
 *        forecast subject's PRIOR school year workbook
 * @param {boolean} [options.duplicateSubjectRow] add a second subject row that
 *        maps to the same canonical key
 * @param {boolean} [options.duplicateGradeRow] add a second grade row for the
 *        forecast subject in Term 1 (ambiguous grade)
 * @param {boolean} [options.withGrades] include grade rows at all
 * @param {boolean} [options.enrolled] learner is enrolled in a teacher class
 */
export function buildTrendFixture(options = {}) {
  const {
    role = "admin",
    ownSheetStatus = "published",
    ownSheetTerms = [1, 2, 3],
    unrelatedSheetStatus = "published",
    priorSchoolYearDraft = true,
    duplicateSubjectRow = false,
    duplicateGradeRow = false,
    withGrades = true,
    enrolled = true,
  } = options;

  const subjects = SUBJECT_SEEDS.map((seed) => ({
    id: seed.id,
    subject_name: seed.name,
    subject_code: seed.code,
  }));

  if (duplicateSubjectRow) {
    subjects.push({
      id: "subj-english-duplicate",
      subject_name: "English",
      subject_code: "ENG-DUP",
    });
  }

  const classes = [];
  const grades = [];
  const ecrTermSheets = [];

  for (const seed of SUBJECT_SEEDS) {
    const teacherId =
      seed.id === FORECAST_SUBJECT_ID ? TEACHER_ROW_ID : OTHER_TEACHER_ROW_ID;

    for (const schoolYear of [SCHOOL_YEAR, PRIOR_SCHOOL_YEAR]) {
      const isPrior = schoolYear === PRIOR_SCHOOL_YEAR;

      for (const quarter of [1, 2, 3, 4]) {
        classes.push({
          id: classIdFor(seed.id, schoolYear, quarter),
          subject_id: seed.id,
          section_id: SECTION_ID,
          school_year: schoolYear,
          quarter,
          teacher_id: teacherId,
        });
      }

      if (withGrades) {
        const quarterGrades = { 1: seed.t1, 2: seed.t2, 3: seed.t1 + 1, 4: seed.t1 };
        for (const quarter of [1, 2, 3, 4]) {
          grades.push({
            id: `gr-${seed.id}-${schoolYear}-q${quarter}`,
            student_id: LEARNER_ID,
            class_id: classIdFor(seed.id, schoolYear, quarter),
            subject_id: seed.id,
            quarter,
            final_grade: quarterGrades[quarter],
            school_year: schoolYear,
            subjects: {
              id: seed.id,
              subject_name: seed.name,
              subject_code: seed.code,
            },
          });
        }
      }

      const workbookId = `wb-${seed.id}-${schoolYear}`;
      const workbook = {
        id: workbookId,
        class_id: classIdFor(seed.id, schoolYear, 1),
        school_year: schoolYear,
      };

      for (const term of [1, 2, 3]) {
        const isOwnSubject = seed.id === FORECAST_SUBJECT_ID;
        let status = "published";
        let exists = true;

        if (isPrior) {
          status =
            priorSchoolYearDraft && isOwnSubject ? "draft" : "published";
        } else if (isOwnSubject) {
          status = ownSheetStatus;
          exists = ownSheetTerms.includes(term);
        } else {
          status = unrelatedSheetStatus;
        }

        if (!exists) continue;

        ecrTermSheets.push({
          id: `sh-${seed.id}-${schoolYear}-t${term}`,
          term,
          status,
          workbook_id: workbookId,
          workbook,
        });
      }
    }
  }

  if (duplicateGradeRow) {
    grades.push({
      id: "gr-subj-english-duplicate",
      student_id: LEARNER_ID,
      class_id: classIdFor(FORECAST_SUBJECT_ID, SCHOOL_YEAR, 1),
      subject_id: FORECAST_SUBJECT_ID,
      quarter: 1,
      final_grade: 79,
      school_year: SCHOOL_YEAR,
      subjects: {
        id: FORECAST_SUBJECT_ID,
        subject_name: "English",
        subject_code: "ENG",
      },
    });
  }

  const teacherClassIds = new Set(
    classes
      .filter((row) => row.teacher_id === TEACHER_ROW_ID)
      .map((row) => row.id)
  );

  const session =
    role === "admin"
      ? { role: "admin", visibleClassIds: null }
      : { role: "teacher", visibleClassIds: teacherClassIds };

  const authUser =
    role === "admin"
      ? { id: ADMIN_USER_ID }
      : { id: TEACHER_USER_ID };

  const profiles =
    role === "admin"
      ? [
          {
            id: "prof-admin",
            auth_user_id: ADMIN_USER_ID,
            role: "admin",
            is_active: true,
          },
        ]
      : [
          {
            id: "prof-teacher",
            auth_user_id: TEACHER_USER_ID,
            role: "teacher",
            is_active: true,
          },
        ];

  const classStudents = enrolled
    ? [
        {
          id: "cs-1",
          student_id: LEARNER_ID,
          class_id: classIdFor(FORECAST_SUBJECT_ID, SCHOOL_YEAR, 1),
          classes: {
            id: classIdFor(FORECAST_SUBJECT_ID, SCHOOL_YEAR, 1),
            teacher_id: TEACHER_ROW_ID,
          },
        },
      ]
    : [];

  return {
    authUser,
    session,
    profiles,
    teachers: [{ id: TEACHER_ROW_ID, user_id: TEACHER_USER_ID }],
    classStudents,
    students: [{ id: LEARNER_ID, section_id: SECTION_ID }],
    subjects,
    classes,
    grades,
    ecrTermSheets,
  };
}
