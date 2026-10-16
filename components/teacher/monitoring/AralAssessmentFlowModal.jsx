"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Upload,
  ArrowRight,
  ChevronLeft,
  BookOpen,
} from "lucide-react";
import { saveSinglePhilIriResult } from "@/lib/supabase/queries/monitoring";
import { evaluateGstScore, evaluateIraResult } from "@/lib/monitoring/philIriEvaluation";
import { useAppToast } from "@/components/shared/AppToast";
import AppSelect from "@/components/shared/AppSelect";
import { cn } from "@/lib/utils";

/**
 * Returns user-friendly passage grade string (e.g. "Grade 5 (2 Levels Below)")
 */
function getPassageLevelDisplay(rawGrade, levelStr) {
  const match = String(rawGrade || "").match(/\d+/);
  const num = match ? parseInt(match[0], 10) : 7;
  const s = String(levelStr || "").toLowerCase();
  if (s.includes("at grade")) return `Grade ${num} (At Grade Level)`;
  if (s.includes("1")) return `Grade ${Math.max(1, num - 1)} (1 Level Below)`;
  if (s.includes("2")) return `Grade ${Math.max(1, num - 2)} (2 Levels Below)`;
  if (s.includes("3")) return `Grade ${Math.max(1, num - 3)} (3 Levels Below)`;
  return levelStr || `Grade ${Math.max(1, num - 2)}`;
}

export default function AralAssessmentFlowModal({
  isOpen,
  onClose,
  learner = null,
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  aralPeriod = "BOSY",
  onSuccess,
}) {
  const { showToast } = useAppToast();
  const fileInputRef = useRef(null);

  // Stage: 'gst' | 'gst_result' | 'ira' | 'decision'
  const [stage, setStage] = useState("gst");

  // Step 1: GST form state
  const [gstScore, setGstScore] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [gstFile, setGstFile] = useState(null);

  // Step 2: IRA form state
  const [assessmentLevelUsed, setAssessmentLevelUsed] = useState("2 Grade Levels Below");
  const [wordReadingPct, setWordReadingPct] = useState("");
  const [comprehensionPct, setComprehensionPct] = useState("");
  const [readingRate, setReadingRate] = useState("");
  const [iraFile, setIraFile] = useState(null);

  // Step 3: Frustration Reading Need
  const [readingNeed, setReadingNeed] = useState("Fluency / Comprehension");

  const [saving, setSaving] = useState(false);

  // Initialize or prefill state when learner opens
  useEffect(() => {
    if (!isOpen || !learner) return;

    if (learner.philIriScore != null) {
      setGstScore(String(learner.philIriScore));
      const evalRes = evaluateGstScore({
        score: learner.philIriScore,
        language: learner.language || learner.subject || "English",
      });

      if (evalRes.isIndependent) {
        setStage("gst_result");
      } else {
        setAssessmentLevelUsed(evalRes.startingPassageLevel || "2 Grade Levels Below");
        setStage("ira");
      }
    } else {
      setGstScore("");
      setStage("gst");
    }

    if (learner.readingLevel && learner.readingLevel !== "Not Screened") {
      // If reading level already exists, allow viewing/editing IRA
      if (learner.readingLevel === "Frustration") {
        setReadingNeed("Foundational Skills");
      }
    }
  }, [isOpen, learner]);

  if (!isOpen || !learner) return null;

  const language = learner.language || learner.subject || "English";
  const gstEval = evaluateGstScore({ score: gstScore, language });
  const iraEval = evaluateIraResult({
    assessmentLevelUsed,
    wordReadingPct,
    comprehensionPct,
    readingRate,
  });

  const handleFileUpload = (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileMeta = {
      name: file.name,
      size: `${(file.size / 1024).toFixed(0)} KB`,
      type: target === "gst" ? "Group Screening Record" : "Individual Assessment Record",
    };

    if (target === "gst") {
      setGstFile(fileMeta);
    } else {
      setIraFile(fileMeta);
    }
    showToast("success", `Attached: ${file.name}`);
    e.target.value = "";
  };

  // Save GST Screening Result
  const handleSaveGst = async (e) => {
    e.preventDefault();
    const numScore = Number(gstScore);
    if (!Number.isFinite(numScore) || numScore < 0 || numScore > 40) {
      showToast("error", "Score must be a number between 0 and 40.");
      return;
    }

    if (!gstEval.needsIndividualAssessment) {
      // GST 28–40: At Grade Level — No Individual Assessment Needed
      setSaving(true);
      try {
        const studentId = learner.studentId || learner.id;
        const res = await saveSinglePhilIriResult({
          studentId,
          classId: learner.classId || null,
          teacherId,
          schoolYear,
          quarter,
          subject: language,
          gstScore: numScore,
          individualAssessmentRequired: false,
          readingLevel: "Not Assessed", // No Form 3 administered
          screeningInterpretation: "No further individualized assessment from GST",
          candidateStatus: "Baseline Complete",
          documents: gstFile ? [gstFile] : [],
          assessmentPeriod: aralPeriod,
        });

        if (res.error) {
          showToast("error", res.error.message || "Failed to save assessment.");
          return;
        }

        showToast("success", "Assessment Result Submitted: At Grade Level");
        setStage("gst_result");
        onSuccess?.();
      } catch (err) {
        console.error(err);
        showToast("error", "Failed to save screening result.");
      } finally {
        setSaving(false);
      }
    } else {
      // Score < 28 -> Proceed to Form 3 Graded Passage
      setAssessmentLevelUsed(gstEval.startingPassageLevel || "2 Grade Levels Below");
      setStage("ira");
    }
  };

  // Move from Form 3 to Support Recommendation
  const handleProceedToRecommendation = (e) => {
    e.preventDefault();
    const wPct = Number(wordReadingPct);
    const cPct = Number(comprehensionPct);

    if (!Number.isFinite(wPct) || wPct < 0 || wPct > 100) {
      showToast("error", "Word Reading score must be between 0% and 100%.");
      return;
    }
    if (!Number.isFinite(cPct) || cPct < 0 || cPct > 100) {
      showToast("error", "Comprehension score must be between 0% and 100%.");
      return;
    }

    setStage("decision");
  };

  // Submit Form 3 Assessment Result & Support Recommendation for Authorized Review
  const handleSubmitSupportRecommendation = async (recommendationChoice) => {
    setSaving(true);
    try {
      const studentId = learner.studentId || learner.id;
      const docs = [gstFile, iraFile].filter(Boolean);
      const isRecommendingAral = recommendationChoice === "aral";

      const res = await saveSinglePhilIriResult({
        studentId,
        classId: learner.classId || null,
        teacherId,
        schoolYear,
        quarter,
        subject: language,
        gstScore: Number(gstScore) || 0,
        individualAssessmentRequired: true,
        readingLevel: iraEval.readingProfile,
        screeningInterpretation: assessmentLevelUsed,
        candidateStatus:
          iraEval.readingProfile === "Independent"
            ? "Baseline Complete"
            : isRecommendingAral
            ? "ARAL Candidate"
            : "For Review",
        documents: docs,
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to submit recommendation.");
        return;
      }

      showToast(
        "success",
        isRecommendingAral
          ? "Assessment submitted: Recommended for ARAL Support (Pending Authorized Review)"
          : "Assessment submitted: No ARAL Support Needed"
      );
      setStage("submitted_confirmation");
      onSuccess?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to submit assessment result.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#246f54]/10 p-2 text-[#246f54]">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Reading Assessment
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {learner.name} · {learner.gradeSectionDisplay || `${learner.grade} - ${learner.section}`} · {language}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Learner Context Banner */}
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 dark:border-white/5 dark:bg-white/[0.02]">
          <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            {learner.name}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            LRN {learner.lrn || learner.studentNumber || "—"} · {learner.gradeSectionDisplay || `${learner.grade} - ${learner.section}`} · {language}
          </p>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.pdf,.docx,.doc,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(e, stage === "ira" ? "ira" : "gst")}
          className="hidden"
        />

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <AnimatePresence mode="wait">
            {/* STEP 1: GROUP SCREENING TEST */}
            {stage === "gst" && (
              <motion.form
                key="gst-form"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onSubmit={handleSaveGst}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Step 1 of 2 — Screening Test
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Initial 40-item screening test score for {language} · Phil-IRI {language === "Filipino" ? "Form 1A" : "Form 1B"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Score */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Score</span>
                      <span className="text-[10px] text-slate-400 font-normal">0–40</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={gstScore}
                      onChange={(e) => setGstScore(e.target.value)}
                      placeholder="Enter score"
                      required
                      autoFocus
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Assessment Date */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Assessment Date
                    </label>
                    <input
                      type="date"
                      value={assessmentDate}
                      onChange={(e) => setAssessmentDate(e.target.value)}
                      required
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Live Interpretation Message */}
                {gstScore !== "" && (
                  <div
                    className={cn(
                      "rounded-xl p-3 text-xs border transition-all",
                      !gstEval.needsIndividualAssessment
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                    )}
                  >
                    {!gstEval.needsIndividualAssessment ? (
                      <>
                        <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                          Learner is At Grade Level. No further reading assessment is needed.
                        </p>
                        <p className="mt-1 text-[11px] text-emerald-800/90 dark:text-emerald-300/80">
                          Score: {gstScore}/40 meets the grade-level benchmark. Submit this result for review to record that no ARAL reading support is required.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-blue-900 dark:text-blue-200">
                          This learner needs a more detailed reading assessment.
                        </p>
                        <p className="mt-1 text-[11px] text-blue-800/90 dark:text-blue-300/80">
                          Next step: Continue with the reading passage assessment, starting {getPassageLevelDisplay(learner.grade, gstEval.startingPassageLevel || "2 Grade Levels Below")}.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Assessment File */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Screening Record (Optional)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Attach Phil-IRI {language === "Filipino" ? "Form 1A" : "Form 1B"} sheet or score sheet (optional)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      <Upload size={12} />
                      <span>{gstFile ? "Change File" : "Attach File"}</span>
                    </button>
                  </div>
                  {gstFile && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-white p-2 text-xs border border-slate-100 dark:border-white/5 dark:bg-slate-800">
                      <FileText size={14} className="text-[#246f54] shrink-0" />
                      <span className="font-medium text-slate-800 truncate dark:text-slate-200">
                        {gstFile.name}
                      </span>
                      <span className="text-[10px] text-slate-400">({gstFile.size})</span>
                    </div>
                  )}
                </div>

                {/* Form Action */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving || gstScore === ""}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : !gstEval.needsIndividualAssessment ? (
                      <>
                        <span>Submit Assessment Result</span>
                        <CheckCircle2 size={13} />
                      </>
                    ) : (
                      <>
                        <span>Continue Assessment</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 2: INDIVIDUAL READING ASSESSMENT (FORM 3) */}
            {stage === "ira" && (
              <motion.form
                key="ira-form"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onSubmit={handleProceedToRecommendation}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Step 2 of 2 — Individual Reading Assessment
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Graded passage assessment · Phil-IRI {language === "Filipino" ? "Form 3A · Filipino" : "Form 3B · English"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStage("gst")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to Screening</span>
                  </button>
                </div>

                {/* Assessment Level Used */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Passage Level ({getPassageLevelDisplay(learner.grade, assessmentLevelUsed)})
                  </label>
                  <AppSelect
                    value={assessmentLevelUsed}
                    onChange={setAssessmentLevelUsed}
                    options={[
                      "At Grade Level",
                      "1 Grade Level Below",
                      "2 Grade Levels Below",
                      "3 Grade Levels Below",
                    ]}
                    className="mt-1 w-full"
                    triggerClassName="h-9 rounded-xl border-slate-200 text-xs font-semibold dark:border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Word Reading Result */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Word Reading</span>
                      <span className="text-[10px] text-slate-400 font-normal">%</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={wordReadingPct}
                      onChange={(e) => setWordReadingPct(e.target.value)}
                      placeholder="e.g. 92"
                      required
                      autoFocus
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Comprehension Result */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Comprehension</span>
                      <span className="text-[10px] text-slate-400 font-normal">%</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={comprehensionPct}
                      onChange={(e) => setComprehensionPct(e.target.value)}
                      placeholder="e.g. 65"
                      required
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Reading Rate (Optional) */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>Reading Rate (Optional)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Words Per Minute</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={readingRate}
                    onChange={(e) => setReadingRate(e.target.value)}
                    placeholder="e.g. 75 wpm (optional)"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Derived Profile Live Preview */}
                {wordReadingPct !== "" && comprehensionPct !== "" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Derived Reading Profile
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border",
                          iraEval.readingProfile === "Independent"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : iraEval.readingProfile === "Instructional"
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        )}
                      >
                        {iraEval.readingProfile}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        at {getPassageLevelDisplay(learner.grade, assessmentLevelUsed)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {iraEval.readingProfile === "Independent"
                        ? "The learner can read and comprehend this passage on their own."
                        : iraEval.readingProfile === "Instructional"
                        ? "The learner can read this passage with teacher guidance."
                        : "The learner is still experiencing difficulty at this passage level."}
                    </p>
                  </div>
                )}

                {/* Reading Assessment File Upload */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Reading Assessment Record (Optional)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Attach completed oral reading record · Phil-IRI {language === "Filipino" ? "Form 3A" : "Form 3B"} (optional)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      <Upload size={12} />
                      <span>{iraFile ? "Change File" : "Attach File"}</span>
                    </button>
                  </div>
                  {iraFile && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-white p-2 text-xs border border-slate-100 dark:border-white/5 dark:bg-slate-800">
                      <FileText size={14} className="text-[#246f54] shrink-0" />
                      <span className="font-medium text-slate-800 truncate dark:text-slate-200">
                        {iraFile.name}
                      </span>
                      <span className="text-[10px] text-slate-400">({iraFile.size})</span>
                    </div>
                  )}
                </div>

                {/* Form Action */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={wordReadingPct === "" || comprehensionPct === ""}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 3A: SCREENING RESULT SUMMARY (FOR GST 28–40 — STRICTLY NOT FORM 4) */}
            {stage === "gst_result" && (
              <motion.div
                key="gst-result-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="mt-3">
                    <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      At Grade Level
                    </span>
                    <h3 className="mt-1.5 text-base font-bold text-emerald-950 dark:text-emerald-200">
                      Screening Result Summary
                    </h3>
                    <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-300/80 max-w-md mx-auto">
                      Screening Score: <strong>{gstScore}/40</strong>. The learner meets the grade-level benchmark in {language}.
                      No individual reading assessment is needed.
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/80 p-3 text-left text-xs border border-emerald-200/70 text-slate-700 dark:bg-slate-800/80 dark:border-emerald-900/40 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white">Next Step</p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      Assessment Complete · Awaiting Authorized Review (No Further Support Needed).
                    </p>
                  </div>

                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center rounded-xl bg-[#246f54] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STAGE 3B: SUPPORT RECOMMENDATION (AFTER FORM 3 — FORM 4 SUMMARY) */}
            {stage === "decision" && (
              <motion.div
                key="decision-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Reading Assessment Result
                      </h3>
                      <span className="text-[10px] text-slate-400">
                        Phil-IRI Form 4 — Individual Summary Record
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border",
                        iraEval.readingProfile === "Independent"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : iraEval.readingProfile === "Instructional"
                          ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                      )}
                    >
                      Profile: {iraEval.readingProfile}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Word Reading</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{wordReadingPct}%</span>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Comprehension</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{comprehensionPct}%</span>
                    </div>
                    <div className="rounded-lg bg-white p-2 border border-slate-100 dark:bg-slate-800 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Passage Level</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {getPassageLevelDisplay(learner.grade, assessmentLevelUsed)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teacher Recommendation Form */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs dark:border-white/10 dark:bg-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Teacher Recommendation
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Choose what support you recommend based on the assessment result.
                    </p>
                  </div>

                  {iraEval.readingProfile === "Independent" ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <p className="font-semibold">Learner is Independent at this passage level.</p>
                      <p className="mt-0.5 text-[11px] text-emerald-800/90 dark:text-emerald-300/80">
                        Recommendation: No ARAL reading support needed. This recommendation will be submitted for Authorized Review.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          Focus Area for Support
                        </label>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                          {["Foundational Skills", "Fluency & Comprehension"].map((need) => (
                            <button
                              key={need}
                              type="button"
                              onClick={() => setReadingNeed(need)}
                              className={cn(
                                "rounded-xl border p-2.5 text-left text-xs transition cursor-pointer",
                                readingNeed === need
                                  ? "border-[#246f54] bg-[#246f54]/10 font-bold text-[#246f54] dark:bg-[#246f54]/20"
                                  : "border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                              )}
                            >
                              <p>{need}</p>
                              <span className="text-[10px] font-normal text-slate-400 block mt-0.5">
                                {need === "Foundational Skills"
                                  ? "Phonics, word decoding, sound recognition"
                                  : "Reading rate, vocabulary, passage understanding"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer helper notice */}
                  <p className="text-[11px] text-slate-400 italic">
                    Your recommendation will be sent for review before support begins.
                  </p>

                  {/* Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setStage("ira")}
                      disabled={saving}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                    >
                      <ChevronLeft size={13} />
                      <span>Back to Assessment</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {iraEval.readingProfile !== "Independent" && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSubmitSupportRecommendation("no_support")}
                          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer disabled:opacity-50"
                        >
                          No Reading Support Needed
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          handleSubmitSupportRecommendation(
                            iraEval.readingProfile === "Independent" ? "no_support" : "aral"
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition cursor-pointer disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Submitting...</span>
                          </>
                        ) : iraEval.readingProfile === "Independent" ? (
                          <>
                            <span>Submit Assessment Result</span>
                            <CheckCircle2 size={13} />
                          </>
                        ) : (
                          <>
                            <span>Recommend Reading Support</span>
                            <CheckCircle2 size={13} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STAGE 4: SUBMITTED CONFIRMATION */}
            {stage === "submitted_confirmation" && (
              <motion.div
                key="submitted-confirmation-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 size={22} />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-emerald-950 dark:text-emerald-200">
                    Assessment & Recommendation Submitted
                  </h3>
                  <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-300/80 max-w-md mx-auto">
                    The reading assessment results have been recorded. Support recommendation has been forwarded for Authorized Review (School Principal / Reading Coordinator).
                  </p>

                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center rounded-xl bg-[#246f54] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
