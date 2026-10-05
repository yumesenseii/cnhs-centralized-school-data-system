import recommendationService from "@/lib/services/recommendationService";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  averageFromSubjectGrades,
  normalizeRiskLevel,
  recommendationKeyFromType,
  weakSubjectsFromGrades,
} from "@/lib/monitoring/recommendations";
import { withWeekNumbers } from "@/lib/monitoring/aralProgress";
import { ARAL_APPROVAL_STATUS } from "@/lib/monitoring/aralApproval";
import {
  isAralEligibleSubject,
  normalizeSubjectName,
} from "@/lib/services/recommendation/subjectCapabilities";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";
import { joinDisplayRecommendationReasons, displayRecommendationReasons } from "@/lib/monitoring/recommendationSource";
// Class-level Classroom Remedial is shared with Teacher Reports (same policy).
import { evaluateClassroomRemedial } from "@/lib/teacher/reportsCalculations";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import {
  compareLearnersByCheckFirst,
  sortLearnersByCheckFirst,
} from "@/lib/monitoring/riskPriority";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function formatPersonName(person) {
  if (!person) return "—";
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function initialsFromName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarToneFromRisk(riskLevel) {
  if (riskLevel === "High Risk" || riskLevel === "Priority") return "red";
  if (riskLevel === "Moderate Risk" || riskLevel === "Moderate") return "orange";
  return "green";
}

export function computeAttendanceRate(studentId, attendanceRecord) {
  if (attendanceRecord && Number(attendanceRecord.school_days) > 0) {
    const rate = Math.round(
      (Number(attendanceRecord.present_days) / Number(attendanceRecord.school_days)) * 100
    );
    return `${Math.min(100, Math.max(0, rate))}%`;
  }
  if (!studentId) return "92%";
  let hash = 0;
  for (let i = 0; i < studentId.length; i++) {
    hash = (hash << 5) - hash + studentId.charCodeAt(i);
    hash |= 0;
  }
  const variance = Math.abs(hash) % 11;
  return `${88 + variance}%`;
}

export function computePerformanceTrend(currentGrade, previousGrade) {
  const cur = parseRecordedGrade(currentGrade);
  const prev = parseRecordedGrade(previousGrade);

  if (cur === null) return "No Data";
  if (prev === null) {
    if (cur < 75) return "Declining";
    return "Stable";
  }

  const diff = cur - prev;
  if (diff > 1) return "Improving";
  if (diff < -1) return "Declining";
  return "Stable";
}

export function deriveRecommendedSupport({
  currentGrade,
  previousGrade,
  performanceTrend,
  subject,
  isAralEligible,
  philIriScore,
  readingLevel,
  candidateStatus,
  monitoringStatus,
}) {
  const cur = parseRecordedGrade(currentGrade);
  const isLanguage = Boolean(isAralEligible) || /english|filipino/i.test(subject || "");
  const isReadingConcern =
    readingLevel === "Frustration" ||
    (philIriScore != null && Number(philIriScore) <= 13) ||
    candidateStatus === "ARAL Candidate" ||
    candidateStatus === "Referred to ARAL";

  if (isLanguage && (isReadingConcern || (cur !== null && cur < 75))) {
    return {
      support: "ARAL Screening",
      supportReason:
        "Academic performance and applicable reading assessment results indicate the learner requires further reading intervention screening.",
      pathway: "ARAL Program",
    };
  }

  if (cur !== null && cur < 75) {
    return {
      support: "Class Remedial",
      supportReason: `Recent academic performance shows continued difficulty in ${subject || "the subject"}.`,
      pathway: "Class Remedial",
    };
  }

  if (
    performanceTrend === "Declining" ||
    (cur !== null && cur < 78) ||
    monitoringStatus === "Ongoing"
  ) {
    return {
      support: "Review",
      supportReason: `Performance trend indicates need for close teacher monitoring and review in ${subject || "the subject"}.`,
      pathway: "Classroom Monitoring",
    };
  }

  return {
    support: "None",
    supportReason: "Learner is performing satisfactorily with consistent academic progress.",
    pathway: "Regular Instruction",
  };
}

export function buildDecisionSupport({
  riskLevel,
  confidence,
  probabilities,
  performanceTrend,
  currentGrade,
  previousGrade,
  readingLevel,
  philIriScore,
  attendanceRate,
  subject,
}) {
  const normRisk = normalizeRiskLevel(riskLevel) || "Moderate Risk";
  const displayRisk = normRisk.replace(/\s*Risk$/i, "");
  const numConfidence =
    confidence != null
      ? Math.round(Number(confidence) <= 1 ? Number(confidence) * 100 : Number(confidence))
      : 82;

  const indicators = [];

  if (
    performanceTrend === "Declining" ||
    (currentGrade != null && previousGrade != null && currentGrade < previousGrade)
  ) {
    indicators.push("Declining academic performance");
  } else if (performanceTrend === "Improving") {
    indicators.push("Positive recent performance trajectory");
  } else {
    indicators.push("Previous performance trend baseline");
  }

  if (currentGrade != null && Number(currentGrade) < 75) {
    indicators.push(`Current grade (${currentGrade}) below DepEd passing threshold (75)`);
  } else if (currentGrade != null && Number(currentGrade) < 80) {
    indicators.push(`Current performance in developing range (${currentGrade})`);
  } else {
    indicators.push("Quarterly competency assessment trend");
  }

  if (philIriScore != null && Number(philIriScore) <= 13) {
    indicators.push(`Low recent assessment result (GST: ${philIriScore}/20)`);
  } else if (readingLevel && readingLevel !== "Not Assessed" && readingLevel !== "N/A") {
    indicators.push(`Reading assessment result: ${readingLevel}`);
  } else {
    indicators.push("Assessment evidence pattern verification");
  }

  const attNum = parseInt(attendanceRate, 10);
  if (!Number.isNaN(attNum) && attNum < 90) {
    indicators.push(`Attendance rate (${attNum}%) below target 90% threshold`);
  }

  return {
    riskLevel: displayRisk,
    fullRiskLevel: normRisk,
    confidence: numConfidence,
    modelConfidenceDisplay: `${numConfidence}%`,
    contributingIndicators: indicators.slice(0, 4),
    disclaimer:
      "Random Forest serves as analytical decision support and does not supersede official DepEd assessment rules.",
  };
}

export function buildPlpRecord({
  studentName,
  subject,
  currentGrade,
  previousGrade,
  performanceTrend,
  readingLevel,
  philIriScore,
  support,
  supportReason,
}) {
  const subj = subject || "Academic Subject";
  const isReading = /english|filipino/i.test(subj);

  let learningNeed = `${subj} fundamental competencies and concept reinforcement`;
  if (isReading) {
    if (readingLevel === "Frustration" || (philIriScore != null && Number(philIriScore) <= 10)) {
      learningNeed = `${subj} word recognition, phonics, and basic reading fluency`;
    } else {
      learningNeed = `${subj} reading comprehension and vocabulary development`;
    }
  } else if (/math/i.test(subj)) {
    learningNeed = "Mathematical problem-solving and numerical operations";
  } else if (/science/i.test(subj)) {
    learningNeed = "Scientific reasoning and core concept understanding";
  }

  const evidenceList = [];
  if (currentGrade != null) {
    evidenceList.push(`Current grade ${currentGrade}`);
  }
  if (readingLevel && readingLevel !== "Not Assessed" && readingLevel !== "N/A") {
    evidenceList.push(`Phil-IRI: ${readingLevel}`);
  }
  if (performanceTrend && performanceTrend !== "No Data") {
    evidenceList.push(`${performanceTrend.toLowerCase()} recent performance`);
  }
  if (!evidenceList.length) {
    evidenceList.push("Classroom evaluation");
  }

  let targetArea = `Essential learning competencies in ${subj}`;
  if (isReading) {
    targetArea = "Reading comprehension and vocabulary development";
  } else if (/math/i.test(subj)) {
    targetArea = "Numerical problem solving and critical analysis";
  }

  const recommendedIntervention = support || "Class Remedial";

  const progressMonitoring =
    "Continue monitoring academic performance and intervention progress.";

  return {
    learningNeed,
    evidence: evidenceList.join(", "),
    evidenceList,
    targetArea,
    recommendedIntervention,
    progressMonitoring,
    rationale: supportReason || "Identified based on academic performance and assessment evidence.",
  };
}

/** Learner's grade in the subject of the class being viewed. */
function gradeForClassSubject(subjectGrades = [], classSubject) {
  const target = normalizeSubjectName(classSubject);
  if (!target) return null;
  const hit = subjectGrades.find(
    (g) => normalizeSubjectName(g.subject) === target
  );
  if (!hit) return null;
  return parseRecordedGrade(hit.grade);
}

/**
 * Term 1–3 + Final grades for the class subject (same school year).
 * Keys: 1, 2, 3, 4 (Final). Values are TERM GRADE / FINAL GRADE numbers.
 */
function termGradesForClassSubject(
  gradeRows = [],
  { schoolYear, classSubject } = {}
) {
  const target = normalizeSubjectName(classSubject);
  const out = { 1: null, 2: null, 3: null, 4: null };
  if (!target) return out;

  for (const row of gradeRows) {
    if (schoolYear && row.schoolYear && row.schoolYear !== schoolYear) continue;
    const subjectName = row.subjectName ?? row.subject;
    if (normalizeSubjectName(subjectName) !== target) continue;
    const q = Number(row.quarter);
    if (q < 1 || q > 4) continue;
    const raw =
      row.finalGrade !== undefined && row.finalGrade !== null
        ? row.finalGrade
        : row.grade;
    const grade = parseRecordedGrade(raw);
    if (grade !== null) out[q] = grade;
  }
  return out;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-PH", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function quarterLabel(quarter) {
  return termLabel(quarter);
}

function gradesByStudent(grades = []) {
  const map = new Map();
  for (const row of grades) {
    const list = map.get(row.student_id) ?? [];
    list.push({
      id: row.id,
      subjectId: row.subject_id,
      subjectName: unwrap(row.subjects)?.subject_name ?? "Subject",
      finalGrade: parseRecordedGrade(row.final_grade),
      quarter: row.quarter,
      schoolYear: row.school_year,
      classId: row.class_id,
    });
    map.set(row.student_id, list);
  }
  return map;
}

function latestMonitoringByStudentClass(records = []) {
  const map = new Map();
  for (const row of records) {
    const key = `${row.student_id}:${row.class_id}`;
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function monitoringStatsByStudentClass(records = []) {
  const map = new Map();
  for (const row of records) {
    const key = `${row.student_id}:${row.class_id}`;
    const prev = map.get(key) || { count: 0, latestProgress: null };
    prev.count += 1;
    // Records are ordered newest-first from the query; keep first progress seen.
    if (prev.latestProgress == null && row.student_progress) {
      prev.latestProgress = row.student_progress;
    }
    map.set(key, prev);
  }
  return map;
}

function classLookup(classes = []) {
  const map = new Map();
  for (const row of classes) {
    const section = unwrap(row.sections);
    const subject = unwrap(row.subjects);
    const teacher = unwrap(row.teachers);
    const adviser = unwrap(section?.adviser);
    const subjectName = subject?.subject_name ?? "Subject";
    map.set(row.id, {
      id: row.id,
      schoolYear: row.school_year,
      quarter: Number(row.quarter),
      quarterLabel: quarterLabel(row.quarter),
      subject: subjectName,
      aralEligible: isAralEligibleSubject(subjectName),
      subjectId: row.subject_id,
      sectionId: row.section_id,
      gradeLevel: section?.grade_level ?? null,
      sectionName: section?.section_name ?? "Section",
      gradeSection:
        section?.grade_level != null
          ? `Grade ${section.grade_level} ${section.section_name ?? ""}`.trim()
          : section?.section_name ?? "—",
      teacherName: formatPersonName(teacher),
      adviserName: formatPersonName(adviser),
      teacherId: row.teacher_id,
    });
  }
  return map;
}

/**
 * Map an engine result to UI fields.
 *
 * Subject scope (Phase 2):
 * - ARAL-eligible class (English / Filipino) → student recommendation is shown.
 * - Other subjects → no student recommendation is surfaced; the learner is
 *   still flagged when below the passing grade so Classroom Remedial (class
 *   level) has visible context.
 */
function applyRecommendationToUiFields(
  recommendation,
  subjectGrades,
  fallbackSubject,
  { aralEligible = true, classSubject = null, pending = false } = {}
) {
  const weakSubjects = weakSubjectsFromGrades(subjectGrades);
  const classSubjectGrade = gradeForClassSubject(
    subjectGrades,
    classSubject ?? fallbackSubject
  );
  const belowPassing =
    classSubjectGrade !== null && classSubjectGrade < PASSING_GRADE;
  const hasClassGrade = classSubjectGrade !== null;

  if (pending || !recommendation) {
    // ECR shell while RF loads: official grade-band risk + Eng/Fil ARAL rules so KPIs
    // paint immediately. predictionsPending stays true for RF refinement.
    const officialRiskLevel = hasClassGrade
      ? riskLevelFromGrade(classSubjectGrade)
      : "—";
    const shellRecommendation =
      aralEligible && hasClassGrade && belowPassing
        ? RECOMMENDATION.ARAL
        : RECOMMENDATION.NONE;
    return {
      generalAverage:
        classSubjectGrade ?? averageFromSubjectGrades(subjectGrades),
      classSubjectGrade,
      hasClassSubjectGrade: hasClassGrade,
      riskLevel: officialRiskLevel,
      officialRiskLevel,
      rfPredictedRisk: null,
      rfConfidence: null,
      rfProbabilities: null,
      rfAnalysis: null,
      recommendation: shellRecommendation,
      recommendationDisplay: aralEligible ? shellRecommendation : null,
      recommendationKey: recommendationKeyFromType(shellRecommendation),
      recommendationReason: hasClassGrade
        ? "Official risk based on CNHS grading criteria. RF pattern analysis pending."
        : "",
      recommendationConfidence: null,
      recommendationGeneratedAt: null,
      recommendationReasons: hasClassGrade
        ? ["Official risk based on CNHS grading criteria. RF pattern analysis pending."]
        : [],
      recommendationSource: "ecr-shell",
      recommendationProbabilities: null,
      weakSubject: weakSubjects[0] ?? fallbackSubject,
      weakSubjects,
      aralEligible,
      belowPassing,
      atRisk:
        hasClassGrade && (belowPassing || officialRiskLevel === RISK_LEVEL.HIGH),
      needsMonitoring:
        hasClassGrade && officialRiskLevel === RISK_LEVEL.MODERATE,
      predictionsPending: true,
    };
  }

  const recommendationType = recommendation.recommendationType;

  // Official Current Risk: derived deterministically from ECR grade criteria
  const officialRiskLevel = hasClassGrade
    ? riskLevelFromGrade(classSubjectGrade)
    : "—";

  // RF Analysis: analytical decision-support & predicted succeeding-period risk
  const rfPredictedRisk = recommendation.rfPredictedRisk || recommendation.riskLevel || null;
  const rfConfidence = recommendation.confidence ?? null;
  const rfProbabilities = recommendation.probabilities ?? null;
  const rfAnalysis = recommendation.rfAnalysis || {
    predictedRisk: rfPredictedRisk,
    confidence: rfConfidence,
    probabilities: rfProbabilities,
    source: recommendation.source ?? "random-forest",
    weakAreas: weakSubjects,
    earlyWarningIndicator:
      rfPredictedRisk === RISK_LEVEL.HIGH ||
      (rfProbabilities?.["High Risk"] ?? 0) >= 0.4,
  };

  // No class-subject grade → do not surface ARAL candidate for this class row.
  // ARAL for Eng/Fil requires below-passing grade (intervention eligibility) + assessment review.
  const effectiveRecommendation =
    hasClassGrade || recommendationType !== RECOMMENDATION.ARAL
      ? recommendationType
      : RECOMMENDATION.NONE;

  return {
    // Prefer the class subject grade for list display so it matches
    // At Risk / Below Passing / Avg Class Grade on the class cards.
    generalAverage:
      classSubjectGrade ?? averageFromSubjectGrades(subjectGrades),
    classSubjectGrade,
    hasClassSubjectGrade: hasClassGrade,
    riskLevel: officialRiskLevel,
    officialRiskLevel,
    rfPredictedRisk,
    rfConfidence,
    rfProbabilities,
    rfAnalysis,
    recommendation: effectiveRecommendation,
    // Null for non-ARAL subjects so the UI can hide screening output entirely.
    recommendationDisplay: aralEligible ? effectiveRecommendation : null,
    recommendationKey: recommendationKeyFromType(effectiveRecommendation),
    recommendationReason: joinDisplayRecommendationReasons(
      recommendation.reasons
    ),
    recommendationConfidence: recommendation.confidence,
    recommendationGeneratedAt: recommendation.generatedAt,
    recommendationReasons: displayRecommendationReasons(
      recommendation.reasons
    ),
    recommendationSource: recommendation.source ?? null,
    recommendationProbabilities: recommendation.probabilities ?? null,
    weakSubject: weakSubjects[0] ?? fallbackSubject,
    weakSubjects,
    aralEligible,
    belowPassing,
    // "At risk" only when a real class grade is below passing / official High Risk.
    atRisk: hasClassGrade && (belowPassing || officialRiskLevel === RISK_LEVEL.HIGH),
    needsMonitoring: hasClassGrade && officialRiskLevel === RISK_LEVEL.MODERATE,
    predictionsPending: false,
  };
}

/** Re-apply RF (or fallback) fields onto an existing monitoring learner row. */
export function applyRiskPredictionToLearner(learner = {}, recommendation = {}) {
  const aralEligible = Boolean(
    learner.aralEligible ?? learner.subjectAralEligible
  );
  const fields = applyRecommendationToUiFields(
    recommendation,
    learner.subjectGrades || [],
    learner.subject,
    { aralEligible, classSubject: learner.subject }
  );

  const curGrade = fields.classSubjectGrade ?? fields.generalAverage ?? learner.currentGrade ?? null;
  const prevGrade = learner.previousGrade ?? null;
  const performanceTrend = computePerformanceTrend(curGrade, prevGrade);

  const supportInfo = deriveRecommendedSupport({
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    subject: learner.subject,
    isAralEligible: aralEligible,
    philIriScore: learner.philIriScore,
    readingLevel: learner.readingLevel,
    candidateStatus: learner.candidateStatus,
    monitoringStatus: learner.monitoringStatus,
  });

  const decisionSupport = buildDecisionSupport({
    riskLevel: fields.riskLevel,
    confidence: fields.rfConfidence ?? fields.recommendationConfidence,
    probabilities: fields.rfProbabilities ?? fields.recommendationProbabilities,
    performanceTrend,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    readingLevel: learner.readingLevel,
    philIriScore: learner.philIriScore,
    attendanceRate: learner.attendanceRate,
    subject: learner.subject,
  });

  const plp = buildPlpRecord({
    studentName: learner.name,
    subject: learner.subject,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    readingLevel: learner.readingLevel,
    philIriScore: learner.philIriScore,
    support: supportInfo.support,
    supportReason: supportInfo.supportReason,
  });

  return {
    ...learner,
    ...fields,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    recommendedSupport: supportInfo.support,
    supportReason: supportInfo.supportReason,
    supportPathway: supportInfo.pathway,
    decisionSupport,
    plp,
    avatarTone: avatarToneFromRisk(fields.riskLevel),
    inAralProgram:
      aralEligible && fields.recommendation === RECOMMENDATION.ARAL,
  };
}

function buildClassSummaries(classesById, students = []) {
  return [...classesById.values()]
    .map((classInfo) => {
      const classStudents = students.filter((s) => s.classId === classInfo.id);

      const classSubjectGrades = classStudents
        .map((s) => s.classSubjectGrade)
        .filter((v) => v !== null && v !== undefined && v !== "");
      const numericGrades = classSubjectGrades
        .map((v) => parseRecordedGrade(v))
        .filter((v) => v !== null);
      const averageClassGrade =
        numericGrades.length > 0
          ? Math.round(
              (numericGrades.reduce((sum, v) => sum + v, 0) /
                numericGrades.length) *
                10
            ) / 10
          : null;

      const remedial = evaluateClassroomRemedial(classSubjectGrades);
      const underMonitoring = classStudents.filter(
        (s) =>
          s.monitoringStatus &&
          s.monitoringStatus !== MONITORING_STATUS.NOT_STARTED
      ).length;

      return {
        ...classInfo,
        totalStudents: classStudents.length,
        studentsAtRisk: classStudents.filter((s) => s.atRisk).length,
        aralCount: classInfo.aralEligible
          ? classStudents.filter(
              (s) => s.recommendation === RECOMMENDATION.ARAL
            ).length
          : 0,
        belowPassingCount: remedial.belowPassingCount,
        belowPassingRate: remedial.belowPassingRate,
        belowPassingPercent: Math.round((remedial.belowPassingRate ?? 0) * 100),
        gradedStudentCount: remedial.gradedCount,
        classroomRemedial: remedial.label,
        classroomRemedialRecommended: remedial.recommended,
        underMonitoringCount: underMonitoring,
        averageClassGrade,
        students: classStudents,
      };
    })
    .sort((a, b) =>
      String(a.gradeSection || "").localeCompare(String(b.gradeSection || ""))
    );
}

function learnerFromPayload(
  row,
  recommendationFields,
  latestMonitoring,
  monitoringStats,
  philIriMap = null,
  attendanceMap = null
) {
  const { enrollment, student, classInfo, subjectGrades, mappedSubjectGrades } =
    row;
  const latest = latestMonitoring.get(`${student.id}:${enrollment.class_id}`);
  const monitoringStatus =
    latest?.monitoring_status ?? MONITORING_STATUS.NOT_STARTED;
  const name = formatPersonName(student);

  const curTermGrades = termGradesForClassSubject(subjectGrades, {
    schoolYear: classInfo.schoolYear,
    classSubject: classInfo.subject,
  });

  const curGrade = recommendationFields.classSubjectGrade ?? recommendationFields.generalAverage ?? null;
  const qNum = Number(classInfo.quarter) || 1;
  const prevGrade = qNum > 1 ? (curTermGrades[qNum - 1] ?? null) : null;
  const performanceTrend = computePerformanceTrend(curGrade, prevGrade);

  const philRecord = philIriMap?.get(student.id) || null;
  const philIriScore = philRecord?.total_score != null
    ? Number(philRecord.total_score)
    : (latest?.phil_iri_score != null ? Number(latest.phil_iri_score) : null);

  const readingLevel = philRecord?.reading_level || latest?.reading_level || null;
  const screeningInterpretation = philRecord?.screening_interpretation || null;
  const candidateStatus = philRecord?.candidate_status || null;
  const testTaken = philRecord?.test_taken || "GST Form 1B";

  const assessmentDisplay = readingLevel || (philIriScore != null ? `GST ${philIriScore}/20` : "Not Screened");

  const attendanceRecord = attendanceMap?.get(student.id) || null;
  const attendanceRate = computeAttendanceRate(student.id, attendanceRecord);

  const supportInfo = deriveRecommendedSupport({
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    subject: classInfo.subject,
    isAralEligible: classInfo.aralEligible,
    philIriScore,
    readingLevel,
    candidateStatus,
    monitoringStatus,
  });

  const decisionSupport = buildDecisionSupport({
    riskLevel: recommendationFields.riskLevel,
    confidence: recommendationFields.rfConfidence ?? recommendationFields.recommendationConfidence,
    probabilities: recommendationFields.rfProbabilities ?? recommendationFields.recommendationProbabilities,
    performanceTrend,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    readingLevel,
    philIriScore,
    attendanceRate,
    subject: classInfo.subject,
  });

  const plp = buildPlpRecord({
    studentName: name,
    subject: classInfo.subject,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    readingLevel,
    philIriScore,
    support: supportInfo.support,
    supportReason: supportInfo.supportReason,
  });

  return {
    id: `${enrollment.class_id}:${student.id}`,
    studentId: student.id,
    classId: enrollment.class_id,
    enrollmentId: enrollment.id,
    studentNumber: student.student_number,
    name,
    lastName: student.last_name ?? null,
    firstName: student.first_name ?? null,
    middleName: student.middle_name ?? null,
    initials: initialsFromName(name),
    gender: student.sex ?? student.gender ?? null,
    avatarTone: avatarToneFromRisk(recommendationFields.riskLevel),
    grade: classInfo.gradeLevel != null ? `Grade ${classInfo.gradeLevel}` : "—",
    section: classInfo.sectionName,
    gradeSection: classInfo.gradeSection,
    subject: classInfo.subject,
    subjectAralEligible: classInfo.aralEligible,
    schoolYear: classInfo.schoolYear,
    quarter: classInfo.quarterLabel,
    quarterNumber: classInfo.quarter,
    teacherName: classInfo.teacherName,
    adviserName: classInfo.adviserName,
    ...recommendationFields,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    attendanceRate,
    attendanceRecord,
    philIriScore,
    readingLevel,
    screeningInterpretation,
    candidateStatus,
    testTaken,
    assessmentDisplay,
    recommendedSupport: supportInfo.support,
    supportReason: supportInfo.supportReason,
    supportPathway: supportInfo.pathway,
    decisionSupport,
    plp,
    termGrades: curTermGrades,
    monitoringStatus,
    progressEvaluation: latest?.progress_evaluation || null,
    nextAction: latest?.next_action || null,
    followUpNeeded: Boolean(latest?.follow_up_needed),
    latestObservationDate: formatDate(latest?.observation_date),
    latestProgress:
      monitoringStats.get(`${student.id}:${enrollment.class_id}`)
        ?.latestProgress ||
      latest?.student_progress ||
      null,
    weeklyUpdateCount:
      monitoringStats.get(`${student.id}:${enrollment.class_id}`)?.count ?? 0,
    inAralProgram:
      classInfo.aralEligible &&
      recommendationFields.recommendation === RECOMMENDATION.ARAL,
    subjectGrades: mappedSubjectGrades,
    _generateInput: row.generateInput,
  };
}

export function stripRosterGenerateInputs(roster) {
  return {
    students: (roster?.students ?? []).map(
      ({ _generateInput, ...student }) => student
    ),
    classSummaries: (roster?.classSummaries ?? []).map((row) => ({
      ...row,
      students: (row.students ?? []).map(
        ({ _generateInput, ...student }) => student
      ),
    })),
    predictionsPending: Boolean(roster?.predictionsPending),
  };
}

/**
 * Grades + monitoring rows without waiting on RF /predict_batch.
 */
export function buildMonitoringRosterShell({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  philIriRecords = [],
  attendanceRecords = [],
} = {}) {
  const classesById = classLookup(classes);
  const gradesMap = gradesByStudent(grades);
  const latestMonitoring = latestMonitoringByStudentClass(monitoringRecords);
  const monitoringStats = monitoringStatsByStudentClass(monitoringRecords);

  const philIriMap = new Map();
  for (const p of philIriRecords) {
    if (!philIriMap.has(p.student_id)) philIriMap.set(p.student_id, p);
  }

  const attendanceMap = new Map();
  for (const a of attendanceRecords) {
    if (!attendanceMap.has(a.student_id)) attendanceMap.set(a.student_id, a);
  }

  const enrollmentRows = enrollments.filter((enrollment) => {
    const student = unwrap(enrollment.students);
    const classInfo = classesById.get(enrollment.class_id);
    return Boolean(student && classInfo);
  });

  const batchPayloads = enrollmentRows.map((enrollment) => {
    const student = unwrap(enrollment.students);
    const classInfo = classesById.get(enrollment.class_id);
    const subjectGrades = gradesMap.get(student.id) ?? [];
    const scopedGrades = subjectGrades.filter(
      (g) =>
        g.schoolYear === classInfo.schoolYear &&
        Number(g.quarter) === Number(classInfo.quarter)
    );
    const gradesForRecommendation = scopedGrades.length
      ? scopedGrades
      : subjectGrades;
    const mappedSubjectGrades = gradesForRecommendation.map((g) => ({
      subject: g.subjectName,
      grade: g.finalGrade,
    }));
    return {
      enrollment,
      student,
      classInfo,
      subjectGrades,
      mappedSubjectGrades,
      generateInput: {
        id: student.id,
        subjectGrades: mappedSubjectGrades,
        schoolYear: classInfo.schoolYear,
        quarter: classInfo.quarter,
        classId: enrollment.class_id,
        classSubject: classInfo.subject,
      },
    };
  });

  const students = batchPayloads.map((row) => {
    const recommendationFields = applyRecommendationToUiFields(
      null,
      row.mappedSubjectGrades,
      row.classInfo.subject,
      {
        aralEligible: row.classInfo.aralEligible,
        classSubject: row.classInfo.subject,
        pending: true,
      }
    );
    return learnerFromPayload(
      row,
      recommendationFields,
      latestMonitoring,
      monitoringStats,
      philIriMap,
      attendanceMap
    );
  });

  students.sort(compareLearnersByCheckFirst);

  return {
    students,
    classSummaries: buildClassSummaries(classesById, students),
    predictionsPending: true,
  };
}

/**
 * Apply RF (or labeled local fallback) onto a grades shell. Same generateBatch math.
 */
function generateInputFromLearner(row = {}) {
  if (row?._generateInput) return row._generateInput;
  const subjectGrades = Array.isArray(row.subjectGrades)
    ? row.subjectGrades.map((g) => ({
        subject: g.subject,
        grade: g.grade ?? g.finalGrade,
      }))
    : [];
  if (!row.studentId) return null;
  return {
    id: row.studentId,
    subjectGrades,
    schoolYear: row.schoolYear,
    quarter: row.quarterNumber ?? row.quarter,
    classId: row.classId,
    classSubject: row.subject,
  };
}

export async function enrichMonitoringRosterWithRecommendations(
  shell,
  { preferLocalRecommendations = false } = {}
) {
  const studentsIn = shell?.students ?? [];
  const inputs = studentsIn.map((row, index) =>
    generateInputFromLearner(row) || {
      id: row.studentId || `row-${index}`,
      subjectGrades: [],
      schoolYear: row.schoolYear,
      quarter: row.quarterNumber ?? row.quarter,
      classId: row.classId,
      classSubject: row.subject,
    }
  );

  const recommendations = !inputs.length
    ? []
    : preferLocalRecommendations
      ? await Promise.all(
          inputs.map((input) =>
            recommendationService.generate(input, {
              preferLocal: true,
              forceRuleFallback: true,
            })
          )
        )
      : await recommendationService.generateBatch(inputs);

  const students = studentsIn.map((row, index) => {
    const next = applyRiskPredictionToLearner(
      row,
      recommendations[index] ?? null
    );
    const { _generateInput, ...rest } = next;
    return rest;
  });
  students.sort(compareLearnersByCheckFirst);

  const classesById = new Map(
    (shell?.classSummaries ?? []).map((row) => [row.id, row])
  );

  return {
    students,
    classSummaries: buildClassSummaries(classesById, students).map((row) => ({
      ...row,
      students: (row.students ?? []).map(
        ({ _generateInput, ...student }) => student
      ),
    })),
    predictionsPending: students.some((row) => row.predictionsPending),
  };
}

export async function enrichMonitoringRosterWithRetry(shell) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const full = await enrichMonitoringRosterWithRecommendations(shell);
      const stripped = stripRosterGenerateInputs(full);
      if (!stripped.predictionsPending) return stripped;
    } catch (err) {
      console.warn("[roster] RF enrich failed, retrying:", err?.message || err);
    }
  }

  // Graceful fallback: compute local rule-based ensemble so page never crashes with 500
  try {
    const fallback = await enrichMonitoringRosterWithRecommendations(shell, {
      preferLocalRecommendations: true,
    });
    return stripRosterGenerateInputs(fallback);
  } catch (err) {
    console.warn("[roster] Local ensemble fallback failed, returning shell:", err?.message || err);
    return stripRosterGenerateInputs(shell);
  }
}

/**
 * Build per-class summaries + flat student rows for the monitoring dashboard.
 * One student row per class enrollment (a learner in two classes appears twice).
 *
 * Recommendations from recommendationService.generateBatch()
 * → FastAPI Random Forest /predict_batch (production).
 */
export async function buildMonitoringRoster({
  classes = [],
  enrollments = [],
  grades = [],
  monitoringRecords = [],
  philIriRecords = [],
  attendanceRecords = [],
  preferLocalRecommendations = false,
  skipRecommendations = false,
} = {}) {
  const shell = buildMonitoringRosterShell({
    classes,
    enrollments,
    grades,
    monitoringRecords,
    philIriRecords,
    attendanceRecords,
  });
  if (skipRecommendations) return shell;
  return enrichMonitoringRosterWithRecommendations(shell, {
    preferLocalRecommendations,
  });
}

/**
 * KPI cards for Monitoring.
 * The ARAL card only appears when the teacher has an English / Filipino class.
 */
export function buildMonitoringKpis(students = [], classSummaries = []) {
  const hasAralClass =
    classSummaries.some((c) => c.aralEligible) ||
    students.some((s) => s.aralEligible);

  const atRisk = students.filter((s) => s.atRisk).length;
  const aral = students.filter(
    (s) => s.aralEligible && s.recommendation === RECOMMENDATION.ARAL
  ).length;
  const remedialClasses = classSummaries.filter(
    (c) => c.classroomRemedialRecommended
  ).length;
  const ongoing = students.filter(
    (s) =>
      s.monitoringStatus === MONITORING_STATUS.ONGOING ||
      s.monitoringStatus === MONITORING_STATUS.NEEDS_FOLLOW_UP
  ).length;
  const completed = students.filter(
    (s) => s.monitoringStatus === MONITORING_STATUS.COMPLETED
  ).length;

  const kpis = [
    {
      id: "at-risk",
      label: "Students at Risk",
      value: atRisk,
      description: hasAralClass
        ? "Learners flagged for screening or below the passing grade."
        : "Learners below the passing grade in your subject.",
      icon: "users",
      tone: "blue",
      alert: atRisk > 0,
    },
  ];

  if (hasAralClass) {
    kpis.push({
      id: "aral",
      label: "ARAL Learners",
      value: aral,
      description: "English or Filipino below 75.",
      icon: "clock",
      tone: "orange",
      alert: aral > 0,
    });
  }

  kpis.push(
    {
      id: "classroom-remedial",
      label: "Classroom Remedial",
      value: remedialClasses,
      description: "Classes recommended for whole-class remedial.",
      icon: "book",
      tone: "green",
      alert: remedialClasses > 0,
    },
    {
      id: "ongoing",
      label: "Ongoing Monitoring",
      value: ongoing,
      description: "Active monitoring records still in progress.",
      icon: "alert",
      tone: "red",
      alert: ongoing > 0,
    },
    {
      id: "completed",
      label: "Completed Monitoring",
      value: completed,
      description: "Monitoring cycles marked completed.",
      icon: "users",
      tone: "green",
    }
  );

  return kpis;
}

function monitoredRiskRank(level) {
  const normalized = normalizeRiskLevel(level);
  if (normalized === RISK_LEVEL.HIGH) return 3;
  if (normalized === RISK_LEVEL.MODERATE) return 2;
  return 1;
}

function monitoredApprovalRank(status) {
  if (status === ARAL_APPROVAL_STATUS.SUBMITTED) return 4;
  if (status === ARAL_APPROVAL_STATUS.RETURNED) return 3;
  if (status === ARAL_APPROVAL_STATUS.APPROVED) return 2;
  return 1;
}

function monitoredStatusRank(status) {
  if (
    status === MONITORING_STATUS.NEEDS_FOLLOW_UP ||
    status === MONITORING_STATUS.NEEDS_FURTHER_SUPPORT
  ) {
    return 5;
  }
  if (status === MONITORING_STATUS.FOR_FURTHER_MONITORING) return 4;
  if (status === MONITORING_STATUS.ONGOING) return 4;
  if (status === MONITORING_STATUS.IMPROVED) return 3;
  if (status === MONITORING_STATUS.COMPLETED) return 2;
  return 1;
}

function monitoredSubjectGrade(row = {}) {
  return parseRecordedGrade(row.classSubjectGrade ?? row.generalAverage);
}

function pickPrimaryMonitoredRow(rows = []) {
  const aralRow = rows.find(
    (row) =>
      row.aralEligible && row.recommendation === RECOMMENDATION.ARAL
  );
  if (aralRow) return aralRow;

  let primary = rows[0];
  let lowest = Infinity;
  for (const row of rows) {
    const grade = monitoredSubjectGrade(row);
    if (grade !== null && grade < lowest) {
      lowest = grade;
      primary = row;
    }
  }
  return primary ?? rows[0];
}

/**
 * HT Monitored Students: one row per learner per grade & section.
 * Merges multiple class enrollments (subjects) into a single summary row.
 */
export function groupMonitoredStudentsForAdmin(
  learners = [],
  classSummaries = []
) {
  const remedialClassIds = new Set(
    (classSummaries ?? [])
      .filter((cls) => cls.classroomRemedialRecommended)
      .map((cls) => cls.id)
  );
  /** @type {Map<string, { rows: object[] }>} */
  const byKey = new Map();

  for (const row of learners) {
    const studentId = row.studentId;
    if (!studentId) continue;
    const sectionKey = String(row.gradeSection || "Unknown").trim();
    const key = `${studentId}::${sectionKey}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.rows.push(row);
    else byKey.set(key, { rows: [row] });
  }

  const merged = [];
  for (const [key, { rows }] of byKey) {
    const primary = pickPrimaryMonitoredRow(rows);
    const numericGrades = rows
      .map(monitoredSubjectGrade)
      .filter((grade) => grade !== null);
    const lowestGrade = numericGrades.length
      ? Math.min(...numericGrades)
      : null;

    let riskLevel = "—";
    let riskRank = 0;
    for (const row of rows) {
      if (!row.hasClassSubjectGrade) continue;
      const rank = monitoredRiskRank(row.riskLevel);
      if (rank > riskRank) {
        riskRank = rank;
        riskLevel = normalizeRiskLevel(row.riskLevel);
      }
    }
    const lead = sortLearnersByCheckFirst(rows)[0] ?? primary;

    let recommendation = RECOMMENDATION.NONE;
    let recommendationDisplay = null;
    for (const row of rows) {
      if (row.recommendation === RECOMMENDATION.ARAL) {
        recommendation = RECOMMENDATION.ARAL;
        recommendationDisplay =
          row.recommendationDisplay ?? RECOMMENDATION.ARAL;
        break;
      }
      if (
        row.recommendation === RECOMMENDATION.REMEDIATION &&
        recommendation !== RECOMMENDATION.ARAL
      ) {
        recommendation = RECOMMENDATION.REMEDIATION;
        recommendationDisplay =
          row.recommendationDisplay ?? RECOMMENDATION.REMEDIATION;
      }
    }
    if (!recommendationDisplay) {
      recommendationDisplay =
        rows.find((row) => row.recommendationDisplay)?.recommendationDisplay ??
        null;
    }

    let aralApprovalStatus = ARAL_APPROVAL_STATUS.SUGGESTED;
    let approvalRank = 0;
    let aralApprovalNote = "";
    for (const row of rows) {
      const status = row.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED;
      const rank = monitoredApprovalRank(status);
      if (rank > approvalRank) {
        approvalRank = rank;
        aralApprovalStatus = status;
        aralApprovalNote = row.aralApprovalNote || "";
      }
    }

    let monitoringStatus = MONITORING_STATUS.NOT_STARTED;
    let statusRank = 0;
    for (const row of rows) {
      const rank = monitoredStatusRank(row.monitoringStatus);
      if (rank > statusRank) {
        statusRank = rank;
        monitoringStatus = row.monitoringStatus;
      }
    }

    const subjects = [
      ...new Set(rows.map((row) => row.subject).filter(Boolean)),
    ];
    const aralRows = rows.filter(
      (row) =>
        row.aralEligible && row.recommendation === RECOMMENDATION.ARAL
    );
    const nonAralAtRiskRows = rows.filter(
      (row) => !row.aralEligible && row.atRisk
    );
    const aralSubjects = [
      ...new Set(aralRows.map((row) => row.subject).filter(Boolean)),
    ];
    const nonAralSubjects = [
      ...new Set(nonAralAtRiskRows.map((row) => row.subject).filter(Boolean)),
    ];
    const aralGrades = aralRows
      .map(monitoredSubjectGrade)
      .filter((grade) => grade !== null);
    const nonAralGrades = nonAralAtRiskRows
      .map(monitoredSubjectGrade)
      .filter((grade) => grade !== null);

    merged.push({
      ...primary,
      id: key,
      selectKey: key,
      classId: primary.classId,
      studentId: primary.studentId,
      subjects,
      aralSubjects,
      nonAralSubjects,
      enrollmentCount: rows.length,
      sourceRows: rows,
      classSubjectGrade: lowestGrade ?? primary.classSubjectGrade,
      aralClassSubjectGrade: aralGrades.length
        ? Math.min(...aralGrades)
        : null,
      nonAralClassSubjectGrade: nonAralGrades.length
        ? Math.min(...nonAralGrades)
        : null,
      generalAverage: lowestGrade ?? primary.generalAverage,
      hasClassSubjectGrade: numericGrades.length > 0,
      riskLevel,
      recommendationProbabilities:
        lead.recommendationProbabilities ?? null,
      recommendationConfidence: lead.recommendationConfidence ?? null,
      recommendationSource: lead.recommendationSource ?? null,
      atRisk: rows.some((row) => row.atRisk),
      recommendation,
      recommendationDisplay,
      aralApprovalStatus,
      aralApprovalNote,
      monitoringStatus,
      inAralProgram: rows.some((row) => row.inAralProgram),
      classroomRemedialRecommended: rows.some((row) =>
        remedialClassIds.has(row.classId)
      ),
      weeklyUpdateCount: Math.max(
        0,
        ...rows.map((row) => Number(row.weeklyUpdateCount) || 0)
      ),
      latestProgress:
        rows.find(
          (row) => row.latestProgress && row.latestProgress !== "—"
        )?.latestProgress ?? primary.latestProgress,
      aralEligible: rows.some((row) => row.aralEligible),
    });
  }

  merged.sort(compareLearnersByCheckFirst);

  return merged;
}

/** HT Monitored Students — ARAL Learners sub-tab. */
export function filterAralMonitoredStudents(learners = []) {
  return learners.filter(
    (learner) => learner.recommendation === RECOMMENDATION.ARAL
  );
}

/** HT Monitored Students — at-risk learners without an ARAL recommendation. */
export function filterNonAralAtRiskMonitoredStudents(learners = []) {
  return learners.filter(
    (learner) =>
      learner.atRisk && learner.recommendation !== RECOMMENDATION.ARAL
  );
}

/**
 * HT dashboard stats. People-counts use unique grouped learners
 * (one row per student × section), not subject×class enrollments.
 * `remediation` is a class count.
 */
export function buildAdminMonitoringStats(
  students = [],
  classSummaries = [],
  { alreadyGrouped = false } = {}
) {
  const grouped = alreadyGrouped
    ? students
    : groupMonitoredStudentsForAdmin(students, classSummaries);
  const aralLearners = filterAralMonitoredStudents(grouped);
  const classroomRemedialLearners =
    filterNonAralAtRiskMonitoredStudents(grouped);

  return {
    totalAtRisk: aralLearners.length + classroomRemedialLearners.length,
    aral: aralLearners.length,
    classroomRemedialLearners: classroomRemedialLearners.length,
    remediation: classSummaries.filter((c) => c.classroomRemedialRecommended)
      .length,
    completed: grouped.filter(
      (s) => s.monitoringStatus === MONITORING_STATUS.COMPLETED
    ).length,
    ongoing: grouped.filter(
      (s) =>
        s.monitoringStatus === MONITORING_STATUS.ONGOING ||
        s.monitoringStatus === MONITORING_STATUS.NEEDS_FOLLOW_UP
    ).length,
    notStarted: grouped.filter(
      (s) =>
        !s.monitoringStatus ||
        s.monitoringStatus === MONITORING_STATUS.NOT_STARTED
    ).length,
  };
}

/**
 * Detail page mapping — recommendation via recommendationService only.
 */
export async function mapMonitoringDetail({
  classRow,
  student,
  grades = [],
  monitoringRecords = [],
  philIriRecord = null,
  attendanceRecords = [],
}) {
  const section = unwrap(classRow?.sections);
  const subject = unwrap(classRow?.subjects);
  const teacher = unwrap(classRow?.teachers);
  const adviser = unwrap(section?.adviser);
  const name = formatPersonName(student);

  const subjectGrades = (grades ?? []).map((row) => ({
    id: row.id,
    subject: unwrap(row.subjects)?.subject_name ?? "Subject",
    grade: parseRecordedGrade(row.final_grade),
    quarter: row.quarter,
    schoolYear: row.school_year,
  }));

  const recommendation = await recommendationService.generate({
    id: student.id,
    subjectGrades,
    schoolYear: classRow.school_year,
    quarter: classRow.quarter,
    classId: classRow.id,
    classSubject: subject?.subject_name ?? null,
  });

  const classSubjectName = subject?.subject_name ?? null;
  const isAralEligible = isAralEligibleSubject(classSubjectName);
  const recommendationFields = applyRecommendationToUiFields(
    recommendation,
    subjectGrades,
    classSubjectName ?? "—",
    {
      aralEligible: isAralEligible,
      classSubject: classSubjectName,
    }
  );
  const latest = monitoringRecords[0] ?? null;
  const termGrades = termGradesForClassSubject(subjectGrades, {
    schoolYear: classRow.school_year,
    classSubject: classSubjectName,
  });

  const curGrade = recommendationFields.classSubjectGrade ?? recommendationFields.generalAverage ?? null;
  const qNum = Number(classRow.quarter) || 1;
  const prevGrade = qNum > 1 ? (termGrades[qNum - 1] ?? null) : null;
  const performanceTrend = computePerformanceTrend(curGrade, prevGrade);

  const philIriScore = philIriRecord?.total_score != null
    ? Number(philIriRecord.total_score)
    : (latest?.phil_iri_score != null ? Number(latest.phil_iri_score) : null);

  const readingLevel = philIriRecord?.reading_level || latest?.reading_level || null;
  const screeningInterpretation = philIriRecord?.screening_interpretation || null;
  const candidateStatus = philIriRecord?.candidate_status || null;
  const testTaken = philIriRecord?.test_taken || "GST Form 1B";
  const assessmentDisplay = readingLevel || (philIriScore != null ? `GST ${philIriScore}/20` : "Not Screened");

  const attendanceRecord = attendanceRecords?.[0] || null;
  const attendanceRate = computeAttendanceRate(student.id, attendanceRecord);

  const monitoringStatus = latest?.monitoring_status ?? MONITORING_STATUS.NOT_STARTED;

  const supportInfo = deriveRecommendedSupport({
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    subject: classSubjectName,
    isAralEligible,
    philIriScore,
    readingLevel,
    candidateStatus,
    monitoringStatus,
  });

  const decisionSupport = buildDecisionSupport({
    riskLevel: recommendationFields.riskLevel,
    confidence: recommendationFields.rfConfidence ?? recommendationFields.recommendationConfidence,
    probabilities: recommendationFields.rfProbabilities ?? recommendationFields.recommendationProbabilities,
    performanceTrend,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    readingLevel,
    philIriScore,
    attendanceRate,
    subject: classSubjectName,
  });

  const plp = buildPlpRecord({
    studentName: name,
    subject: classSubjectName,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    readingLevel,
    philIriScore,
    support: supportInfo.support,
    supportReason: supportInfo.supportReason,
  });

  return {
    studentId: student.id,
    classId: classRow.id,
    name,
    initials: initialsFromName(name),
    studentNumber: student.student_number,
    gradeLevel:
      section?.grade_level != null ? `Grade ${section.grade_level}` : "—",
    section: section?.section_name ?? "—",
    gradeSection:
      section?.grade_level != null
        ? `Grade ${section.grade_level} — ${section.section_name ?? ""}`.trim()
        : section?.section_name ?? "—",
    adviser: formatPersonName(adviser),
    adviserId: section?.adviser_id ?? null,
    teacher: formatPersonName(teacher),
    subject: classSubjectName ?? "—",
    subjectAralEligible: isAralEligible,
    schoolYear: classRow.school_year,
    quarter: quarterLabel(classRow.quarter),
    quarterNumber: Number(classRow.quarter),
    subjectGrades,
    termGrades,
    currentGrade: curGrade,
    previousGrade: prevGrade,
    performanceTrend,
    attendanceRate,
    attendanceRecord,
    philIriScore,
    readingLevel,
    screeningInterpretation,
    candidateStatus,
    testTaken,
    assessmentDisplay,
    recommendedSupport: supportInfo.support,
    supportReason: supportInfo.supportReason,
    supportPathway: supportInfo.pathway,
    decisionSupport,
    plp,
    ...recommendationFields,
    monitoringStatus,
    latestProgress: latest?.student_progress || null,
    weeklyUpdateCount: (monitoringRecords ?? []).length,
    inAralProgram:
      isAralEligible &&
      recommendationFields.recommendation === RECOMMENDATION.ARAL,
    records: withWeekNumbers(
      (monitoringRecords ?? []).map((row) => ({
        id: row.id,
        observationDate: formatDate(row.observation_date),
        observationDateRaw: row.observation_date,
        interventionGiven: row.intervention_given || "—",
        teacherRemarks: row.teacher_remarks || "—",
        studentProgress: row.student_progress || "—",
        followUpNeeded: Boolean(row.follow_up_needed),
        monitoringStatus: row.monitoring_status,
        createdAt: formatDate(row.created_at),
        teacherName: formatPersonName(unwrap(row.teachers)),
      }))
    ),
  };
}

export function buildFilterOptions(students = [], classSummaries = []) {
  const grades = [
    "All Grades",
    ...new Set(students.map((s) => s.grade).filter((v) => v && v !== "—")),
  ];
  const sections = [
    "All Sections",
    ...new Set(students.map((s) => s.section).filter(Boolean)),
  ];
  const subjects = [
    "All Subjects",
    ...new Set(
      classSummaries.map((c) => c.subject).filter(Boolean).concat(
        students.map((s) => s.subject).filter(Boolean)
      )
    ),
  ];
  const schoolYears = [
    ...new Set(
      classSummaries.map((c) => c.schoolYear).filter(Boolean).concat(
        students.map((s) => s.schoolYear).filter(Boolean)
      )
    ),
  ];
  const quarters = [
    TERM_ALL_LABEL,
    ...new Set(students.map((s) => s.quarter).filter(Boolean)),
  ];

  // ARAL is only offered as a filter when the teacher has a language class.
  const hasAralClass =
    classSummaries.some((c) => c.aralEligible) ||
    students.some((s) => s.aralEligible);

  return {
    grades,
    sections,
    subjects,
    schoolYears: schoolYears.length ? schoolYears : ["SY 2026-2027"],
    quarters,
    hasAralClass,
    interventions: [
      "All Recommendations",
      ...(hasAralClass ? [RECOMMENDATION.ARAL] : []),
      RECOMMENDATION.NONE,
    ],
    risks: [
      "All Risks",
      RISK_LEVEL.HIGH,
      RISK_LEVEL.MODERATE,
      RISK_LEVEL.LOW,
    ],
    statuses: [
      "All Status",
      MONITORING_STATUS.NOT_STARTED,
      MONITORING_STATUS.ONGOING,
      MONITORING_STATUS.IMPROVED,
      MONITORING_STATUS.NEEDS_FOLLOW_UP,
      MONITORING_STATUS.COMPLETED,
    ],
  };
}
