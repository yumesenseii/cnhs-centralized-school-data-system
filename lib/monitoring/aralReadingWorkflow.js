import { normalizeReadingPeriod, evaluateTermResult } from "./aralProgression.js";
import { evaluateGstScore } from "./philIriEvaluation.js";

const PERIODS = ["BOSY", "MOSY", "EOSY"];
const languageOf = (value) => {
  const text = String(value || "").toLowerCase();
  return text.includes("fil") ? "Filipino" : text.includes("eng") ? "English" : null;
};

function mapRecord(record) {
  const raw = record.rawPayload || record.raw_payload || {};
  const isAbsent = Boolean(record.isAbsent || raw.isAbsent ||
    record.candidateStatus === "Absent / For Reschedule" ||
    record.candidate_status === "Absent / For Reschedule" ||
    raw.screeningStatus === "Absent / For Reschedule");
  const score = record.philIriScore ?? record.totalScore ?? record.total_score;
  return {
    ...record,
    assessmentPeriod: normalizeReadingPeriod(record.assessmentPeriod || record.assessment_period || raw.assessmentPeriod) || "BOSY",
    philIriScore: evaluateGstScore({ score, isAbsent }).score ?? null,
    readingLevel: record.readingLevel || record.reading_level || null,
    candidateStatus: isAbsent ? "Absent / For Reschedule" : record.candidateStatus || record.candidate_status,
    screeningInterpretation: record.screeningInterpretation || record.screening_interpretation,
    iraMetrics: record.iraMetrics || raw.iraMetrics || null,
    screeningPeriod: record.iraMetrics?.screeningPeriod || raw.iraMetrics?.screeningPeriod ||
      normalizeReadingPeriod(record.assessmentPeriod || record.assessment_period || raw.assessmentPeriod) || "BOSY",
    progressionOutcome: record.progressionOutcome || raw.progressionOutcome || null,
    teacherReviewReason: record.teacherReviewReason || raw.teacherReviewReason || null,
    rawPayload: raw,
    isAbsent,
  };
}

/** Read saved evidence only. Never infer a result from a draft or an academic term. */
export function getAralReadingWorkflow(learner = {}, period, schoolYear = learner.schoolYear) {
  const activePeriod = normalizeReadingPeriod(period);
  const language = languageOf(learner.language || learner.subject);
  const records = (Array.isArray(learner.philIriRecords) ? learner.philIriRecords : []).filter((record) => {
    const recordYear = record.schoolYear || record.school_year;
    const recordLanguage = languageOf(record.language || record.subject);
    const studentId = record.studentId || record.student_id;
    const rawPeriod = record.assessmentPeriod || record.assessment_period || record.rawPayload?.assessmentPeriod || record.raw_payload?.assessmentPeriod;
    return (!recordYear || !schoolYear || recordYear === schoolYear) &&
      (!rawPeriod || Boolean(normalizeReadingPeriod(rawPeriod))) &&
      (!recordLanguage || !language || recordLanguage === language) &&
      (!studentId || !learner.studentId || studentId === learner.studentId);
  }).map(mapRecord).sort((a, b) =>
    String(b.updated_at || b.updatedAt || b.created_at || "").localeCompare(String(a.updated_at || a.updatedAt || a.created_at || ""))
  );

  // A top-level score is usable only when its reading period is explicit.
  const explicitPeriod = normalizeReadingPeriod(learner.assessmentPeriod || learner.assessment_period || learner.rawPayload?.assessmentPeriod);
  if (explicitPeriod && !learner.readingPeriodProjection && !records.some((r) => r.assessmentPeriod === explicitPeriod)) {
    records.push(mapRecord({ ...learner, assessmentPeriod: explicitPeriod }));
  }
  const index = PERIODS.indexOf(activePeriod);
  const current = records.find((r) => r.assessmentPeriod === activePeriod) || null;
  const earlier = PERIODS.slice(0, Math.max(0, index)).map((p) => records.find((r) => r.assessmentPeriod === p)).filter(Boolean);
  const previous = records.find((r) => r.assessmentPeriod === PERIODS[index - 1]) || null;
  const validScreening = (r) => Boolean(r && !r.isAbsent && !r.teacherReviewReason && r.philIriScore != null && r.philIriScore >= 0 && r.philIriScore <= 40);
  const passedEarlier = earlier.some((r) => validScreening(r) && evaluateTermResult(r).hasPassed);
  const continuing = previous && evaluateTermResult(previous).outcome === "CONTINUE" && validScreening(previous) &&
    ["Independent", "Instructional", "Frustration"].includes(previous.readingLevel || previous.iraMetrics?.readingProfile);

  // Identify unfinished or unperformed assessments from earlier periods
  const earlierIraPending = earlier.find((r) =>
    validScreening(r) && r.philIriScore < 28 &&
    !["Independent", "Instructional", "Frustration"].includes(r.readingLevel || r.iraMetrics?.readingProfile)
  );
  const earlierAbsent = earlier.find((r) => r.isAbsent);
  const hasIncompleteEarlier = Boolean(!current && index > 0 && !passedEarlier && !continuing && (earlierIraPending || earlierAbsent || earlier.length === 0));
  const incompleteEarlierRecord = earlierIraPending || earlierAbsent || null;
  const incompleteEarlierPeriod = earlierIraPending ? earlierIraPending.assessmentPeriod : earlierAbsent ? earlierAbsent.assessmentPeriod : "BOSY";
  const incompleteEarlierReason = earlierIraPending ? "needs_form3" : earlierAbsent ? "absent" : "missing_screening";

  const screening = validScreening(current) ? current : (!current || current.isAbsent) && continuing ? previous
    : hasIncompleteEarlier && earlierIraPending ? earlierIraPending : null;
  const requiresIndividual = Boolean(activePeriod && (current || !passedEarlier) && screening && screening.philIriScore < 28 && !hasIncompleteEarlier);
  const hasIndividualResult = Boolean(current?.iraMetrics || ["Independent", "Instructional", "Frustration"].includes(current?.readingLevel));
  const isReassessment = current?.iraMetrics?.assessmentKind === "reassessment" && current.screeningPeriod !== activePeriod;
  const mode = !activePeriod ? "invalid" : current ? isReassessment ? "reassessment" : "screening"
    : continuing ? "reassessment" : passedEarlier ? "complete"
    : hasIncompleteEarlier ? "incomplete_earlier" : "screening";
  const earlierCorrectionNeedsReview = Boolean(current && earlier.some((r) =>
    r.rawPayload?.correctionReason && String(r.updated_at || r.updatedAt || "") > String(current.updated_at || current.updatedAt || "")
  ));
  const visibleRecords = records;
  const periodLearner = {
    ...learner,
    philIriScore: null,
    readingLevel: null,
    iraMetrics: null,
    rawPayload: null,
    isAbsent: false,
    candidateStatus: null,
    screeningStatus: null,
    screeningInterpretation: null,
    teacherReviewReason: null,
    progressionOutcome: null,
    ...current,
    readingPeriodProjection: true,
    readingCorrectionNeedsReview: earlierCorrectionNeedsReview,
    assessmentPeriod: activePeriod,
    philIriRecords: visibleRecords,
    hasIncompleteEarlier,
    incompleteEarlierPeriod,
    incompleteEarlierReason,
    incompleteEarlierRecord,
  };
  // Identity and class context come from the roster, never a historical record id.
  periodLearner.id = learner.id;
  periodLearner.studentId = learner.studentId;
  periodLearner.classId = learner.classId;
  periodLearner.subject = learner.subject;
  periodLearner.language = learner.language;
  periodLearner.canEditAssessment = learner.canEditAssessment && (requiresIndividual || (hasIncompleteEarlier && incompleteEarlierReason === "needs_form3"));

  if (hasIncompleteEarlier) {
    if (incompleteEarlierReason === "needs_form3") {
      periodLearner.currentStepKey = "needs_earlier_ira";
      periodLearner.currentStepLabel = `${incompleteEarlierPeriod} Form 3 Needed`;
    } else if (incompleteEarlierReason === "absent") {
      periodLearner.currentStepKey = "absent_earlier";
      periodLearner.currentStepLabel = `Absent in ${incompleteEarlierPeriod}`;
    } else {
      periodLearner.currentStepKey = "missing_earlier";
      periodLearner.currentStepLabel = `${incompleteEarlierPeriod} Not Tested`;
    }
  } else {
    const passedEarlierRecord = earlier.find((r) => validScreening(r) && evaluateTermResult(r).hasPassed);
    if (!current && passedEarlier && passedEarlierRecord) {
      const hasPassedIra = Boolean(
        passedEarlierRecord.iraMetrics ||
        ["Independent", "Instructional", "Frustration"].includes(passedEarlierRecord.readingLevel)
      );
      periodLearner.currentStepKey = hasPassedIra ? "assessment_complete" : "screening_complete_at_grade";
      periodLearner.currentStepLabel = "Completed (Earlier Period)";
      if (passedEarlierRecord.philIriScore != null && periodLearner.philIriScore == null) {
        periodLearner.philIriScore = passedEarlierRecord.philIriScore;
      }
      if (passedEarlierRecord.readingLevel && !periodLearner.readingLevel) {
        periodLearner.readingLevel = passedEarlierRecord.readingLevel;
      }
      if (passedEarlierRecord.iraMetrics && !periodLearner.iraMetrics) {
        periodLearner.iraMetrics = passedEarlierRecord.iraMetrics;
      }
    } else {
      const isEosyReview = activePeriod === "EOSY" && (
        current?.iraMetrics?.progressionOutcome === "For Further Review after EOSY" ||
        current?.iraMetrics?.progressionOutcome === "ARAL Eligible — For Review" ||
        (hasIndividualResult && (current?.readingLevel === "Frustration" || current?.readingLevel === "Instructional"))
      );

      if (isEosyReview) {
        periodLearner.currentStepKey = "for_review";
        periodLearner.currentStepLabel = "ARAL Eligible — For Review";
      } else {
        periodLearner.currentStepKey = current?.isAbsent ? "absent_reschedule" : requiresIndividual
          ? hasIndividualResult ? "assessment_complete" : "needs_individual_assessment"
          : (activePeriod === "BOSY" && validScreening(current) && current.philIriScore >= 28)
          ? "screening_complete_at_grade"
          : hasIndividualResult ? "assessment_complete"
          : "waiting_for_assessment";

        periodLearner.currentStepLabel = current?.isAbsent ? "For Reschedule" : hasIndividualResult ? "Assessment Recorded"
          : requiresIndividual ? (activePeriod === "BOSY" ? "Individual Assessment Needed" : "Reassessment Needed")
          : (activePeriod === "BOSY" && validScreening(current) && current.philIriScore >= 28) ? "Screening Complete" : "Screening Needed";
      }
    }
  }

  const incompleteEarlierLearner = earlierIraPending ? {
    ...periodLearner,
    ...earlierIraPending,
    philIriScore: earlierIraPending.philIriScore,
    screeningPeriod: earlierIraPending.assessmentPeriod,
    assessmentPeriod: earlierIraPending.assessmentPeriod,
    readingWorkflowEligible: true,
  } : null;

  const message = earlierCorrectionNeedsReview ? "An earlier result was corrected. Review this assessment; its saved result and intervention progress have been kept."
    : periodLearner.currentStepKey === "for_review" ? "End of School Year: Reading need remains. Flagged as ARAL Eligible — For Review for authorized school confirmation."
    : passedEarlier && !current ? "No further assessment required. View the learner's reading history."
    : hasIncompleteEarlier ? (
        incompleteEarlierReason === "needs_form3"
          ? `${incompleteEarlierPeriod} GST score is ${incompleteEarlierRecord?.philIriScore}/40. Complete ${incompleteEarlierPeriod} Form 3 assessment before ${activePeriod} reassessment.`
          : incompleteEarlierReason === "absent"
          ? `Learner was absent during ${incompleteEarlierPeriod} screening. Reschedule and record ${incompleteEarlierPeriod} screening first.`
          : `No ${incompleteEarlierPeriod} screening on record. Administer ${incompleteEarlierPeriod} screening test first.`
      )
    : !activePeriod ? "Choose BOSY, MOSY, or EOSY."
    : current?.teacherReviewReason ? "Review the saved screening result before continuing."
    : hasIndividualResult ? "Individual reading assessment recorded."
    : requiresIndividual ? (activePeriod === "BOSY" ? "Individual reading assessment needed." : "Reading reassessment needed.")
    : current?.isAbsent ? "Reschedule the screening test."
    : (activePeriod === "BOSY" && validScreening(current) && current.philIriScore >= 28) ? "Screening complete — at grade level." : "Record the screening test first.";

  return {
    period: activePeriod, mode, current, previous, screening, requiresIndividual, hasIndividualResult, earlierCorrectionNeedsReview,
    hasIncompleteEarlier, incompleteEarlierPeriod, incompleteEarlierReason, incompleteEarlierRecord, incompleteEarlierLearner,
    learner: periodLearner,
    // Earlier screening is context for a teacher-entered reassessment, never a new result on render.
    assessmentLearner: { ...periodLearner, philIriScore: screening?.philIriScore ?? null,
      screeningPeriod: screening?.screeningPeriod, readingWorkflowEligible: requiresIndividual },
    message,
  };
}
