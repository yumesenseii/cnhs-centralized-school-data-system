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

    if (gstEval.isIndependent) {
      // Independent -> Auto-save as Complete - No ARAL Support Needed
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
          readingLevel: "Independent",
          screeningInterpretation: "At Grade Level",
          candidateStatus: "Baseline Complete",
          documents: gstFile ? [gstFile] : [],
          assessmentPeriod: aralPeriod,
        });

        if (res.error) {
          showToast("error", res.error.message || "Failed to save assessment.");
          return;
        }

        setStage("gst_result");
        onSuccess?.();
      } catch (err) {
        console.error(err);
        showToast("error", "Failed to save screening result.");
      } finally {
        setSaving(false);
      }
    } else {
      // Score < 28 -> Proceed to IRA
      setAssessmentLevelUsed(gstEval.startingPassageLevel || "2 Grade Levels Below");
      setStage("ira");
    }
  };

  // Save Individual Reading Assessment
  const handleSaveIra = async (e) => {
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

    setSaving(true);
    try {
      const studentId = learner.studentId || learner.id;
      const docs = [gstFile, iraFile].filter(Boolean);

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
            : iraEval.readingProfile === "Frustration"
            ? "ARAL Candidate"
            : "For Review",
        documents: docs,
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to save assessment.");
        return;
      }

      setStage("decision");
      onSuccess?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to save reading assessment.");
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
                Record Reading Assessment
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Beginning Assessment (BOSY) · {language}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Group Screening Test (GST)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Phil-IRI 40-item screening test score for {language}.
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
                      gstEval.isIndependent
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                    )}
                  >
                    <p className="font-semibold">{gstEval.message}</p>
                    {!gstEval.isIndependent && (
                      <p className="mt-1 text-[11px] opacity-90">
                        Next: Individual Reading Assessment starting at <strong>{gstEval.startingPassageLevel}</strong>.
                      </p>
                    )}
                  </div>
                )}

                {/* Assessment File */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Official Assessment File
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Attach GST screening sheet or scanned record (optional)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : gstEval.isIndependent ? (
                      <>
                        <span>Save & Complete Assessment</span>
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

            {/* STAGE 2: INDIVIDUAL READING ASSESSMENT (IRA) */}
            {stage === "ira" && (
              <motion.form
                key="ira-form"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onSubmit={handleSaveIra}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Individual Reading Assessment (Form 3)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      GST Score: <strong>{gstScore}/40</strong> · Passage level: <strong>{assessmentLevelUsed}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStage("gst")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to GST</span>
                  </button>
                </div>

                {/* Assessment Level Used */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Assessment Level Used
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
                    placeholder="e.g. 75 wpm"
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
                        at {assessmentLevelUsed}
                      </span>
                    </div>
                  </div>
                )}

                {/* Form 3 File Upload */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Official Form 3 Record
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Attach completed oral reading record (optional)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
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
                    disabled={saving || wordReadingPct === "" || comprehensionPct === ""}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Assessment</span>
                        <CheckCircle2 size={13} />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 3: RESULT & SUPPORT DECISION */}
            {(stage === "gst_result" || stage === "decision") && (
              <motion.div
                key="result-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {/* Result Card */}
                {iraEval.readingProfile === "Independent" || gstEval.isIndependent ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <CheckCircle2 size={20} />
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      Assessment Complete — No ARAL Support Needed
                    </h3>
                    <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-300/80">
                      Learner demonstrates adequate reading proficiency in {language}.
                    </p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842]"
                      >
                        Complete Assessment
                      </button>
                    </div>
                  </div>
                ) : iraEval.readingProfile === "Instructional" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        Reading Profile: Instructional
                      </span>
                      <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                        Learner requires guided reading support.
                      </h3>
                      <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/80">
                        Assessment Level: <strong>{assessmentLevelUsed}</strong>. Teacher/facilitator review is required.
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3 border border-amber-200/60 text-xs text-slate-700 dark:bg-slate-800 dark:border-white/10 dark:text-slate-300">
                      <p className="font-semibold text-slate-900 dark:text-white">Next Step</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Review whether this learner can be accommodated in regular guided reading or referred for targeted assistance.
                      </p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842]"
                      >
                        Finish Review
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 space-y-3 dark:border-rose-900/60 dark:bg-rose-950/20">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                        Reading Profile: Frustration
                      </span>
                      <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                        Learner needs targeted reading support.
                      </h3>
                      <p className="mt-1 text-xs text-rose-800/90 dark:text-rose-300/80">
                        Assessment Level: <strong>{assessmentLevelUsed}</strong>.
                      </p>
                    </div>

                    {/* Identified Reading Need */}
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Identified Reading Need
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {["Foundational Skills", "Fluency / Comprehension"].map((need) => (
                          <button
                            key={need}
                            type="button"
                            onClick={() => setReadingNeed(need)}
                            className={cn(
                              "rounded-xl border p-2.5 text-left text-xs transition",
                              readingNeed === need
                                ? "border-[#246f54] bg-[#246f54]/10 font-bold text-[#246f54] dark:bg-[#246f54]/20"
                                : "border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                            )}
                          >
                            <p>{need}</p>
                            <span className="text-[10px] font-normal text-slate-400 block mt-0.5">
                              {need === "Foundational Skills"
                                ? "Phonics, word decoding, alphabet"
                                : "Reading rate, vocabulary, understanding"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842]"
                      >
                        Confirm Support Decision
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
