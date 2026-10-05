import recommendationService from "@/lib/services/recommendationService";
import {
  RECOMMENDATION,
  RISK_LEVEL,
  averageFromSubjectGrades,
  weakSubjectsFromGrades,
} from "@/lib/monitoring/recommendations";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { isAralEligibleSubject } from "@/lib/services/recommendation/subjectCapabilities";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";
import {
  aggregateAttendanceRecords,
  computeAttendanceMetrics,
  monthLabel,
} from "@/lib/attendance/constants";
import { mergeAttendanceSources } from "@/lib/attendance/studentAttendanceFromDaily";
import { listAralApprovals } from "@/lib/supabase/queries/aralApprovals";
import { listAralAssessmentScoresForStudent } from "@/lib/supabase/queries/aralProgram";
import {
  buildRecordedProgress,
  displayInterventionStatus,
} from "@/lib/monitoring/interventionLifecycle";
import {
  ARAL_APPROVAL_STATUS,
  approvalKey,
  dbStatusToLabel,
} from "@/lib/monitoring/aralApproval";
import { termGradeDescription } from "@/lib/ecr/computeGrades";

function displayName(student) {
  const last = student?.last_name?.trim();
  const first = student?.first_name?.trim();
  const middle = student?.middle_name?.trim();
  if (!last && !first) return "Student";
  if (!middle) return `${last}, ${first}`.trim();
  return `${last}, ${first} ${middle}`.trim();
}

function formatGradeSection(section) {
  if (!section) return "—";
  const grade = section.grade_level ? `Grade ${section.grade_level}` : null;
  const name = section.section_name || null;
  return [grade, name].filter(Boolean).join(" · ") || "—";
}

function pickLatestPeriod(grades = [], enrollments = [], fallbackSchoolYear = "2026-2027") {
  const periods = [];
  for (const g of grades) {
    if (g.schoolYear && g.quarter) {
      periods.push({ schoolYear: g.schoolYear, quarter: Number(g.quarter) });
    }
  }
  for (const e of enrollments) {
    if (e.schoolYear && e.quarter) {
      periods.push({ schoolYear: e.schoolYear, quarter: Number(e.quarter) });
    }
  }
  if (!periods.length) {
    return { schoolYear: fallbackSchoolYear, quarter: 1 };
  }
  periods.sort((a, b) => {
    if (a.schoolYear !== b.schoolYear) {
      return String(b.schoolYear).localeCompare(String(a.schoolYear));
    }
    return b.quarter - a.quarter;
  });
  return periods[0];
}

function riskRank(level) {
  if (level === RISK_LEVEL.HIGH || level === "Priority") return 3;
  if (level === RISK_LEVEL.MODERATE || level === "Moderate") return 2;
  if (level === RISK_LEVEL.LOW || level === "Low") return 1;
  return 0;
}

export function gradeDescriptor(finalGrade) {
  if (finalGrade === null || finalGrade === undefined || finalGrade === "") {
    return "";
  }
  const n = Number(finalGrade);
  if (!Number.isFinite(n)) return "";
  return termGradeDescription(n);
}

function gradeStatus(finalGrade) {
  if (finalGrade === null || finalGrade === undefined || finalGrade === "") {
    return "";
  }
  const n = Number(finalGrade);
  if (!Number.isFinite(n)) return "";
  return n < 75 ? "Below 75" : "Passing";
}

/** Canonical DepEd Junior High School curriculum learning areas for CNHS (Grades 7–10). */
export const CANONICAL_JHS_SUBJECTS = [
  { name: "Filipino", aliases: ["filipino", "fil"] },
  { name: "English", aliases: ["english", "eng"] },
  { name: "Mathematics", aliases: ["mathematics", "math", "maths"] },
  { name: "Science", aliases: ["science", "sci"] },
  { name: "Araling Panlipunan", aliases: ["araling panlipunan", "ap", "aralpan"] },
  {
    name: "ESP / Values Education",
    aliases: [
      "esp / values education",
      "values education / esp",
      "values education",
      "values_education",
      "values",
      "ve",
      "esp",
      "edukasyon sa pagpapakatao",
    ],
  },
  {
    name: "TLE",
    aliases: [
      "tle",
      "technology and livelihood education",
      "technology & livelihood education",
    ],
  },
  { name: "MAPEH", aliases: ["mapeh"] },
];

export function findCanonicalSubject(subjectName = "") {
  const clean = String(subjectName || "").trim().toLowerCase();
  for (const item of CANONICAL_JHS_SUBJECTS) {
    if (item.aliases.includes(clean) || clean === item.name.toLowerCase()) {
      return item.name;
    }
  }
  return null;
}

/**
 * Merge enrollments with grades and canonical curriculum subjects so every
 * assigned subject appears, including those not yet graded.
 * Ungraded subjects have finalGrade: null, status: "", descriptor: "".
 */
function buildGradeRows({
  enrollments = [],
  grades = [],
  periodOnly = false,
  targetSchoolYear = null,
  targetQuarter = null,
  defaultSchoolYear = "2026-2027",
  defaultQuarter = 1,
}) {
  const periodKeys = new Set();
  const periods = [];

  function addPeriod(sy, q) {
    if (!sy || q == null || q === "") return;
    const numQ = Number(q);
    if (!Number.isFinite(numQ)) return;
    const key = `${sy}|${numQ}`;
    if (!periodKeys.has(key)) {
      periodKeys.add(key);
      periods.push({ schoolYear: sy, quarter: numQ });
    }
  }

  if (periodOnly && targetSchoolYear && targetQuarter != null) {
    addPeriod(targetSchoolYear, targetQuarter);
  } else {
    for (const g of grades) {
      if (g.schoolYear && g.quarter) addPeriod(g.schoolYear, g.quarter);
    }
    for (const e of enrollments) {
      if (e.schoolYear && e.quarter) addPeriod(e.schoolYear, e.quarter);
    }
    if (!periods.length) {
      addPeriod(targetSchoolYear || defaultSchoolYear, targetQuarter || defaultQuarter);
    }
  }

  const allRows = [];

  for (const { schoolYear, quarter } of periods) {
    const periodGrades = grades.filter(
      (g) => g.schoolYear === schoolYear && Number(g.quarter) === quarter
    );
    const periodEnrollments = enrollments.filter(
      (e) => e.schoolYear === schoolYear && Number(e.quarter) === quarter
    );

    const gradeBySubject = new Map();
    for (const g of periodGrades) {
      const rawName = g.subject?.subject_name ?? "Subject";
      const canonical = findCanonicalSubject(rawName);
      const key = canonical ? canonical.toLowerCase() : rawName.toLowerCase();
      gradeBySubject.set(key, g);
    }

    const enrollmentBySubject = new Map();
    for (const e of periodEnrollments) {
      const rawName = e.subject?.subject_name ?? "Subject";
      const canonical = findCanonicalSubject(rawName);
      const key = canonical ? canonical.toLowerCase() : rawName.toLowerCase();
      enrollmentBySubject.set(key, e);
    }

    const orderedSubjects = CANONICAL_JHS_SUBJECTS.map((item) => item.name);

    const nonCanonicalSubjects = new Set();
    for (const g of periodGrades) {
      const rawName = g.subject?.subject_name ?? "Subject";
      if (!findCanonicalSubject(rawName)) {
        nonCanonicalSubjects.add(rawName);
      }
    }
    for (const e of periodEnrollments) {
      const rawName = e.subject?.subject_name ?? "Subject";
      if (!findCanonicalSubject(rawName)) {
        nonCanonicalSubjects.add(rawName);
      }
    }
    for (const extra of [...nonCanonicalSubjects].sort((a, b) => a.localeCompare(b))) {
      orderedSubjects.push(extra);
    }

    for (const subjectName of orderedSubjects) {
      const canonical = findCanonicalSubject(subjectName);
      const key = canonical ? canonical.toLowerCase() : subjectName.toLowerCase();
      const grade = gradeBySubject.get(key);
      const enrollment = enrollmentBySubject.get(key);

      const hasGrade =
        grade?.finalGrade !== null &&
        grade?.finalGrade !== undefined &&
        grade?.finalGrade !== "" &&
        Number.isFinite(Number(grade.finalGrade));
      const finalGrade = hasGrade ? Number(grade.finalGrade) : null;

      const descriptor = hasGrade ? termGradeDescription(finalGrade) : "";
      const status = hasGrade
        ? finalGrade < 75
          ? "Below 75"
          : "Passing"
        : "";

      allRows.push({
        id:
          grade?.id ??
          (enrollment?.id
            ? `enrollment-${enrollment.classId ?? enrollment.id}`
            : `subj-${schoolYear}-${quarter}-${subjectName.replace(/\s+/g, "_")}`),
        classId: grade?.classId ?? enrollment?.classId ?? null,
        subject: subjectName,
        subjectCode:
          grade?.subject?.subject_code ??
          enrollment?.subject?.subject_code ??
          null,
        quarter,
        schoolYear,
        finalGrade,
        status,
        descriptor,
      });
    }
  }

  const canonicalOrderMap = new Map();
  CANONICAL_JHS_SUBJECTS.forEach((item, idx) => {
    canonicalOrderMap.set(item.name.toLowerCase(), idx);
  });

  return allRows.sort((a, b) => {
    if (a.schoolYear !== b.schoolYear) {
      return String(b.schoolYear).localeCompare(String(a.schoolYear));
    }
    if (a.quarter !== b.quarter) {
      return b.quarter - a.quarter;
    }
    const orderA = canonicalOrderMap.has(a.subject.toLowerCase())
      ? canonicalOrderMap.get(a.subject.toLowerCase())
      : 100;
    const orderB = canonicalOrderMap.has(b.subject.toLowerCase())
      ? canonicalOrderMap.get(b.subject.toLowerCase())
      : 100;
    if (orderA !== orderB) return orderA - orderB;
    return a.subject.localeCompare(b.subject);
  });
}

/**
 * Build student-facing portal view models from portal query payload.
 */
export async function buildStudentPortalView(
  raw,
  { skipRecommendations = false } = {}
) {
  const student = raw.student;
  const section = student.sections;
  const fallbackSchoolYear = section?.school_year || "2026-2027";
  const { schoolYear, quarter } = pickLatestPeriod(
    raw.grades,
    raw.enrollments,
    fallbackSchoolYear
  );

  const periodGrades = (raw.grades ?? []).filter((g) => {
    if (schoolYear && g.schoolYear !== schoolYear) return false;
    if (quarter && Number(g.quarter) !== Number(quarter)) return false;
    return true;
  });

  const subjectGradesForEngine = periodGrades.map((g) => ({
    subject: g.subject?.subject_name ?? "Subject",
    grade: g.finalGrade,
  }));

  const aralInterventions = [];
  const periodEnrollments = (raw.enrollments ?? []).filter((e) => {
    if (schoolYear && e.schoolYear !== schoolYear) return false;
    if (quarter && Number(e.quarter) !== Number(quarter)) return false;
    return true;
  });

  let topRisk = RISK_LEVEL.LOW;
  let topRecommendation = RECOMMENDATION.NONE;
  let topConfidence = 0;
  const allReasons = [];

  const aralEnrollments = periodEnrollments.filter((e) =>
    isAralEligibleSubject(e.subject?.subject_name)
  );
  const shouldPredict =
    aralEnrollments.length > 0 || subjectGradesForEngine.length > 0;

  if (!skipRecommendations) {
    if (aralEnrollments.length) {
    for (const enrollment of aralEnrollments) {
      const subjectName = enrollment.subject?.subject_name ?? null;
      const recommendation = await recommendationService.generate({
        id: student.id,
        subjectGrades: subjectGradesForEngine,
        classSubject: subjectName,
        schoolYear,
        quarter,
        classId: enrollment.classId,
      });

      if (riskRank(recommendation.riskLevel) > riskRank(topRisk)) {
        topRisk = recommendation.riskLevel;
        topRecommendation = recommendation.recommendationType;
        topConfidence = recommendation.confidence;
      }
      allReasons.push(...(recommendation.reasons ?? []));

      if (recommendation.recommendationType === RECOMMENDATION.ARAL) {
        const ownGrade = periodGrades.find(
          (g) =>
            g.classId === enrollment.classId ||
            g.subject?.subject_name?.toLowerCase() === subjectName.toLowerCase()
        );
        aralInterventions.push({
          id: `aral-${enrollment.classId}`,
          type: "ARAL Learners",
          subject: subjectName,
          sectionLabel: formatGradeSection(enrollment.section ?? section),
          grade: ownGrade?.finalGrade ?? null,
          riskLevel: recommendation.riskLevel,
          confidence: recommendation.confidence,
          reasons: recommendation.reasons ?? [],
          scope: "student",
          classId: enrollment.classId,
          explanation:
            "You are recommended for ARAL Learners based on your English/Filipino performance.",
        });
      }
    }
  } else if (subjectGradesForEngine.length) {
    const recommendation = await recommendationService.generate({
      id: student.id,
      subjectGrades: subjectGradesForEngine,
      schoolYear,
      quarter,
    });
    topRisk = recommendation.riskLevel;
    topRecommendation = recommendation.recommendationType;
    topConfidence = recommendation.confidence;
    allReasons.push(...(recommendation.reasons ?? []));

    if (recommendation.recommendationType === RECOMMENDATION.ARAL) {
      const weakLang = weakSubjectsFromGrades(
        subjectGradesForEngine.map((s) => ({
          subjectName: s.subject,
          finalGrade: s.grade,
        }))
      ).filter((name) => isAralEligibleSubject(name));

      for (const subjectName of weakLang) {
        aralInterventions.push({
          id: `aral-${subjectName}`,
          type: "ARAL Learners",
          subject: subjectName,
          sectionLabel: formatGradeSection(section),
          grade:
            periodGrades.find(
              (g) =>
                g.subject?.subject_name?.toLowerCase() ===
                subjectName.toLowerCase()
            )?.finalGrade ?? null,
          riskLevel: recommendation.riskLevel,
          confidence: recommendation.confidence,
          reasons: recommendation.reasons ?? [],
          scope: "student",
          explanation:
            "You are recommended for ARAL Learners based on your English/Filipino performance.",
        });
      }
    }
  }
  } else if (shouldPredict) {
    // ECR shell while RF loads — show grade-band risk + Eng/Fil ARAL rules ASAP.
    const gwa = averageFromSubjectGrades(
      subjectGradesForEngine.map((s) => ({
        subject: s.subject,
        grade: s.grade,
      }))
    );
    topRisk =
      gwa === null || gwa === undefined ? "—" : riskLevelFromGrade(gwa);

    for (const enrollment of aralEnrollments) {
      const subjectName = enrollment.subject?.subject_name ?? null;
      const ownGrade = periodGrades.find(
        (g) =>
          g.classId === enrollment.classId ||
          g.subject?.subject_name?.toLowerCase() ===
            String(subjectName ?? "").toLowerCase()
      );
      const gradeValue =
        ownGrade?.finalGrade !== null && ownGrade?.finalGrade !== undefined
          ? Number(ownGrade.finalGrade)
          : null;
      if (
        gradeValue !== null &&
        Number.isFinite(gradeValue) &&
        gradeValue < PASSING_GRADE
      ) {
        aralInterventions.push({
          id: `aral-shell-${enrollment.classId}`,
          type: "ARAL Learners",
          subject: subjectName,
          sectionLabel: formatGradeSection(enrollment.section ?? section),
          grade: gradeValue,
          riskLevel: riskLevelFromGrade(gradeValue),
          confidence: null,
          reasons: ["Grade-band estimate; RF prediction pending."],
          scope: "student",
          classId: enrollment.classId,
          explanation:
            "You may be recommended for ARAL Learners based on your English/Filipino grade. Final recommendation updates shortly.",
        });
        topRecommendation = RECOMMENDATION.ARAL;
      }
    }
  }

  const remedialInterventions = (raw.classroomRemedial ?? [])
    .filter((row) => row.recommended)
    .filter((row) => {
      if (schoolYear && row.school_year !== schoolYear) return false;
      if (quarter && Number(row.quarter) !== Number(quarter)) return false;
      return true;
    })
    .map((row) => ({
      id: `remedial-${row.class_id}`,
      type: "Classroom Remedial",
      subject: row.subject_name,
      sectionLabel: `Grade ${row.grade_level} · ${row.section_name}`,
      grade: null,
      riskLevel: RISK_LEVEL.MODERATE,
      confidence: null,
      reasons: [
        `${Math.round(Number(row.below_passing_rate || 0) * 100)}% of graded learners in this class are below ${PASSING_GRADE}.`,
      ],
      scope: "class",
      explanation:
        "Classroom Remedial is recommended for your class in this subject. This is a class support plan, not only for you.",
    }));

  if (
    !skipRecommendations &&
    aralInterventions.length &&
    student?.id &&
    schoolYear &&
    quarter
  ) {
    const approvals = await listAralApprovals({
      schoolYear,
      quarter,
      studentIds: [student.id],
    });
    const map = approvals.data ?? new Map();
    for (const item of aralInterventions) {
      if (!item.classId) {
        item.approvalStatus = ARAL_APPROVAL_STATUS.SUGGESTED;
        continue;
      }
      const row =
        map.get(approvalKey(student.id, item.classId, schoolYear, quarter)) ||
        map.get(`${student.id}:${item.classId}`);
      item.approvalStatus = dbStatusToLabel(row?.status);
      item.approvalNote = row?.review_note ?? null;
      if (item.approvalStatus === ARAL_APPROVAL_STATUS.APPROVED) {
        item.explanation =
          "Your ARAL Learners recommendation was reviewed and approved by the Principal. Talk to your teacher for next steps.";
      }
    }
  }

  if (
    remedialInterventions.length &&
    riskRank(RISK_LEVEL.MODERATE) > riskRank(topRisk)
  ) {
    topRisk = RISK_LEVEL.MODERATE;
  }

  const weakSubjects = weakSubjectsFromGrades(
    periodGrades.map((g) => ({
      subjectName: g.subject?.subject_name ?? "Subject",
      finalGrade: g.finalGrade,
    }))
  );

  const average = averageFromSubjectGrades(
    periodGrades.map((g) => ({ finalGrade: g.finalGrade }))
  );

  const latestMonitoring = (raw.monitoringRecords ?? [])[0] ?? null;

  let recordedProgress = null;
  if (!skipRecommendations && student?.id) {
    const scoreResult = await listAralAssessmentScoresForStudent(student.id);
    if (!scoreResult.error) {
      recordedProgress = buildRecordedProgress(scoreResult.data ?? []);
    }
  }

  const fullName =
    raw.profile?.full_name ||
    [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ");

  return {
    student,
    profile: {
      firstName: student.first_name || null,
      lastName: student.last_name || null,
      fullName,
      displayName: displayName(student),
      studentNumber: student.student_number,
      gradeLevel: section?.grade_level ? `Grade ${section.grade_level}` : null,
      sectionName: section?.section_name || null,
      gradeSection: formatGradeSection(section),
      schoolYear: section?.school_year ?? schoolYear ?? "—",
      status: student.status ?? "active",
      sex: student.sex ?? null,
      birthdate: student.birthdate ?? null,
    },
    period: { schoolYear, quarter },
    summary: {
      average,
      riskLevel: topRisk,
      recommendation: topRecommendation,
      confidence: topConfidence,
      weakSubjects,
      activeInterventionCount:
        aralInterventions.length + remedialInterventions.length,
      passingGrade: PASSING_GRADE,
      reasons: [...new Set(allReasons)].slice(0, 4),
    },
    grades: buildGradeRows({
      enrollments: periodEnrollments,
      grades: periodGrades,
      periodOnly: true,
      targetSchoolYear: schoolYear,
      targetQuarter: quarter,
      defaultSchoolYear: fallbackSchoolYear,
      defaultQuarter: quarter || 1,
    }),
    allGrades: buildGradeRows({
      enrollments: raw.enrollments ?? [],
      grades: raw.grades ?? [],
      periodOnly: false,
      targetSchoolYear: schoolYear,
      targetQuarter: quarter,
      defaultSchoolYear: fallbackSchoolYear,
      defaultQuarter: quarter || 1,
    }),
    interventions: [...aralInterventions, ...remedialInterventions],
    monitoring: latestMonitoring
      ? {
          status: displayInterventionStatus(latestMonitoring.monitoring_status),
          interventionGiven: latestMonitoring.intervention_given,
          progress: latestMonitoring.student_progress,
          evaluation: latestMonitoring.progress_evaluation || null,
          nextAction: latestMonitoring.next_action || null,
          followUpNeeded: Boolean(latestMonitoring.follow_up_needed),
          observationDate: latestMonitoring.observation_date,
        }
      : null,
    recordedProgress,
    enrollments: periodEnrollments.map((e) => ({
      classId: e.classId,
      subject: e.subject?.subject_name ?? "Subject",
      sectionLabel: formatGradeSection(e.section ?? section),
      schoolYear: e.schoolYear,
      quarter: e.quarter,
    })),
    attendance: (() => {
      const records = mergeAttendanceSources(
        raw.attendanceRecords ?? [],
        raw.attendanceDaily ?? []
      );
      const summary = aggregateAttendanceRecords(records);
      const history = records.map((row) => {
        const metrics = computeAttendanceMetrics(row);
        return {
          id: row.id,
          schoolYear: row.school_year,
          month: row.month,
          monthName: monthLabel(row.month),
          source: row.source ?? "monthly",
          ...metrics,
        };
      });
      return {
        summary,
        history,
        note: "Attendance is for monitoring only and is not used in academic risk prediction.",
      };
    })(),
    releasedSf9: raw.releasedSf9 ?? null,
  };
}
