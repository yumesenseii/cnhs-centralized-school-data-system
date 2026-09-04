/**
 * Map school-wide monitoring roster → Academic Records UI model.
 * Same ECR grades / risk source as Admin Reports (no SF2 attendance).
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
  averageFromSubjectGrades,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import { initialsFromName } from "@/lib/teacher/monitoringMappers";
import { getCachedBuiltMonitoringRoster } from "@/lib/admin/adminRosterCache";
import { QUARTER_OPTIONS } from "@/lib/teacher/reportsConstants";
import { TERM_ALL_LABEL, parseTermNumber, termLabel } from "@/lib/academic/termLabels";
import { classReportFolderKey } from "@/lib/reports/groupClassFolders";

/** Final Grade / Average (DB quarter 4) — computed from Terms 1–3; omit from Academic Records lists. */
function isInstructionalTermRow(row) {
  return parseTermNumber(row?.quarterNumber ?? row?.quarter) !== 4;
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueIds(values = []) {
  return [...new Set(values.filter(Boolean).map((v) => String(v)))];
}

function normalizeTeacherName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function teacherNameKeys(name) {
  const normalized = normalizeTeacherName(name);
  if (!normalized) return [];
  const parts = normalized.split(" ").filter(Boolean);
  const keys = [normalized];
  if (parts.length >= 2) {
    keys.push(`${parts[0]} ${parts[parts.length - 1]}`);
  }
  return keys;
}

function canonicalGradeLabel(grade) {
  const raw = String(grade ?? "").trim();
  if (!raw) return null;
  if (/^grade\s+/i.test(raw)) return raw.replace(/^grade\s+/i, "Grade ");
  if (/^\d+$/.test(raw)) return `Grade ${raw}`;
  return raw;
}

function buildTeacherIdsByName(classSummaries = []) {
  const map = {};
  for (const classInfo of classSummaries) {
    const id = classInfo.teacherId;
    if (!id) continue;
    for (const key of teacherNameKeys(classInfo.teacherName)) {
      const list = map[key] ?? [];
      if (!list.includes(id)) list.push(id);
      map[key] = list;
    }
  }
  return map;
}

function riskRank(riskLevel) {
  const normalized = normalizeRiskLevel(riskLevel);
  if (normalized === RISK_LEVEL.HIGH) return 0;
  if (normalized === RISK_LEVEL.MODERATE) return 1;
  return 2;
}

function recommendationDisplay(studentRows = []) {
  const hasAral = studentRows.some(
    (row) =>
      row.aralEligible && row.recommendation === RECOMMENDATION.ARAL
  );
  if (hasAral) return RECOMMENDATION.ARAL;

  const hasRemedial = studentRows.some(
    (row) =>
      row.recommendation === RECOMMENDATION.REMEDIATION ||
      (row.belowPassing && !row.aralEligible)
  );
  if (hasRemedial) {
    return "Recommended for Teacher-Based Classroom Remediation";
  }

  return "No recommendation";
}

function reviewStatusForLearner(studentRows = []) {
  const hasGrades = studentRows.some(
    (row) =>
      (row.subjectGrades ?? []).some((g) => {
        const n = Number(g.grade ?? g.finalGrade);
        return Number.isFinite(n);
      }) ||
      (row.classSubjectGrade !== null &&
        row.classSubjectGrade !== undefined &&
        Number.isFinite(Number(row.classSubjectGrade)))
  );
  return hasGrades ? "Validated" : "Pending Review";
}

function putSubjectGrade(bySubject, subject, value) {
  if (!subject) return;
  if (value === null || value === undefined || value === "") return;
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  const prev = bySubject.get(subject);
  if (prev == null || n < prev) bySubject.set(subject, n);
}

function mergeSubjectGrades(rows = []) {
  const bySubject = new Map();
  for (const row of rows) {
    for (const grade of row.subjectGrades ?? []) {
      putSubjectGrade(
        bySubject,
        grade.subject ?? grade.subjectName,
        grade.grade ?? grade.finalGrade
      );
    }
    putSubjectGrade(bySubject, row.subject, row.classSubjectGrade);
  }
  return [...bySubject.entries()].map(([subject, grade]) => ({
    subject,
    grade,
  }));
}

/**
 * Collapse per-class enrollment rows into one learner record (GWA + worst risk).
 */
export function aggregateUniqueLearners(
  rosterStudents = [],
  classSummaries = []
) {
  const teacherIdByClassId = new Map(
    classSummaries.map((c) => [c.id, c.teacherId])
  );
  const byStudent = new Map();

  for (const row of rosterStudents) {
    const key = row.studentId;
    if (!key) continue;
    const bucket = byStudent.get(key) ?? { rows: [] };
    bucket.rows.push(row);
    byStudent.set(key, bucket);
  }

  const learners = [];

  for (const { rows } of byStudent.values()) {
    const primary = rows[0];
    const mergedGrades = mergeSubjectGrades(rows);
    const generalAverage = averageFromSubjectGrades(mergedGrades);
    const weakSubjects = mergedGrades
      .filter((g) => Number(g.grade) < 75)
      .map((g) => g.subject);
    const worstRisk = rows
      .map((r) => normalizeRiskLevel(r.riskLevel))
      .sort((a, b) => riskRank(a) - riskRank(b))[0];

    const grades = uniqueStrings(rows.map((r) => r.grade));
    const sections = uniqueStrings(rows.map((r) => r.section));
    const displayGrade = grades[0] || primary.grade;
    const displayRow =
      rows.find((r) => r.grade === displayGrade) || primary;

    learners.push({
      id: primary.studentId,
      studentId: primary.studentId,
      studentNumber: primary.studentNumber || "—",
      studentName: primary.name,
      initials: primary.initials || initialsFromName(primary.name),
      grade: displayGrade,
      grades,
      gradeSection: displayRow.gradeSection,
      section: displayRow.section,
      sections,
      generalAverage: generalAverage ?? 0,
      generalAverageValue: generalAverage,
      weakSubject: weakSubjects[0] ?? null,
      weakSubjects,
      riskLevel: worstRisk || RISK_LEVEL.LOW,
      systemRecommendation: recommendationDisplay(rows),
      reviewStatus: reviewStatusForLearner(rows),
      teacherNames: uniqueStrings(rows.map((r) => r.teacherName)),
      teacherIds: uniqueIds(
        rows.map((r) => r.teacherId || teacherIdByClassId.get(r.classId))
      ),
      schoolYear: primary.schoolYear,
      quarter: primary.quarter,
    });
  }

  learners.sort((a, b) => {
    const gradeCmp = String(a.grade ?? "").localeCompare(String(b.grade ?? ""));
    if (gradeCmp !== 0) return gradeCmp;
    const sectionCmp = String(a.section ?? "").localeCompare(
      String(b.section ?? "")
    );
    if (sectionCmp !== 0) return sectionCmp;
    return String(a.studentName ?? "").localeCompare(String(b.studentName ?? ""));
  });

  return learners;
}

const CANONICAL_GRADE_FOLDERS = [
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

function emptyGradeFolder(label) {
  return {
    grade: label,
    students: 0,
    priority: 0,
    moderate: 0,
    low: 0,
    aral: 0,
    ungraded: 0,
  };
}

function buildGradeSummary(learners = []) {
  const buckets = new Map(
    CANONICAL_GRADE_FOLDERS.map((label) => [label, emptyGradeFolder(label)])
  );

  for (const learner of learners) {
    const labels = uniqueStrings(
      (learner.grades?.length ? learner.grades : [learner.grade]).map(
        (grade) => canonicalGradeLabel(grade)
      )
    );
    for (const label of labels) {
      if (!label) continue;
      const entry = buckets.get(label) ?? emptyGradeFolder(label);
      entry.students += 1;
      const risk = normalizeRiskLevel(learner.riskLevel);
      if (risk === RISK_LEVEL.HIGH) entry.priority += 1;
      else if (risk === RISK_LEVEL.MODERATE) entry.moderate += 1;
      else entry.low += 1;
      if (learner.systemRecommendation === RECOMMENDATION.ARAL) {
        entry.aral += 1;
      }
      if (
        learner.generalAverageValue === null ||
        learner.generalAverageValue === undefined
      ) {
        entry.ungraded += 1;
      }
      buckets.set(label, entry);
    }
  }

  return [...buckets.values()].sort((a, b) => {
    const ga = Number(String(a.grade).replace(/\D/g, "")) || 0;
    const gb = Number(String(b.grade).replace(/\D/g, "")) || 0;
    return ga - gb;
  });
}

function relativeDayLabel(value) {
  if (!value || value === "—") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(date);
  startThat.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** Latest grade upload/update timestamp per class_id from grades rows. */
function latestGradeTsByClassId(grades = []) {
  const map = new Map();
  for (const row of grades) {
    const classId = row.class_id ?? row.classId;
    if (!classId) continue;
    if (parseTermNumber(row.quarter) === 4) continue;
    const raw = row.updated_at ?? row.updatedAt ?? row.created_at ?? row.createdAt;
    if (!raw) continue;
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) continue;
    const prev = map.get(classId) ?? 0;
    if (ts > prev) map.set(classId, ts);
  }
  return map;
}

function resolveSubmissionDateLabel({
  graded,
  observationDates = [],
  gradeTs = null,
}) {
  if (!graded) return "—";
  let best = Number.isFinite(gradeTs) ? gradeTs : null;
  for (const raw of observationDates) {
    if (!raw || raw === "—") continue;
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts)) continue;
    if (best == null || ts > best) best = ts;
  }
  if (best != null) return relativeDayLabel(new Date(best).toISOString());
  return "On file";
}

function buildTeacherSubmissions(classSummaries = [], grades = []) {
  const gradeTsByClass = latestGradeTsByClassId(grades);
  const byTeacher = new Map();

  for (const classInfo of classSummaries) {
    const teacherKey =
      classInfo.teacherId || classInfo.teacherName || "unknown";
    const entry = byTeacher.get(teacherKey) ?? {
      teacherId: classInfo.teacherId,
      teacher: (classInfo.teacherName || "Teacher").split(/\s+/)[0],
      fullName: classInfo.teacherName || "Teacher",
      initials: initialsFromName(classInfo.teacherName || "Teacher"),
      classes: 0,
      gradedClasses: 0,
      latestDate: null,
    };
    entry.classes += 1;
    const graded =
      (classInfo.gradedStudentCount ?? 0) > 0 ||
      (classInfo.students ?? []).some(
        (s) =>
          s.classSubjectGrade !== null &&
          s.classSubjectGrade !== undefined &&
          Number.isFinite(Number(s.classSubjectGrade))
      );
    if (graded) entry.gradedClasses += 1;

    const classGradeTs = gradeTsByClass.get(classInfo.id);
    if (Number.isFinite(classGradeTs)) {
      if (!entry.latestDate || classGradeTs > entry.latestDate) {
        entry.latestDate = classGradeTs;
      }
    }

    for (const student of classInfo.students ?? []) {
      const raw = student.latestObservationDate;
      if (!raw || raw === "—") continue;
      const ts = Date.parse(raw);
      if (!Number.isFinite(ts)) continue;
      if (!entry.latestDate || ts > entry.latestDate) entry.latestDate = ts;
    }

    byTeacher.set(teacherKey, entry);
  }

  const submissions = [...byTeacher.values()]
    .map((entry) => {
      const uploaded = entry.gradedClasses > 0;
      return {
        teacher: entry.teacher,
        fullName: entry.fullName,
        initials: entry.initials,
        submissionDate: resolveSubmissionDateLabel({
          graded: uploaded,
          gradeTs: entry.latestDate,
        }),
        uploadStatus: uploaded ? "Uploaded" : "Not Sub.",
        validationStatus: uploaded ? "Validated" : "—",
      };
    })
    .sort((a, b) => {
      if (a.uploadStatus !== b.uploadStatus) {
        return a.uploadStatus === "Uploaded" ? -1 : 1;
      }
      return a.teacher.localeCompare(b.teacher);
    });

  const submitted = submissions.filter((s) => s.uploadStatus === "Uploaded")
    .length;
  const total = submissions.length;
  const percent = total ? Math.round((submitted / total) * 100) : 0;

  return {
    submissions,
    submissionProgress: {
      label: `${submitted} of ${total} submitted`,
      percent,
    },
  };
}

function buildRecentUploadActivity(classSummaries = [], grades = []) {
  const gradeTsByClass = latestGradeTsByClassId(grades);
  return classSummaries
    .map((classInfo) => {
      const graded = (classInfo.gradedStudentCount ?? 0) > 0;
      const observationDates = (classInfo.students ?? []).map(
        (s) => s.latestObservationDate
      );
      const gradeTs = gradeTsByClass.get(classInfo.id) ?? null;
      const submissionDate = resolveSubmissionDateLabel({
        graded,
        observationDates,
        gradeTs,
      });
      const sortKey =
        (Number.isFinite(gradeTs) ? gradeTs : 0) ||
        Math.max(
          0,
          ...observationDates
            .map((d) => (d && d !== "—" ? Date.parse(d) : 0))
            .filter((n) => Number.isFinite(n))
        );

      return {
        id:
          classInfo.id ||
          `${classInfo.teacherName}-${classInfo.subject}-${classInfo.gradeSection}-${classInfo.quarter}`,
        teacher: classInfo.teacherName || "Teacher",
        initials: initialsFromName(classInfo.teacherName || "Teacher"),
        assignedClass: `${classInfo.subject} ${classInfo.gradeSection}`.trim(),
        term: termLabel(classInfo.quarter ?? classInfo.quarterNumber),
        submissionDate,
        reviewStatus: graded ? "Validated" : "Pending Validation",
        sortKey,
        graded,
      };
    })
    .sort((a, b) => {
      if (a.graded !== b.graded) return a.graded ? -1 : 1;
      return b.sortKey - a.sortKey;
    })
    .slice(0, 12)
    .map(({ sortKey: _s, graded: _g, ...rest }) => rest);
}

export function pickDefaultSchoolYear(classes = [], schoolYears = []) {
  if (!schoolYears.length) return "";
  const counts = new Map();
  for (const row of classes) {
    const year = row.school_year ?? row.schoolYear;
    if (!year) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const ranked = [...schoolYears].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );
  return ranked[0] || schoolYears[0];
}

function gradeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function mapClassRosterStudent(row) {
  const terms = row.termGrades || {};
  const termGrade = gradeNumber(row.classSubjectGrade);
  return {
    id: row.id,
    studentId: row.studentId,
    studentNumber: row.studentNumber || "—",
    studentName: row.name,
    initials: row.initials || initialsFromName(row.name),
    gender: row.gender || row.sex || "—",
    term1: gradeNumber(terms[1]),
    term2: gradeNumber(terms[2]),
    term3: gradeNumber(terms[3]),
    final: gradeNumber(terms[4]),
    termGrade,
    hasGrade: termGrade !== null,
  };
}

function unwrapNested(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function personName(person) {
  if (!person) return "";
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function classFamilyKey(row = {}) {
  return [
    row.teacherId ?? row.teacher_id ?? "",
    row.subjectId ?? row.subject_id ?? row.subject ?? "",
    row.sectionId ?? row.section_id ?? row.sectionName ?? row.section ?? "",
    row.schoolYear ?? row.school_year ?? "",
  ]
    .map((part) => String(part).trim().toLowerCase())
    .join("|");
}

function enrollmentCountByClass(enrollments = []) {
  const map = new Map();
  for (const row of enrollments) {
    const classId = row.class_id ?? row.classId;
    if (!classId) continue;
    map.set(classId, (map.get(classId) ?? 0) + 1);
  }
  return map;
}

function gradesByFamilyStudent(grades = [], classMetaById = new Map()) {
  const map = new Map();
  for (const row of grades) {
    const classId = row.class_id ?? row.classId;
    const studentId = row.student_id ?? row.studentId;
    const meta = classMetaById.get(classId);
    const family = meta ? classFamilyKey(meta) : String(classId);
    const quarter = Number(row.quarter);
    const grade = Number(row.final_grade ?? row.finalGrade);
    if (!studentId || !Number.isFinite(quarter) || quarter < 1 || quarter > 4) {
      continue;
    }
    if (!Number.isFinite(grade)) continue;
    const key = `${family}:${studentId}`;
    const terms = map.get(key) ?? {};
    terms[quarter] = grade;
    map.set(key, terms);
  }
  return map;
}

function rosterFromEnrollments(classId, enrollments = []) {
  return enrollments
    .filter((row) => (row.class_id ?? row.classId) === classId)
    .map((row) => {
      const student = unwrapNested(row.students) ?? unwrapNested(row.student);
      const studentId = row.student_id ?? student?.id;
      const name = personName(student) || "Learner";
      return {
        id: `${classId}:${studentId}`,
        studentId,
        studentNumber: student?.student_number || "—",
        name,
        initials: initialsFromName(name),
        gender: student?.sex || student?.gender || "—",
        termGrades: {},
        classSubjectGrade: null,
      };
    });
}

function mapClassCatalog(classSummaries = [], { enrollments = [], grades = [] } = {}) {
  const enrollCounts = enrollmentCountByClass(enrollments);
  const classMetaById = new Map(
    classSummaries.map((cls) => [cls.id, cls])
  );
  const familyGrades = gradesByFamilyStudent(grades, classMetaById);

  return classSummaries
    .map((classInfo) => {
      let sourceRows = classInfo.students ?? [];
      if (!sourceRows.length && enrollCounts.get(classInfo.id)) {
        sourceRows = rosterFromEnrollments(classInfo.id, enrollments);
      }

      const family = classFamilyKey(classInfo);
      const roster = [...sourceRows]
        .map((row) => {
          const mapped = mapClassRosterStudent(row);
          const merged =
            familyGrades.get(`${family}:${mapped.studentId}`) ?? {};
          const term1 = mapped.term1 ?? gradeNumber(merged[1]);
          const term2 = mapped.term2 ?? gradeNumber(merged[2]);
          const term3 = mapped.term3 ?? gradeNumber(merged[3]);
          const final = mapped.final ?? gradeNumber(merged[4]);
          const quarter = Number(classInfo.quarter) || 1;
          const termGrade =
            mapped.termGrade ??
            gradeNumber(merged[quarter]) ??
            (quarter === 1
              ? term1
              : quarter === 2
                ? term2
                : quarter === 3
                  ? term3
                  : final);
          return {
            ...mapped,
            term1,
            term2,
            term3,
            final,
            termGrade,
            hasGrade: termGrade !== null,
          };
        })
        .sort((a, b) =>
          String(a.studentName).localeCompare(String(b.studentName))
        );

      const gradedCount = roster.filter((s) => s.hasGrade).length;
      const enrollmentCount = enrollCounts.get(classInfo.id) ?? 0;
      const learnerCount = Math.max(roster.length, enrollmentCount);
      const gradeLabel =
        classInfo.gradeLevel != null
          ? `Grade ${classInfo.gradeLevel}`
          : classInfo.gradeSection?.match(/Grade\s+\d+/)?.[0] || "—";

      return {
        id: classInfo.id,
        subject: classInfo.subject || "Class",
        gradeLabel,
        section: classInfo.sectionName || classInfo.section || "—",
        gradeSection: classInfo.gradeSection || "—",
        teacherName: classInfo.teacherName || "Teacher",
        teacherId: classInfo.teacherId || null,
        quarterNumber: Number(classInfo.quarter) || 1,
        termLabel: termLabel(classInfo.quarter),
        schoolYear: classInfo.schoolYear,
        learnerCount,
        gradedCount,
        pendingCount: Math.max(learnerCount - gradedCount, 0),
        hasUpload: gradedCount > 0,
        assignedNoEcr: learnerCount === 0 && gradedCount === 0,
        students: roster,
      };
    })
    .sort((a, b) => {
      const g =
        (Number(String(a.gradeLabel).replace(/\D/g, "")) || 0) -
        (Number(String(b.gradeLabel).replace(/\D/g, "")) || 0);
      if (g !== 0) return g;
      const sec = String(a.section).localeCompare(String(b.section));
      if (sec !== 0) return sec;
      const sub = String(a.subject).localeCompare(String(b.subject));
      if (sub !== 0) return sub;
      return a.quarterNumber - b.quarterNumber;
    });
}

function studentMergeKey(row = {}) {
  return String(row.studentId || row.studentNumber || row.id || "").trim();
}

function mergeSiblingRosters(siblings = []) {
  const map = new Map();
  const ordered = [...siblings].sort(
    (a, b) => (b.learnerCount ?? 0) - (a.learnerCount ?? 0)
  );

  for (const cls of ordered) {
    for (const row of cls.students ?? []) {
      const key = studentMergeKey(row);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          ...row,
          term1: gradeNumber(row.term1),
          term2: gradeNumber(row.term2),
          term3: gradeNumber(row.term3),
          final: gradeNumber(row.final),
          termGrade: null,
        });
        continue;
      }
      map.set(key, {
        ...prev,
        studentName:
          prev.studentName && prev.studentName !== "Learner"
            ? prev.studentName
            : row.studentName,
        gender:
          prev.gender && prev.gender !== "—" ? prev.gender : row.gender,
        studentNumber:
          prev.studentNumber && prev.studentNumber !== "—"
            ? prev.studentNumber
            : row.studentNumber,
        term1: prev.term1 ?? gradeNumber(row.term1),
        term2: prev.term2 ?? gradeNumber(row.term2),
        term3: prev.term3 ?? gradeNumber(row.term3),
        final: prev.final ?? gradeNumber(row.final),
      });
    }
  }

  return [...map.values()]
    .map((row) => {
      const hasGrade = [row.term1, row.term2, row.term3, row.final].some(
        (g) => g !== null
      );
      return { ...row, hasGrade, termGrade: null };
    })
    .sort((a, b) => String(a.studentName).localeCompare(String(b.studentName)));
}

/**
 * All Terms: one card per subject family (same SY + grade/section + subject + teacher).
 */
export function groupAcademicRecordClassCards(
  classes = [],
  { groupMultiTerm = true } = {}
) {
  if (!groupMultiTerm) return classes;
  if (!classes.length) return [];

  const groups = new Map();
  for (const cls of classes) {
    const key = classReportFolderKey(cls);
    const list = groups.get(key) ?? [];
    list.push(cls);
    groups.set(key, list);
  }

  const result = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      result.push({
        ...list[0],
        isTermGroup: false,
        relatedClassIds: [list[0].id],
      });
      continue;
    }

    const sorted = [...list].sort(
      (a, b) => (a.quarterNumber ?? 0) - (b.quarterNumber ?? 0)
    );
    const primary = [...sorted].sort(
      (a, b) => (b.learnerCount ?? 0) - (a.learnerCount ?? 0)
    )[0];
    const students = mergeSiblingRosters(sorted);
    const learnerCount = Math.max(
      students.length,
      ...sorted.map((cls) => cls.learnerCount || 0)
    );
    const hasUpload = sorted.some((cls) => cls.hasUpload);
    const gradedCount = students.filter((row) => row.hasGrade).length;

    result.push({
      ...primary,
      students,
      learnerCount,
      gradedCount,
      pendingCount: Math.max(learnerCount - gradedCount, 0),
      hasUpload,
      assignedNoEcr: !hasUpload && learnerCount === 0,
      termLabel: TERM_ALL_LABEL,
      isTermGroup: true,
      relatedClassIds: sorted.map((cls) => cls.id),
    });
  }

  return result.sort((a, b) => {
    const sub = String(a.subject).localeCompare(String(b.subject));
    if (sub !== 0) return sub;
    return String(a.teacherName).localeCompare(String(b.teacherName));
  });
}

function buildGradeFoldersFromClasses(classCatalog = []) {
  const buckets = new Map(
    CANONICAL_GRADE_FOLDERS.map((label) => [
      label,
      {
        grade: label,
        classCount: 0,
        students: 0,
        graded: 0,
        pending: 0,
      },
    ])
  );

  for (const cls of classCatalog) {
    const label = canonicalGradeLabel(cls.gradeLabel);
    if (!label) continue;
    const entry = buckets.get(label) ?? {
      grade: label,
      classCount: 0,
      students: 0,
      graded: 0,
      pending: 0,
    };
    entry.classCount += 1;
    entry.students += cls.learnerCount;
    entry.graded += cls.gradedCount;
    entry.pending += cls.pendingCount;
    buckets.set(label, entry);
  }

  return [...buckets.values()].sort((a, b) => {
    const ga = Number(String(a.grade).replace(/\D/g, "")) || 0;
    const gb = Number(String(b.grade).replace(/\D/g, "")) || 0;
    return ga - gb;
  });
}

/**
 * Academic Records = teacher class lists from ECR (not monitoring risk/ARAL).
 */
export async function buildAcademicRecordsModel({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  schoolYears = [],
  filters = {},
} = {}) {
  const roster = await getCachedBuiltMonitoringRoster(
    {
      classes,
      enrollments,
      grades,
      monitoringRecords,
    },
    {
      schoolYear: filters.schoolYear || null,
      quarter: filters.quarter || null,
    }
  );

  const instructionalSummaries = (roster.classSummaries ?? []).filter(
    isInstructionalTermRow
  );
  const instructionalGrades = (grades ?? []).filter(
    (row) => parseTermNumber(row.quarter) !== 4
  );

  const classCatalog = mapClassCatalog(instructionalSummaries, {
    enrollments,
    grades: instructionalGrades,
  });
  const gradeSummary = buildGradeFoldersFromClasses(classCatalog);
  const { submissions, submissionProgress } = buildTeacherSubmissions(
    instructionalSummaries,
    instructionalGrades
  );
  const recentUploadActivity = buildRecentUploadActivity(
    instructionalSummaries,
    instructionalGrades
  );

  const totalClasses = classCatalog.length;
  const classesWithGrades = classCatalog.filter((c) => c.hasUpload).length;
  const totalEnrollments = classCatalog.reduce(
    (sum, c) => sum + c.learnerCount,
    0
  );
  const pendingCount = classCatalog.reduce((sum, c) => sum + c.pendingCount, 0);
  const emptyAssigned = classCatalog.filter((c) => c.assignedNoEcr).length;
  const teachersWithUploads = submissions.filter(
    (s) => s.uploadStatus === "Uploaded"
  ).length;

  const summaryCards = [
    {
      id: "total-classes",
      label: "Classes",
      value: totalClasses,
      subtext: "Assigned class lists",
      icon: "graduation",
      tone: "green",
    },
    {
      id: "uploaded",
      label: "Records Uploaded",
      value: classesWithGrades,
      subtext: "Classes with ECR grades",
      icon: "upload",
      tone: "green",
    },
    {
      id: "enrollments",
      label: "Class list seats",
      value: totalEnrollments,
      subtext: "Enrollments (not unique)",
      icon: "file",
      tone: "blue",
    },
    {
      id: "pending-validation",
      label: pendingCount > 0 ? "No grades yet" : "Empty term classes",
      value: pendingCount > 0 ? pendingCount : emptyAssigned,
      subtext:
        pendingCount > 0
          ? "Pending ECR cells"
          : "Assigned, no ECR for this term",
      icon: "hourglass",
      tone: "orange",
    },
    {
      id: "recent-uploads",
      label: "Teacher Uploads",
      value: teachersWithUploads,
      subtext: "Teachers with grades",
      icon: "file",
      tone: "blue",
    },
  ];

  const sectionsList = [
    "All Sections",
    ...new Set(classCatalog.map((c) => c.section).filter(Boolean)),
  ].sort((a, b) => {
    if (a === "All Sections") return -1;
    if (b === "All Sections") return 1;
    return String(a).localeCompare(String(b));
  });

  const teachersList = [
    "All Teachers",
    ...new Set(classCatalog.map((c) => c.teacherName).filter(Boolean)),
  ].sort((a, b) => {
    if (a === "All Teachers") return -1;
    if (b === "All Teachers") return 1;
    return String(a).localeCompare(String(b));
  });

  const gradedCount = totalEnrollments - pendingCount;
  const gradedPercent = totalEnrollments
    ? Math.round((gradedCount / totalEnrollments) * 100)
    : 0;
  const pendingPercent = totalEnrollments
    ? Math.round((pendingCount / totalEnrollments) * 100)
    : 0;

  const periodLabel = [
    filters.quarter
      ? QUARTER_OPTIONS.find((q) => q.value === String(filters.quarter))
          ?.label || termLabel(filters.quarter)
      : "All Terms",
    filters.schoolYear || "All School Years",
  ].join(" · ");

  return {
    summaryCards,
    gradeSummary,
    classes: classCatalog,
    students: [],
    filters: {
      sections: sectionsList,
      teachers: teachersList,
    },
    teacherSubmissions: submissions,
    submissionProgress,
    validationSummary: [
      {
        label: "Graded seats",
        value: gradedCount,
        percent: gradedPercent,
        tone: "green",
      },
      {
        label: "No grades yet",
        value: pendingCount,
        percent: pendingPercent,
        tone: "orange",
      },
      {
        label: "Needs Correction",
        value: 0,
        percent: 0,
        tone: "red",
      },
    ],
    validationLastUpdated: new Date().toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    academicAnalysis: {
      status: instructionalGrades.length ? "Completed" : "Waiting",
      lastAnalysis: new Date().toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      recordsProcessed: instructionalGrades.length,
      learnersRequiringIntervention: 0,
    },
    recentUploadActivity,
    periodLabel,
    schoolYears:
      schoolYears.length > 0
        ? schoolYears
        : [
            ...new Set(
              classes
                .map((c) => c.school_year ?? c.schoolYear)
                .filter(Boolean)
            ),
          ].sort((a, b) => String(b).localeCompare(String(a))),
    defaultSchoolYear: pickDefaultSchoolYear(classes, schoolYears),
    meta: {
      classCount: classCatalog.length,
      enrollmentRows: totalEnrollments,
    },
  };
}
