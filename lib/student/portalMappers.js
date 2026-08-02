import recommendationService from "@/lib/services/recommendationService";
import {
  RECOMMENDATION,
  RISK_LEVEL,
  averageFromSubjectGrades,
  weakSubjectsFromGrades,
} from "@/lib/monitoring/recommendations";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { isAralEligibleSubject } from "@/lib/services/recommendation/subjectCapabilities";
import {
  aggregateAttendanceRecords,
  computeAttendanceMetrics,
  monthLabel,
} from "@/lib/attendance/constants";

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

function pickLatestPeriod(grades = [], enrollments = []) {
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
    return { schoolYear: null, quarter: null };
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

function gradeStatus(finalGrade) {
  if (finalGrade === null || finalGrade === undefined) return "No grade";
  return finalGrade < PASSING_GRADE ? "Below 75" : "Passing";
}

/**
 * Merge enrollments with grades so every enrolled subject appears,
 * including those not yet graded.
 */
function buildGradeRows({ enrollments = [], grades = [], periodOnly = false }) {
  const byKey = new Map();

  function rowKey(schoolYear, quarter, classId, subjectName) {
    if (classId) return `${schoolYear}|${quarter}|class:${classId}`;
    return `${schoolYear}|${quarter}|subject:${String(subjectName).toLowerCase()}`;
  }

  for (const e of enrollments) {
    if (!e.schoolYear || !e.quarter) continue;
    const subject = e.subject?.subject_name ?? "Subject";
    const key = rowKey(e.schoolYear, e.quarter, e.classId, subject);
    byKey.set(key, {
      id: `enrollment-${e.classId ?? e.id}`,
      classId: e.classId ?? null,
      subject,
      subjectCode: e.subject?.subject_code ?? null,
      quarter: Number(e.quarter),
      schoolYear: e.schoolYear,
      finalGrade: null,
      status: "No grade",
    });
  }

  for (const g of grades) {
    if (!g.schoolYear || !g.quarter) continue;
    const subject = g.subject?.subject_name ?? "Subject";
    const key = rowKey(g.schoolYear, g.quarter, g.classId, subject);
    const existing = byKey.get(key);
    byKey.set(key, {
      id: g.id ?? existing?.id ?? `grade-${key}`,
      classId: g.classId ?? existing?.classId ?? null,
      subject,
      subjectCode: g.subject?.subject_code ?? existing?.subjectCode ?? null,
      quarter: Number(g.quarter),
      schoolYear: g.schoolYear,
      finalGrade: g.finalGrade,
      status: gradeStatus(g.finalGrade),
    });
  }

  const rows = [...byKey.values()];
  if (periodOnly) {
    return rows.sort((a, b) => a.subject.localeCompare(b.subject));
  }
  return rows.sort((a, b) => {
    if (a.schoolYear !== b.schoolYear) {
      return String(b.schoolYear).localeCompare(String(a.schoolYear));
    }
    if (a.quarter !== b.quarter) return b.quarter - a.quarter;
    return a.subject.localeCompare(b.subject);
  });
}

/**
 * Build student-facing portal view models from portal query payload.
 */
export async function buildStudentPortalView(raw) {
  const student = raw.student;
  const section = student.sections;
  const { schoolYear, quarter } = pickLatestPeriod(raw.grades, raw.enrollments);

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

  const fullName =
    raw.profile?.full_name ||
    [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ");

  return {
    profile: {
      fullName,
      displayName: displayName(student),
      studentNumber: student.student_number,
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
    }),
    allGrades: buildGradeRows({
      enrollments: raw.enrollments ?? [],
      grades: raw.grades ?? [],
      periodOnly: false,
    }),
    interventions: [...aralInterventions, ...remedialInterventions],
    monitoring: latestMonitoring
      ? {
          status: latestMonitoring.monitoring_status,
          interventionGiven: latestMonitoring.intervention_given,
          progress: latestMonitoring.student_progress,
          followUpNeeded: Boolean(latestMonitoring.follow_up_needed),
          observationDate: latestMonitoring.observation_date,
        }
      : null,
    enrollments: periodEnrollments.map((e) => ({
      classId: e.classId,
      subject: e.subject?.subject_name ?? "Subject",
      sectionLabel: formatGradeSection(e.section ?? section),
      schoolYear: e.schoolYear,
      quarter: e.quarter,
    })),
    attendance: (() => {
      const records = raw.attendanceRecords ?? [];
      const summary = aggregateAttendanceRecords(records);
      const history = records.map((row) => {
        const metrics = computeAttendanceMetrics(row);
        return {
          id: row.id,
          schoolYear: row.school_year,
          month: row.month,
          monthName: monthLabel(row.month),
          ...metrics,
        };
      });
      return {
        summary,
        history,
        note: "Attendance is for monitoring only and is not used in academic risk prediction.",
      };
    })(),
  };
}
