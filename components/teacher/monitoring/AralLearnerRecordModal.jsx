"use client";

import { motion } from "framer-motion";
import { X, BookOpen, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluateAcademicAndReadingGuidance } from "@/lib/monitoring/academicAndReadingGuidance";
import { formatGradeSection } from "@/lib/monitoring/philIriEvaluation";
import { getLearnerTimelineSummary } from "@/lib/monitoring/aralProgression";

function getWhatHappensNowExplanation(stepKey, isGstAtGradeLevel) {
  switch (stepKey) {
    case "waiting_for_assessment":
      return "The initial GST reading screening test has not yet been recorded. A screening test is needed to determine the learner's reading level.";
    case "needs_individual_assessment":
      return "The GST screening score is below 28, indicating that a more detailed reading assessment is needed. The subject teacher administers the Form 3 Individual Reading Assessment.";
    case "screening_complete_at_grade":
      return "The learner scored 28–40 on the GST screening test and is performing at grade level. No individual reading assessment is required.";
    case "assessment_complete":
      return "The Individual Reading Assessment (Form 3) has been completed and recorded. The learner's reading profile is documented.";
    case "for_review":
      return "End of School Year: Reading need remains across terms. The learner is flagged For Further Review (Informational: Possible ARAL Summer Consideration). Actual summer program implementation is managed externally.";
    case "absent_reschedule":
      return "The learner was absent during the reading assessment. The assessment is scheduled for reschedule by the subject teacher.";
    case "gst_under_review":
      return "The GST screening score was flagged for teacher review or observation. The raw score is preserved with an audit trail.";
    default:
      if (isGstAtGradeLevel) {
        return "The learner scored 28–40 on the GST screening test and is performing at grade level.";
      }
      return "The learner's reading record is active and currently being monitored.";
  }
}

function getNextActionText(stepKey, isGstAtGradeLevel) {
  switch (stepKey) {
    case "waiting_for_assessment":
      return "Administer the Phil-IRI Screening Test (GST) to this learner.";
    case "needs_individual_assessment":
      return "Conduct the Phil-IRI Individual Reading Assessment (Form 3).";
    case "screening_complete_at_grade":
      return "Screening complete at grade level. Continue regular classroom reading observation.";
    case "assessment_complete":
      return "Reading assessment complete. Monitor reading progress in subsequent school terms.";
    case "for_review":
      return "Review annual reading progress profile for school head oversight.";
    case "absent_reschedule":
      return "Administer the rescheduled GST screening test.";
    case "gst_under_review":
      return "Review the GST score and complete teacher observation.";
    default:
      if (isGstAtGradeLevel) {
        return "Continue regular classroom reading observation.";
      }
      return "Wait for term assessment updates.";
  }
}

export default function AralLearnerRecordModal({
  isOpen,
  onClose,
  learner = null,
  teacherId = null,
  onOpenAssessment,
}) {
  if (!isOpen || !learner) return null;

  const language = learner.language || learner.subject || "English";
  const stepMeta = learner.currentStepMeta || {};

  const isAbsent = Boolean(
    learner.isAbsent ||
    learner.candidateStatus === "Absent / For Reschedule" ||
    learner.screeningStatus === "Absent / For Reschedule" ||
    learner.rawPayload?.isAbsent
  );

  const isUnderReview = Boolean(
    learner.candidateStatus === "For Review" &&
    (learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason)
  );

  const isGstAtGradeLevel =
    !isAbsent && learner.philIriScore != null && Number(learner.philIriScore) >= 28;

  const hasIra = Boolean(
    !isAbsent &&
    learner.readingLevel &&
    learner.readingLevel !== "Not Screened" &&
    learner.readingLevel !== "Not Assessed" &&
    learner.readingLevel !== "Not Set" &&
    learner.readingLevel !== "Pending Oral Profile" &&
    learner.readingLevel !== "Pending Individual Assessment" &&
    learner.readingLevel !== "At Grade Level"
  );

  const readingResultValue = isAbsent
    ? "Absent / For Reschedule"
    : isUnderReview
    ? "GST Under Review"
    : isGstAtGradeLevel
    ? "At Grade Level"
    : hasIra
    ? learner.readingLevel
    : "Pending Assessment";

  const readingResultSource = isAbsent
    ? "Screening Reschedule Pending"
    : isUnderReview
    ? "Teacher Review Flagged"
    : isGstAtGradeLevel
    ? "From Screening Test (GST)"
    : hasIra
    ? "From Individual Assessment (Form 3)"
    : "Awaiting Assessment";

  const readingResultColor = isAbsent
    ? "text-slate-600 dark:text-slate-400"
    : isUnderReview
    ? "text-amber-700 dark:text-amber-400"
    : isGstAtGradeLevel || learner.readingLevel === "Independent"
    ? "text-emerald-700 dark:text-emerald-400"
    : learner.readingLevel === "Instructional"
    ? "text-amber-700 dark:text-amber-400"
    : learner.readingLevel === "Frustration"
    ? "text-rose-700 dark:text-rose-400"
    : "text-slate-500 dark:text-slate-400";

  const learnerGrade =
    learner.currentGrade ?? learner.classSubjectGrade ?? learner.generalAverage ?? null;

  const guidanceInfo = evaluateAcademicAndReadingGuidance({
    grade: learnerGrade,
    gstScore: learner.philIriScore,
    readingLevel: learner.readingLevel,
    hasFlaggedConcern: Boolean(learner.teacherRemarks?.includes("Flagged Reading Concern")),
  });

  const iraMetrics = learner.iraMetrics || learner.rawPayload?.iraMetrics || null;
  const timeline = getLearnerTimelineSummary(learner);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
      >
        {/* 1. HEADER */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-4 dark:border-white/5">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Reading Assessment Record
            </span>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase truncate">
              {learner.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              LRN {learner.lrn || learner.studentNumber || "—"} · {formatGradeSection(learner.grade, learner.section)} · {language}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold border",
                stepMeta.badgeClass || "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {learner.currentStepLabel || "Under Review"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 2. CURRENT STATUS GUIDANCE */}
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-300">
              Assessment Guidance
            </span>
            <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {getWhatHappensNowExplanation(learner.currentStepKey, isGstAtGradeLevel)}
            </p>
          </section>

          {/* EOSY For Further Review Informational Banner */}
          {learner.currentStepKey === "for_review" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>End-of-Year Outcome: For Further Review</span>
              </div>
              <p className="mt-1 text-[11.5px] text-rose-800 dark:text-rose-300 leading-relaxed">
                Informational: Possible ARAL Summer Consideration. Actual ARAL Summer enrollment, scheduling, and facilitator management are administered externally outside CNHS LEARN.
              </p>
            </div>
          )}

          {/* 3. READING RESULT SUMMARY (3 CARDS) */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Reading Assessment Result
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Card 1: Screening Test */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Screening Test (GST)
                </span>
                <span className="text-[9.5px] text-slate-400 block">
                  Phil-IRI {language === "Filipino" ? "Form 1A" : "Form 1B"}
                </span>
                <p className="mt-2 font-bold text-slate-900 dark:text-white text-base">
                  {isAbsent
                    ? "Absent"
                    : learner.philIriScore != null
                    ? `${learner.philIriScore} / 40`
                    : "Not recorded"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isAbsent
                    ? "For Reschedule"
                    : isUnderReview
                    ? "Under Review"
                    : learner.philIriScore != null
                    ? isGstAtGradeLevel
                      ? "At Grade Level"
                      : "Needs Reading Assessment"
                    : "Screening pending"}
                </span>
              </div>

              {/* Card 2: Individual Reading Assessment */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Individual Assessment
                </span>
                <span className="text-[9.5px] text-slate-400 block">
                  Phil-IRI {language === "Filipino" ? "Form 3A" : "Form 3B"}
                </span>
                <p className="mt-2 font-bold text-slate-900 dark:text-white text-base">
                  {isAbsent
                    ? "Pending Screening"
                    : isGstAtGradeLevel
                    ? "Not Required"
                    : hasIra
                    ? "Completed"
                    : isUnderReview
                    ? "Review First"
                    : learner.philIriScore != null
                    ? "Pending Assessment"
                    : "Not yet assessed"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isAbsent
                    ? "Reschedule screening test"
                    : isGstAtGradeLevel
                    ? "Score 28–40 meets benchmark"
                    : hasIra
                    ? (learner.screeningInterpretation || "Graded Passage Assessed")
                    : isUnderReview
                    ? "Awaiting review resolution"
                    : "Reading passage needed"}
                </span>
              </div>

              {/* Card 3: Reading Profile */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Reading Profile
                </span>
                <span className="text-[9.5px] text-slate-400 block">
                  {readingResultSource}
                </span>
                <p className={cn("mt-2 font-bold text-base", readingResultColor)}>
                  {readingResultValue}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isGstAtGradeLevel
                    ? "At Grade Level (Screening)"
                    : hasIra
                    ? "From Oral Reading Metrics"
                    : "Pending Assessment"}
                </span>
              </div>
            </div>

            {/* Teacher Review Note */}
            {isUnderReview && (learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <span>Teacher Review Note:</span>
                </p>
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                  &ldquo;{learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason}&rdquo;
                </p>
                <p className="mt-1 text-[10px] text-amber-600/80 dark:text-amber-400/80">
                  Raw score preserved with teacher audit trail. No reading profile assigned from GST alone.
                </p>
              </div>
            )}

            {/* Form 3 Oral Reading Metrics (Detailed breakdown moved here from table) */}
            {iraMetrics && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs dark:border-white/5 dark:bg-slate-900/40 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Form 3 Oral Reading Metrics & Passage Details
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Passage Level</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.passageLevel || "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Total Words</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.totalWords != null ? iraMetrics.totalWords : "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Reading Miscues</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.miscues != null ? iraMetrics.miscues : "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Reading Time</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.readingTimeSeconds
                        ? `${Math.floor(iraMetrics.readingTimeSeconds / 60)}m ${iraMetrics.readingTimeSeconds % 60}s`
                        : "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Word Reading</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.wordReadingPct != null ? `${iraMetrics.wordReadingPct}%` : "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Comprehension</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.comprehensionPct != null ? `${iraMetrics.comprehensionPct}%` : "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Reading Rate</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {iraMetrics.readingRateWpm ? `${iraMetrics.readingRateWpm} WPM` : "—"}
                    </span>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                    <span className="text-[9.5px] text-slate-400 block">Reading Profile</span>
                    <span className={cn(
                      "font-bold",
                      iraMetrics.readingProfile === "Independent"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : iraMetrics.readingProfile === "Instructional"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-rose-700 dark:text-rose-400"
                    )}>
                      {iraMetrics.readingProfile || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 4. SCHOOL-YEAR ASSESSMENT PROGRESSION (Term 1, 2, 3) */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              School Year Assessment Timeline
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Term 1 (Beginning / BOSY)
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {timeline.term1.status}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {timeline.term1.sub}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Term 2 (Middle / MOSY)
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {timeline.term2.status}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {timeline.term2.sub}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Term 3 (End / EOSY)
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {timeline.term3.status}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {timeline.term3.sub}
                </span>
              </div>
            </div>
          </section>

          {/* 5. ACADEMIC PERFORMANCE CONTEXT */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Academic Performance Context
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold",
                  guidanceInfo.badgeStyle
                )}
              >
                {guidanceInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Subject
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                  {learner.subject || learner.primarySubject || language}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Current Grade
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {learnerGrade !== null ? `${learnerGrade} / 100` : "Not recorded"}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Academic Monitoring Status
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {learner.monitoringStatus || "Regular Observation"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-white/5 dark:bg-slate-900/40 dark:text-slate-300">
              <span className="font-semibold text-slate-500 mr-1.5 text-[11px]">Teacher Note:</span>
              <span className="text-[11.5px]">{guidanceInfo.sentence}</span>
            </div>
          </section>

          {/* 6. ASSIGNED SUBJECT TEACHER */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Assigned Reading Teacher
            </span>

            <div
              className={cn(
                "rounded-xl p-3 border text-xs",
                learner.isMissingLanguageTeacher
                  ? "bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40"
                  : "bg-slate-50 border-slate-100 dark:bg-slate-900/40 dark:border-white/5"
              )}
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {language} Reading Assessment Teacher
              </span>
              <p
                className={cn(
                  "mt-1 font-semibold text-xs",
                  learner.isMissingLanguageTeacher
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-slate-800 dark:text-slate-200"
                )}
              >
                {learner.assessorTeacherName || "Reading assessment teacher not found."}
              </p>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {learner.isMissingLanguageTeacher
                  ? "Flagged for admin review · No language teacher assigned"
                  : learner.assessorRole || `${language} Subject Teacher`}
              </span>
            </div>
          </section>

          {/* 7. NEXT ACTION */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Next Action
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              {getNextActionText(learner.currentStepKey, isGstAtGradeLevel)}
            </p>
          </section>
        </div>

        {/* 8. FOOTER */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50 dark:border-white/5 dark:bg-slate-800/40">
          {onOpenAssessment &&
            learner.canEditAssessment &&
            (learner.currentStepKey === "waiting_for_assessment" ||
              learner.currentStepKey === "absent_reschedule" ||
              learner.currentStepKey === "needs_individual_assessment" ||
              learner.currentStepKey === "gst_under_review") && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAssessment(learner);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] transition cursor-pointer"
              >
                <span>
                  {learner.currentStepKey === "waiting_for_assessment"
                    ? "Start Assessment"
                    : learner.currentStepKey === "absent_reschedule"
                    ? "Reschedule Assessment"
                    : learner.currentStepKey === "gst_under_review"
                    ? "Review Result"
                    : "Continue Assessment"}
                </span>
              </button>
            )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
