import { normalizeAralPeriod } from "./assessmentTimeline.js";
import { calculateIraMetrics, evaluateGstScore } from "./philIriEvaluation.js";

const profiles = ["Independent", "Instructional", "Frustration", "Non-Reader"];
const significantMetrics = (metrics) => metrics ? Object.fromEntries([
  "passageLevel", "totalWords", "miscues", "readingTimeSeconds", "comprehensionCorrect", "comprehensionTotal", "progressionOutcome",
].map((key) => [key, metrics[key] ?? null])) : null;

/** Build one explicitly entered result. No side effects or writes to intervention/academic data. */
export function buildPhilIriPayload(input, existing = null) {
  const period = normalizeAralPeriod(input.assessmentPeriod);
  if (!period) throw new Error("Choose BOSY, MOSY, or EOSY.");
  if (!input.studentId) throw new Error("A learner is required.");
  const isAbsent = Boolean(input.isAbsent);
  const gst = evaluateGstScore(input.gstScore);
  if (!isAbsent && !gst.isEvaluated) throw new Error("Record a valid GST screening score from 0 to 40 first.");
  const previous = existing?.raw_payload || {};
  const scoreChanged = Boolean(existing && (Boolean(previous.isAbsent) !== isAbsent ||
    (!isAbsent && Number(existing.total_score) !== gst.score)));
  let iraMetrics = input.iraMetrics;
  if (input.screeningOnly) iraMetrics = scoreChanged || isAbsent ? null : previous.iraMetrics;
  let readingLevel = input.screeningOnly && !scoreChanged && !isAbsent
    ? existing?.reading_level || "Not Assessed" : input.readingLevel || "Not Assessed";
  if (input.screeningOnly && (scoreChanged || isAbsent)) readingLevel = "Not Assessed";

  if (!input.screeningOnly && (iraMetrics || input.individualAssessmentRequired || profiles.includes(readingLevel))) {
    if (isAbsent || !gst.requiresIra) throw new Error("Individual assessment requires a completed GST screening score below 28.");
    const required = ["totalWords", "miscues", "readingTimeSeconds", "comprehensionCorrect", "comprehensionTotal"];
    if (!iraMetrics?.passageLevel || required.some((field) => iraMetrics[field] == null || String(iraMetrics[field]).trim() === "" || !Number.isFinite(Number(iraMetrics[field])))) {
      throw new Error("Complete the passage, word reading, reading time, and comprehension results in Form 3.");
    }
    const { totalWords, miscues, readingTimeSeconds, comprehensionCorrect, comprehensionTotal } = iraMetrics;
    if (Number(totalWords) <= 0 || Number(miscues) < 0 || Number(miscues) > Number(totalWords) ||
        Number(readingTimeSeconds) <= 0 || Number(comprehensionTotal) <= 0 ||
        Number(comprehensionCorrect) < 0 || Number(comprehensionCorrect) > Number(comprehensionTotal)) {
      throw new Error("Check the word count, miscues, reading time, and comprehension scores.");
    }
    const calculated = calculateIraMetrics({ assessmentLevelUsed: iraMetrics.passageLevel,
      totalWords: Number(totalWords), miscues: Number(miscues), readingTimeSeconds: Number(readingTimeSeconds),
      comprehensionCorrect: Number(comprehensionCorrect), comprehensionTotal: Number(comprehensionTotal) });
    readingLevel = calculated.readingProfile;
    if (!readingLevel) throw new Error("Complete the individual reading assessment first.");
    const allowedOutcomes = ["No Further Assessment Required", period === "EOSY" ? "For Further Review after EOSY" : "Continue to Next Assessment Period"];
    if (!allowedOutcomes.includes(iraMetrics.progressionOutcome)) throw new Error("Confirm the assessment outcome.");

    if (iraMetrics.progressionOutcome === "No Further Assessment Required") {
      if (readingLevel !== "Independent") {
        throw new Error(`Learner has a ${readingLevel} reading profile and cannot be exited from assessment. Outcome must be "${period === "EOSY" ? "For Further Review after EOSY" : "Continue to Next Assessment Period"}".`);
      }
      const learnerGrade = parseInt(String(input.grade || "").match(/\d+/)?.[0] || "0", 10);
      const passageGrade = parseInt(String(iraMetrics.passageLevel || "").match(/\d+/)?.[0] || "0", 10);
      if (learnerGrade > 0 && passageGrade > 0 && passageGrade < learnerGrade) {
        throw new Error(`Passage level (${iraMetrics.passageLevel}) is below learner's grade level (Grade ${learnerGrade}). Exit requires an at-grade assessment.`);
      }
    }

    iraMetrics = { ...iraMetrics, ...calculated, readingProfile: readingLevel };
  }

  const correcting = Boolean(existing && (scoreChanged ||
    (previous.iraMetrics && JSON.stringify(significantMetrics(previous.iraMetrics)) !== JSON.stringify(significantMetrics(iraMetrics))) ||
    (profiles.includes(existing.reading_level) && existing.reading_level !== readingLevel)));
  const correctionReason = String(input.correctionReason || "").trim();
  const now = new Date().toISOString();
  const language = String(input.subject || "English").toLowerCase().includes("fil") ? "Filipino" : "English";
  const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ""));
  const validClassId = isUuid(input.classId) ? input.classId : (isUuid(existing?.class_id) ? existing.class_id : null);
  const isEosyReview = period === "EOSY" && (
    readingLevel === "Frustration" || readingLevel === "Instructional" ||
    iraMetrics?.progressionOutcome === "For Further Review after EOSY"
  );
  return {
    student_id: input.studentId, class_id: validClassId,
    teacher_id: input.teacherId || existing?.teacher_id || null,
    school_year: input.schoolYear || "SY 2026-2027", quarter: Number(input.quarter) || 1,
    subject: language, assessment_period: period,
    test_taken: iraMetrics ? "GST & Individual Assessment" : language === "Filipino" ? "GST Form 1A" : "GST Form 1B",
    total_score: isAbsent ? null : gst.score, reading_level: isAbsent ? "Not Assessed" : readingLevel,
    screening_interpretation: isAbsent ? "No data" : gst.score >= 28 ? "No further individualized assessment from GST" : gst.score >= 16 ? "2 levels lower Phil-IRI testing" : "3 levels lower Phil-IRI testing",
    candidate_status: isAbsent ? "For Review" : input.candidateStatusOverride ||
      (existing?.candidate_status !== "Absent / For Reschedule" && existing?.candidate_status) || (gst.score >= 28 ? "Baseline Complete" : "For Review"),
    is_matched: true,
    raw_payload: { ...previous,
      assessmentPeriod: period, isAbsent, individualAssessmentRequired: !isAbsent && gst.requiresIra,
      documents: input.documents ?? previous.documents ?? [],
      iraMetrics: iraMetrics || null, progressionOutcome: iraMetrics?.progressionOutcome || null,
      screeningStatus: isAbsent ? "Absent / For Reschedule" : isEosyReview ? "ARAL Eligible — For Review" : (period === "BOSY" && gst.score >= 28) ? "Screening Complete" : iraMetrics ? (iraMetrics.progressionOutcome === "No Further Assessment Required" ? "Assessment Complete" : "Needs Support") : gst.score >= 28 ? "Screening Complete" : "Needs Further Assessment",
      teacherReviewReason: input.teacherReviewReason ?? (scoreChanged ? null : previous.teacherReviewReason) ?? null,
      correctionReason: correcting ? (correctionReason || "Assessment updated") : null,
      ...(existing?.updated_at ? { expectedUpdatedAt: existing.updated_at } : {}),
      individualResultNeedsReview: Boolean(scoreChanged && previous.iraMetrics),
      auditTrail: [...(Array.isArray(previous.auditTrail) ? previous.auditTrail : []), {
        action: correcting ? "assessment_corrected" : "assessment_recorded", teacherId: input.teacherId || null,
        timestamp: now, ...(correcting ? {
          reason: correctionReason || "Assessment updated",
          previousScore: existing.total_score,
          newScore: isAbsent ? null : gst.score,
          previousReadingLevel: existing.reading_level,
          newReadingLevel: isAbsent ? "Not Assessed" : readingLevel,
          previousMetrics: previous.iraMetrics || null,
          newMetrics: iraMetrics || null,
        } : {}),
      }],
    }, updated_at: now,
  };
}

export function philIriSaveError(error) {
  if (["PGRST204", "42703", "42P10"].includes(error?.code) || /assessment_period.*does not exist|no unique.*constraint/i.test(error?.message || "")) {
    return new Error("Reading assessment storage update required (migration 058). Error: storage schema missing assessment_period column or unique constraint. Ask the administrator to apply migration 058, then try again.");
  }
  return error instanceof Error ? error : new Error(error?.message || "Unable to save the reading assessment. Please try again.");
}
