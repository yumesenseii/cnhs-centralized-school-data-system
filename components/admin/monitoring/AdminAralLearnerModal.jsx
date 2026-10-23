"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGradeSection } from "@/lib/monitoring/philIriEvaluation";
import { getLearnerTimelineSummary } from "@/lib/monitoring/aralProgression";
import { aralPeriodLabel } from "@/lib/monitoring/assessmentTimeline";

/**
 * Maps learner reading assessment state to the 6 simplified administrative statuses.
 */
export function getSimplifiedAralStatus(learner) {
  if (!learner) {
    return {
      label: "Pending",
      badgeClass: "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300",
    };
  }

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

  const stepKey = learner.currentStepKey;

  if (stepKey === "for_review") {
    return {
      label: "For Further Review",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    };
  }

  if (isAbsent || isUnderReview || stepKey === "absent_reschedule" || stepKey === "gst_under_review") {
    return {
      label: "Follow-Up Required",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
      detail: isAbsent ? "Absent — Reschedule Needed" : "Teacher Review Note",
    };
  }

  if (stepKey === "needs_individual_assessment") {
    return {
      label: "Needs Assessment",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  if (stepKey === "screening_complete_at_grade") {
    return {
      label: "Screening Complete",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  if (
    stepKey === "assessment_complete" ||
    stepKey === "completed" ||
    stepKey === "reading_profile_available" ||
    stepKey === "assessment_complete_no_support"
  ) {
    return {
      label: "Completed",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }

  return {
    label: "Pending",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300",
  };
}

function getNextStepDescription(stepKey, isGstAtGradeLevel) {
  switch (stepKey) {
    case "waiting_for_assessment":
      return "Awaiting initial reading screening test by the subject teacher.";
    case "needs_individual_assessment":
      return "Screening score is below benchmark. Individual reading assessment is required.";
    case "screening_complete_at_grade":
      return "Screening complete at grade level. Continue regular classroom reading observation.";
    case "assessment_complete":
    case "completed":
      return "Reading assessment complete. Reading profile documented for term monitoring.";
    case "for_review":
      return "Annual reading assessment indicates persistent reading need. Flagged for school head review.";
    case "absent_reschedule":
      return "Learner was absent during assessment. Follow-up reschedule required by teacher.";
    case "gst_under_review":
      return "Teacher review note recorded. Follow-up evaluation in progress.";
    default:
      if (isGstAtGradeLevel) {
        return "Screening complete at grade level. Continue regular classroom reading observation.";
      }
      return "Awaiting next scheduled assessment milestone.";
  }
}

export default function AdminAralLearnerModal({
  isOpen,
  onClose,
  learner = null,
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!isOpen || !learner) return null;

  const language = learner.language || learner.subject || "English";
  const statusInfo = getSimplifiedAralStatus(learner);

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

  // High-level GST result description without heavy codes
  const gstResultText = isAbsent
    ? "Absent — Reschedule Pending"
    : isUnderReview
    ? `${learner.philIriScore} / 40 (Under Review)`
    : learner.philIriScore != null
    ? `${learner.philIriScore} / 40 ${isGstAtGradeLevel ? "(At Grade Level)" : "(Below Benchmark)"}`
    : "Not Recorded";

  // High-level reading profile
  const readingProfileText = isAbsent
    ? "Pending Screening"
    : isUnderReview
    ? "Pending Review"
    : isGstAtGradeLevel
    ? "At Grade Level"
    : hasIra
    ? learner.readingLevel
    : learner.philIriScore != null
    ? "Assessment Needed"
    : "Pending";

  const currentPeriodText = aralPeriodLabel(learner.assessmentPeriod || "BOSY");
  const nextStepText = getNextStepDescription(learner.currentStepKey, isGstAtGradeLevel);

  const learnerGrade =
    learner.currentGrade ?? learner.classSubjectGrade ?? learner.generalAverage ?? null;

  const timeline = getLearnerTimelineSummary(learner);
  const iraMetrics = learner.iraMetrics || learner.rawPayload?.iraMetrics || null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
      >
        {/* 1. LEARNER INFORMATION (HEADER) */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-4 dark:border-white/5">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Principal Oversight · Learner Record
            </span>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase truncate">
              {learner.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              LRN: {learner.lrn || learner.studentNumber || "—"} · {formatGradeSection(learner.grade, learner.section)} · {language}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border",
                statusInfo.badgeClass
              )}
            >
              {statusInfo.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SIMPLE ROWS LAYOUT) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Attention Banner if review note exists */}
          {isUnderReview && (learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>Teacher Observation Note</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed">
                &ldquo;{learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason}&rdquo;
              </p>
            </div>
          )}

          {/* Attention Banner if For Further Review (EOSY) */}
          {learner.currentStepKey === "for_review" && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle size={14} className="text-rose-600 shrink-0" />
                <span>End-of-Year Oversight: For Further Review</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-rose-800 dark:text-rose-200">
                Learner has remaining reading difficulty across terms. Flagged for school head review and consideration.
              </p>
            </div>
          )}

          {/* 2. CURRENT READING STATUS */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Current Reading Status
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs dark:divide-white/5 dark:border-white/10 dark:bg-slate-900/40">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">Current Period</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{currentPeriodText}</span>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">GST Result</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{gstResultText}</span>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">Reading Profile</span>
                <span
                  className={cn(
                    "font-bold",
                    readingProfileText === "At Grade Level" || readingProfileText === "Independent"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : readingProfileText === "Instructional"
                      ? "text-amber-700 dark:text-amber-400"
                      : readingProfileText === "Frustration"
                      ? "text-rose-700 dark:text-rose-400"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {readingProfileText}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400 shrink-0">Next Step</span>
                <span className="text-right text-slate-800 dark:text-slate-200 font-medium">
                  {nextStepText}
                </span>
              </div>
            </div>
          </section>

          {/* 3. ASSESSMENT HISTORY */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assessment History
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs dark:divide-white/5 dark:border-white/10 dark:bg-slate-900/40">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">BOSY (Beginning)</span>
                  <span className="ml-2 text-[11px] text-slate-400">Baseline Screening</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{timeline.term1.status}</span>
                  {timeline.term1.sub && (
                    <span className="block text-[10.5px] text-slate-400">{timeline.term1.sub}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">MOSY (Midyear)</span>
                  <span className="ml-2 text-[11px] text-slate-400">Reassessment</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{timeline.term2.status}</span>
                  {timeline.term2.sub && (
                    <span className="block text-[10.5px] text-slate-400">{timeline.term2.sub}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">EOSY (End of Year)</span>
                  <span className="ml-2 text-[11px] text-slate-400">Final Outcome</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{timeline.term3.status}</span>
                  {timeline.term3.sub && (
                    <span className="block text-[10.5px] text-slate-400">{timeline.term3.sub}</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 4. ACADEMIC CONTEXT */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Academic Context
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-xs dark:divide-white/5 dark:border-white/10 dark:bg-slate-900/40">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">Subject</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{language}</span>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">Current Grade</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {learnerGrade !== null ? `${learnerGrade} / 100` : "Not recorded"}
                </span>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="font-medium text-slate-500 dark:text-slate-400">Assigned Teacher</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {learner.assessorTeacherName || "Subject Teacher"}
                </span>
              </div>
            </div>
          </section>

          {/* 5. PROGRESSIVE DISCLOSURE: TECHNICAL METRICS (COLLAPSIBLE) */}
          <section className="rounded-lg border border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-slate-900/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails((prev) => !prev)}
              className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100/60 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <span className="text-slate-600 dark:text-slate-400">
                {showTechnicalDetails ? "Hide" : "Show"} Detailed Assessment Metrics & Passage Scores
              </span>
              <ChevronDown
                size={14}
                className={cn("text-slate-400 transition-transform duration-200", showTechnicalDetails && "rotate-180")}
              />
            </button>

            <AnimatePresence>
              {showTechnicalDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="border-t border-slate-200 p-3.5 text-xs dark:border-white/10 space-y-3"
                >
                  <p className="text-[11px] text-slate-400">
                    Phil-IRI reference forms (Form 1 screening / Form 3 oral assessment metrics)
                  </p>

                  {iraMetrics ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Passage Level</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.passageLevel || "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Total Words</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.totalWords != null ? iraMetrics.totalWords : "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Miscues</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.miscues != null ? iraMetrics.miscues : "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Reading Time</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.readingTimeSeconds
                            ? `${Math.floor(iraMetrics.readingTimeSeconds / 60)}m ${iraMetrics.readingTimeSeconds % 60}s`
                            : "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Word Reading</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.wordReadingPct != null ? `${iraMetrics.wordReadingPct}%` : "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Comprehension</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.comprehensionPct != null ? `${iraMetrics.comprehensionPct}%` : "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Reading Rate</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.readingRateWpm ? `${iraMetrics.readingRateWpm} WPM` : "—"}
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2 dark:border-white/5 dark:bg-slate-800">
                        <span className="text-[10px] text-slate-400 block">Oral Profile</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {iraMetrics.readingProfile || "—"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-slate-500 italic">
                      No Form 3 individual oral metrics recorded for this candidate.
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-white/5 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
