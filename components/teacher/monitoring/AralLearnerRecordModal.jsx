"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Plus, Loader2 } from "lucide-react";
import {
  listAralProgressChecks,
  saveAralProgressCheck,
} from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

const FOCUS_AREAS = [
  "Reading Fluency",
  "Comprehension",
  "Phonemic Awareness",
  "Word Recognition",
  "Vocabulary",
];

const PROGRESS_RESULTS = [
  "Improving",
  "Satisfactory",
  "Needs More Practice",
];

function getWhatHappensNowExplanation(stepKey, isGstAtGradeLevel) {
  switch (stepKey) {
    case "waiting_for_assessment":
      return "The initial reading screening test has not yet been recorded. A screening test is needed to determine the learner's reading level.";
    case "needs_individual_assessment":
      return "The screening score indicates that an individual reading assessment is needed. Please administer the reading passage assessment.";
    case "support_review":
      return "The learner’s reading result is under review. Final support decision is still pending.";
    case "waiting_for_facilitator":
      return "The reading assessment is complete. Waiting for the school administration to assign a reading support teacher.";
    case "waiting_for_support":
      return "The reading assessment is complete and a support teacher is assigned. Reading support sessions may now begin.";
    case "under_aral_support":
      return "The learner is actively receiving reading support. Regular progress updates can be logged as sessions take place.";
    case "progress_check_due":
      return "A scheduled progress check is due to track this learner's ongoing reading development.";
    case "completed":
      return isGstAtGradeLevel
        ? "The learner scored at grade level on the screening test. No additional reading intervention is required."
        : "Reading support has been completed. No further action is required at this time.";
    default:
      if (isGstAtGradeLevel) {
        return "The learner’s reading result is under review. Final support decision is still pending.";
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
    case "support_review":
      return "Wait for the final support decision.";
    case "waiting_for_facilitator":
      return "Waiting for school administration to assign a reading support teacher.";
    case "waiting_for_support":
      return "Begin reading support sessions with this learner.";
    case "under_aral_support":
      return "Conduct regular reading support sessions and log progress.";
    case "progress_check_due":
      return "Submit a progress check for this learner.";
    case "completed":
      return "No further action required. Learner is at grade level or has completed reading support.";
    default:
      if (isGstAtGradeLevel) {
        return "Wait for the final support decision.";
      }
      return "Wait for authorized review or further instructions.";
  }
}

export default function AralLearnerRecordModal({
  isOpen,
  onClose,
  learner = null,
  teacherId = null,
  onOpenAssessment,
  onRefresh,
}) {
  const { showToast } = useAppToast();
  const [progressChecks, setProgressChecks] = useState([]);
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);

  // Simplified progress check form state
  const [focusArea, setFocusArea] = useState("Reading Fluency");
  const [progressResult, setProgressResult] = useState("Improving");
  const [teacherNote, setTeacherNote] = useState("");
  const [nextStep, setNextStep] = useState("");

  const studentId = learner?.studentId || learner?.id;

  // Load progress checks only if modal is open and learner has an ID
  useEffect(() => {
    if (!isOpen || !studentId) return;

    let isMounted = true;
    listAralProgressChecks(studentId)
      .then((res) => {
        if (isMounted) {
          setProgressChecks(res.data || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load progress checks:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, studentId]);

  if (!isOpen || !learner) return null;

  const language = learner.language || learner.subject || "English";
  const stepMeta = learner.currentStepMeta || {};

  const isGstAtGradeLevel =
    learner.philIriScore != null && Number(learner.philIriScore) >= 28;

  const hasIra = Boolean(
    learner.readingLevel &&
    learner.readingLevel !== "Not Screened" &&
    learner.readingLevel !== "Not Assessed" &&
    learner.readingLevel !== "Not Set" &&
    learner.readingLevel !== "At Grade Level"
  );

  // Only show progress section if reading support intervention has actually started
  const hasSupportStarted = Boolean(
    learner.supportStarted ||
    learner.date_started ||
    Number(learner.weeklyUpdateCount) > 0 ||
    Number(learner.activeSessionsCount) > 0 ||
    learner.currentStepKey === "under_aral_support" ||
    learner.currentStepKey === "progress_check_due"
  );

  const handleSaveProgressCheck = async (e) => {
    e.preventDefault();
    setSavingCheck(true);
    try {
      const res = await saveAralProgressCheck({
        studentId,
        teacherId,
        activityName: focusArea,
        competency: teacherNote ? `${focusArea} — ${teacherNote}` : focusArea,
        result: progressResult,
        teacherObservation: teacherNote,
        nextAction: nextStep,
      });

      if (res.error) {
        showToast("error", "We couldn’t save this progress update. Please try again.");
        return;
      }

      showToast("success", "Progress update recorded.");
      setTeacherNote("");
      setNextStep("");
      setShowAddCheck(false);

      const updated = await listAralProgressChecks(studentId);
      setProgressChecks(updated.data || []);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "We couldn’t save this progress update. Please try again.");
    } finally {
      setSavingCheck(false);
    }
  };

  const readingResultValue = isGstAtGradeLevel
    ? "At Grade Level"
    : hasIra
    ? learner.readingLevel
    : "Pending";

  const readingResultSource = isGstAtGradeLevel
    ? "From Screening Test"
    : hasIra
    ? "From Individual Assessment"
    : "Awaiting Assessment";

  const readingResultColor =
    isGstAtGradeLevel || learner.readingLevel === "Independent"
      ? "text-emerald-700 dark:text-emerald-400"
      : learner.readingLevel === "Instructional"
      ? "text-amber-700 dark:text-amber-400"
      : learner.readingLevel === "Frustration"
      ? "text-rose-700 dark:text-rose-400"
      : "text-slate-500 dark:text-slate-400";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
      >
        {/* 1. HEADER */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-4 dark:border-white/5">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Reading Support Record
            </span>
            <h2 className="mt-0.5 text-base sm:text-lg font-bold text-slate-900 dark:text-white uppercase truncate">
              {learner.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              LRN {learner.lrn || learner.studentNumber || "—"} · {learner.gradeSectionDisplay || `Grade ${learner.grade || "7"} – ${learner.section || "Section"}`} · {language}
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
          {/* 2. CURRENT STATUS */}
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-900 dark:text-blue-300">
              What happens now?
            </span>
            <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
              {getWhatHappensNowExplanation(learner.currentStepKey, isGstAtGradeLevel)}
            </p>
          </section>

          {/* 3. READING RESULT */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Reading Result
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Card 1: Screening Test */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Screening Test
                </span>
                <span className="text-[9.5px] text-slate-400 block">
                  Phil-IRI {language === "Filipino" ? "Form 1A" : "Form 1B"}
                </span>
                <p className="mt-2 font-bold text-slate-900 dark:text-white text-base">
                  {learner.philIriScore != null ? `${learner.philIriScore} / 40` : "Not recorded"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {learner.philIriScore != null
                    ? isGstAtGradeLevel
                      ? "At Grade Level"
                      : "Needs Reading Assessment"
                    : "Screening pending"}
                </span>
              </div>

              {/* Card 2: Individual Reading Assessment */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Individual Reading Assessment
                </span>
                <span className="text-[9.5px] text-slate-400 block">
                  Phil-IRI {language === "Filipino" ? "Form 3A" : "Form 3B"}
                </span>
                <p className="mt-2 font-bold text-slate-900 dark:text-white text-base">
                  {isGstAtGradeLevel
                    ? "Not Needed"
                    : hasIra
                    ? "Completed"
                    : learner.philIriScore != null
                    ? "Pending Assessment"
                    : "Not yet assessed"}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {isGstAtGradeLevel
                    ? "Meets GST Benchmark"
                    : hasIra
                    ? (learner.screeningInterpretation || "Graded Passage Assessed")
                    : "Reading passage needed"}
                </span>
              </div>

              {/* Card 3: Reading Result (Never called Reading Profile when no Form 3) */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Reading Result
                </span>
                <span className="text-[9.5px] text-slate-400 block">
                  {readingResultSource}
                </span>
                <p className={cn("mt-2 font-bold text-base", readingResultColor)}>
                  {readingResultValue}
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {readingResultSource}
                </span>
              </div>
            </div>
          </section>

          {/* 4. ASSIGNED TEACHERS */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Assigned Teachers
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Reading Assessment
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {learner.assessorTeacherName || `${language} Subject Teacher`}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {learner.assessorRole || "Subject Teacher"}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Reading Support
                </span>
                <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                  {learner.aralFacilitatorName || "Not yet assigned"}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {learner.aralFacilitatorAssigned ? "Assigned Support Teacher" : "Pending assignment"}
                </span>
              </div>
            </div>
          </section>

          {/* 5. PROGRESS UPDATES (CONDITIONAL: Only shown when support has started) */}
          {hasSupportStarted && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Progress Updates
                  </span>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {progressChecks.length > 0
                      ? `${progressChecks.length} progress update${progressChecks.length > 1 ? "s" : ""} recorded`
                      : "No progress updates recorded yet"}
                  </p>
                </div>

                {!showAddCheck && (
                  <button
                    type="button"
                    onClick={() => setShowAddCheck(true)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#246f54]/10 px-3 py-1.5 text-xs font-semibold text-[#246f54] hover:bg-[#246f54]/20 transition dark:text-emerald-400 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Progress Update</span>
                  </button>
                )}
              </div>

              {/* Simplified Add Progress Form */}
              {showAddCheck && (
                <form
                  onSubmit={handleSaveProgressCheck}
                  className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 space-y-3 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      New Progress Update
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCheck(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        Focus Area
                      </label>
                      <select
                        value={focusArea}
                        onChange={(e) => setFocusArea(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium dark:bg-slate-800 dark:border-white/10"
                      >
                        {FOCUS_AREAS.map((fa) => (
                          <option key={fa} value={fa}>
                            {fa}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        Progress
                      </label>
                      <select
                        value={progressResult}
                        onChange={(e) => setProgressResult(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium dark:bg-slate-800 dark:border-white/10"
                      >
                        {PROGRESS_RESULTS.map((pr) => (
                          <option key={pr} value={pr}>
                            {pr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        Teacher Note (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Can read short phrases with minimal assistance"
                        value={teacherNote}
                        onChange={(e) => setTeacherNote(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:bg-slate-800 dark:border-white/10"
                      >
                      </input>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-1">
                        Next Step (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Practice multisyllabic vocabulary words"
                        value={nextStep}
                        onChange={(e) => setNextStep(e.target.value)}
                        className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs dark:bg-slate-800 dark:border-white/10"
                      >
                      </input>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingCheck}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] disabled:opacity-50 cursor-pointer"
                    >
                      {savingCheck ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Progress</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Progress checks list */}
              {progressChecks.length > 0 && (
                <div className="space-y-2 pt-1">
                  {progressChecks.map((check, idx) => (
                    <div
                      key={check.id || idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-100 dark:bg-slate-900/40 dark:border-white/5"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {check.activity_name || "Reading Session"}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {check.check_date || "Recent"}
                          </span>
                        </div>
                        {check.teacher_observation && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            {check.teacher_observation}
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shrink-0 self-start sm:self-center",
                          check.result === "Improving" || check.result === "Mastered Target Competency"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        )}
                      >
                        {check.result}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 6. NEXT ACTION */}
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-800/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Next Action
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              {getNextActionText(learner.currentStepKey, isGstAtGradeLevel)}
            </p>
          </section>
        </div>

        {/* 7. FOOTER */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5 bg-slate-50/50 dark:border-white/5 dark:bg-slate-800/40">
          {onOpenAssessment &&
            (learner.currentStepKey === "waiting_for_assessment" ||
              learner.currentStepKey === "needs_individual_assessment") && (
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
                    ? "Start Screening"
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
