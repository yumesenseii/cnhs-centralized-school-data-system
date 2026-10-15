"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  FileText,
  User,
  ArrowRight,
} from "lucide-react";
import {
  listAralProgressChecks,
  saveAralProgressCheck,
} from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AralLearnerRecordModal({
  isOpen,
  onClose,
  learner = null,
  teacherId = null,
  schoolYear = "SY 2026-2027",
  onOpenAssessment,
  onRefresh,
}) {
  const { showToast } = useAppToast();
  const [progressChecks, setProgressChecks] = useState([]);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);

  // New progress check form
  const [activityName, setActivityName] = useState("");
  const [competency, setCompetency] = useState("");
  const [result, setResult] = useState("Improving");
  const [nextAction, setNextAction] = useState("");

  const studentId = learner?.studentId || learner?.id;
  const isAssignedToMe = Boolean(
    learner?.aralFacilitatorAssigned &&
    (!teacherId || learner?.aralFacilitatorTeacherId === teacherId)
  );

  // Load progress checks
  useEffect(() => {
    if (!isOpen || !studentId) return;

    let isMounted = true;
    setLoadingChecks(true);
    listAralProgressChecks(studentId)
      .then((res) => {
        if (isMounted) {
          setProgressChecks(res.data || []);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingChecks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, studentId]);

  if (!isOpen || !learner) return null;

  const language = learner.language || learner.subject || "English";
  const stepMeta = learner.currentStepMeta || {};

  // Why this learner is here
  const whyHere = learner.aralApprovalStatus === "approved"
    ? "Reading concern was confirmed in Academic Monitoring and approved for assessment by the school principal."
    : learner.aralFacilitatorAssigned
    ? "Assigned for beginning reading assessment and support."
    : "Referred for beginning reading assessment.";

  // Latest progress
  const latestCheck = progressChecks[0] || null;
  const latestUpdateText = latestCheck
    ? `${latestCheck.result} (${latestCheck.check_date || "Recent"})`
    : learner.inAralProgram
    ? "Needs Initial Progress Update"
    : "No Update Yet";

  const handleSaveProgressCheck = async (e) => {
    e.preventDefault();
    if (!activityName || !competency) {
      showToast("error", "Please provide activity name and target competency.");
      return;
    }

    setSavingCheck(true);
    try {
      const res = await saveAralProgressCheck({
        studentId,
        teacherId,
        activityName,
        competency,
        result,
        nextAction,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to save progress check.");
        return;
      }

      showToast("success", "Progress check recorded.");
      setActivityName("");
      setCompetency("");
      setNextAction("");
      setShowAddCheck(false);

      // Refresh checks
      const updated = await listAralProgressChecks(studentId);
      setProgressChecks(updated.data || []);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Error saving progress check.");
    } finally {
      setSavingCheck(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 pb-4 dark:border-white/5">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              ARAL Learner Record
            </span>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900 dark:text-white uppercase truncate">
              {learner.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
              LRN {learner.lrn || learner.studentNumber || "—"} · {learner.gradeSectionDisplay || `${learner.grade} - ${learner.section}`} · {language}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border",
                stepMeta.badgeClass || "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              {learner.currentStepLabel || "Under Review"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Why this learner is here */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-xs text-slate-600 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Why this learner is here: </span>
          <span>{whyHere}</span>
        </div>

        {/* Scrollable Body: Horizontal 2-Column Balanced Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {/* ROW 1: Current Step & Current Support (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-stretch">
            {/* 1. CURRENT STEP */}
            <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-800/60">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  1. Current Step
                </span>
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border",
                    stepMeta.badgeClass
                  )}
                >
                  Active
                </span>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                {learner.currentStepLabel || "Waiting for Assessment"}
              </p>
            </section>

            {/* 3. CURRENT SUPPORT */}
            <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                3. Current Support
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Program / Track</span>
                  <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {learner.inAralProgram
                      ? (learner.aralProgramName || (learner.readingNeed ? `ARAL - ${learner.readingNeed}` : "ARAL Reading Intervention"))
                      : learner.readingLevel === "Independent"
                      ? "None (Independent)"
                      : learner.readingLevel === "Instructional"
                      ? "Guided Reading Review"
                      : "No active ARAL intervention"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Assigned Facilitator</span>
                  <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {learner.aralFacilitatorName || "Pending Assignment"}
                  </p>
                </div>
              </div>

              {!learner.inAralProgram && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs">
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    {learner.readingLevel === "Independent"
                      ? "Assessment complete. No ARAL support needed."
                      : "Classroom remedial is managed in Academic Monitoring."}
                  </p>
                  <a
                    href="/teacher/monitoring"
                    className="text-[11px] font-semibold text-[#246f54] hover:underline shrink-0 ml-1.5"
                  >
                    Go &rarr;
                  </a>
                </div>
              )}
            </section>
          </div>

          {/* ROW 2: Reading Assessment (Full Width) */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                2. Reading Assessment
              </span>
              {isAssignedToMe && onOpenAssessment && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAssessment(learner);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#246f54] hover:underline cursor-pointer"
                >
                  <span>{learner.philIriScore != null ? "Update Assessment" : "Record Assessment"}</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Group Screening</span>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {learner.philIriScore != null ? `${learner.philIriScore}/40` : "Not recorded"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Individual Assessment</span>
                <p className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                  {learner.readingLevel && learner.readingLevel !== "Not Screened"
                    ? "Completed"
                    : learner.philIriScore != null && Number(learner.philIriScore) >= 28
                    ? "Not Required"
                    : "Pending"}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Reading Profile</span>
                <p
                  className={cn(
                    "mt-1 font-bold",
                    learner.readingLevel === "Independent"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : learner.readingLevel === "Instructional"
                      ? "text-amber-600 dark:text-amber-400"
                      : learner.readingLevel === "Frustration"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400"
                  )}
                >
                  {learner.readingLevel || "Not yet assessed"}
                </p>
              </div>
            </div>

            {learner.screeningInterpretation && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Assessment Level: {learner.screeningInterpretation}
              </p>
            )}
          </section>

          {/* ROW 3: Progress & Assessment History (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
            {/* 4. PROGRESS */}
            <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    4. Progress
                  </span>
                  <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    Latest: {latestUpdateText}
                  </p>
                </div>
                {isAssignedToMe && learner.inAralProgram && !showAddCheck && (
                  <button
                    type="button"
                    onClick={() => setShowAddCheck(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Update</span>
                  </button>
                )}
              </div>

              {/* Inline Add Check Form */}
              {showAddCheck && (
                <form onSubmit={handleSaveProgressCheck} className="rounded-xl border border-[#246f54]/30 bg-[#246f54]/5 p-2.5 space-y-2 dark:bg-[#246f54]/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#246f54]">New Progress Check</span>
                    <button
                      type="button"
                      onClick={() => setShowAddCheck(false)}
                      className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <input
                      type="text"
                      placeholder="Activity name (e.g. Guided Phonics)"
                      value={activityName}
                      onChange={(e) => setActivityName(e.target.value)}
                      required
                      className="w-full h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:bg-slate-800 dark:border-white/10"
                    />
                    <input
                      type="text"
                      placeholder="Competency (e.g. CVC Blending)"
                      value={competency}
                      onChange={(e) => setCompetency(e.target.value)}
                      required
                      className="w-full h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:bg-slate-800 dark:border-white/10"
                    />
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      className="w-full h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:bg-slate-800 dark:border-white/10"
                    >
                      <option value="Improving">Improving</option>
                      <option value="Needs Continued Support">Needs Continued Support</option>
                      <option value="Mastered Target Competency">Mastered Competency</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Next action (optional)"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      className="w-full h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:bg-slate-800 dark:border-white/10"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingCheck}
                      className="rounded-lg bg-[#246f54] px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-[#1b5842] disabled:opacity-50 cursor-pointer"
                    >
                      {savingCheck ? "Saving..." : "Save Check"}
                    </button>
                  </div>
                </form>
              )}

              {/* Previous checks list */}
              {progressChecks.length > 0 && (
                <div className="space-y-1 pt-1">
                  {progressChecks.slice(0, 2).map((check, idx) => (
                    <div
                      key={check.id || idx}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-[10.5px] border border-slate-100 dark:bg-slate-800 dark:border-white/5"
                    >
                      <div className="truncate pr-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {check.activity_name}
                        </span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-500">{check.competency}</span>
                      </div>
                      <span className="font-bold text-[#246f54] shrink-0">{check.result}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 5. ASSESSMENT HISTORY */}
            <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                5. Assessment History
              </span>

              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                  <span className="text-[9.5px] uppercase font-bold text-slate-400">BOSY</span>
                  <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    {learner.readingLevel || "Pending"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50/50 p-2 border border-dashed border-slate-200 dark:bg-slate-800/40 dark:border-white/5">
                  <span className="text-[9.5px] uppercase font-bold text-slate-400">MOSY</span>
                  <p className="mt-0.5 text-slate-400 text-[10.5px]">Not available</p>
                </div>

                <div className="rounded-lg bg-slate-50/50 p-2 border border-dashed border-slate-200 dark:bg-slate-800/40 dark:border-white/5">
                  <span className="text-[9.5px] uppercase font-bold text-slate-400">EOSY</span>
                  <p className="mt-0.5 text-slate-400 text-[10.5px]">Not available</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 px-5 py-3 bg-slate-50/50 dark:border-white/5 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
