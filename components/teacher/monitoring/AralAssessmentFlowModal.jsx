"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Upload,
  ArrowRight,
  ChevronLeft,
  BookOpen,
  CalendarX2,
  FileSearch,
  ShieldAlert,
} from "lucide-react";
import { saveSinglePhilIriResult } from "@/lib/supabase/queries/monitoring";
import {
  evaluateGstScore,
  evaluateIraResult,
  calculateIraMetrics,
} from "@/lib/monitoring/philIriEvaluation";
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

  // Stages:
  // 'gst' | 'gst_absent_confirm' | 'gst_at_grade_level' | 'gst_validation' | 'gst_review_reason' | 'ira' | 'post_ira_review' | 'submitted_confirmation'
  const [stage, setStage] = useState("gst");

  // Step 1: GST Form State
  const [gstScore, setGstScore] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [gstFile, setGstFile] = useState(null);
  const [absentNote, setAbsentNote] = useState("");

  // Step 2: Teacher Validation & Review State
  const [teacherReviewReason, setTeacherReviewReason] = useState("");

  // Step 3: Form 3 (Individual Reading Assessment) State
  const [assessmentLevelUsed, setAssessmentLevelUsed] = useState("2 Grade Levels Below");
  const [totalWords, setTotalWords] = useState("");
  const [miscues, setMiscues] = useState("");
  const [readingMinutes, setReadingMinutes] = useState("");
  const [readingSeconds, setReadingSeconds] = useState("");
  const [wordReadingPct, setWordReadingPct] = useState("");
  const [comprehensionPct, setComprehensionPct] = useState("");
  const [comprehensionCorrect, setComprehensionCorrect] = useState("");
  const [comprehensionTotal, setComprehensionTotal] = useState("8");
  const [readingRate, setReadingRate] = useState("");
  const [iraFile, setIraFile] = useState(null);

  // Step 4: Post-IRA Support Review State
  const [readingNeed, setReadingNeed] = useState("Foundational Skills");

  const [saving, setSaving] = useState(false);

  // Total reading time in seconds
  const totalTimeSeconds =
    (Number(readingMinutes) || 0) * 60 + (Number(readingSeconds) || 0);

  // Auto-compute Form 3 metrics when counts/time change
  useEffect(() => {
    const numWords = Number(totalWords);
    const numMiscues = Number(miscues);

    if (Number.isFinite(numWords) && numWords > 0 && Number.isFinite(numMiscues) && numMiscues >= 0) {
      const computedPct = Math.max(0, Math.min(100, Math.round(((numWords - numMiscues) / numWords) * 100)));
      setWordReadingPct(String(computedPct));
    }

    if (Number.isFinite(numWords) && numWords > 0 && totalTimeSeconds > 0) {
      const computedWpm = Math.round((numWords / totalTimeSeconds) * 60);
      setReadingRate(String(computedWpm));
    }
  }, [totalWords, miscues, readingMinutes, readingSeconds, totalTimeSeconds]);

  // Auto-compute comprehension % from correct/total items
  useEffect(() => {
    const numCorrect = Number(comprehensionCorrect);
    const numTotal = Number(comprehensionTotal);
    if (Number.isFinite(numCorrect) && Number.isFinite(numTotal) && numTotal > 0) {
      const computedComp = Math.max(0, Math.min(100, Math.round((numCorrect / numTotal) * 100)));
      setComprehensionPct(String(computedComp));
    }
  }, [comprehensionCorrect, comprehensionTotal]);

  // Initialize or prefill state when learner opens
  useEffect(() => {
    if (!isOpen || !learner) return;

    setAbsentNote("");
    setTeacherReviewReason("");
    setTotalWords("");
    setMiscues("");
    setReadingMinutes("");
    setReadingSeconds("");
    setWordReadingPct("");
    setComprehensionPct("");
    setComprehensionCorrect("");
    setComprehensionTotal("8");
    setReadingRate("");

    const isAbsent = Boolean(
      learner.isAbsent ||
      learner.candidateStatus === "Absent / For Reschedule" ||
      learner.rawPayload?.isAbsent
    );

    if (isAbsent) {
      setGstScore("");
      setStage("gst");
      return;
    }

    if (learner.philIriScore != null) {
      const score = Number(learner.philIriScore);
      setGstScore(String(score));

      const hasReviewReason = Boolean(
        learner.candidateStatus === "For Review" &&
        (learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason)
      );

      if (hasReviewReason) {
        setTeacherReviewReason(learner.teacherReviewReason || learner.rawPayload?.teacherReviewReason || "");
        setStage("gst_validation");
        return;
      }

      if (score >= 28) {
        setStage("gst_at_grade_level");
      } else {
        const evalRes = evaluateGstScore({
          score,
          language: learner.language || learner.subject || "English",
        });
        setAssessmentLevelUsed(evalRes.recommendedStartingPassage || "2 Grade Levels Below");

        const hasIra = Boolean(
          learner.readingLevel &&
          learner.readingLevel !== "Not Screened" &&
          learner.readingLevel !== "Not Assessed" &&
          learner.readingLevel !== "Pending Oral Profile" &&
          learner.readingLevel !== "Not Set"
        );

        if (hasIra) {
          // If IRA already completed, allow viewing/editing IRA
          if (learner.iraMetrics) {
            if (learner.iraMetrics.totalWords) setTotalWords(String(learner.iraMetrics.totalWords));
            if (learner.iraMetrics.miscues) setMiscues(String(learner.iraMetrics.miscues));
            if (learner.iraMetrics.wordReadingPct) setWordReadingPct(String(learner.iraMetrics.wordReadingPct));
            if (learner.iraMetrics.comprehensionPct) setComprehensionPct(String(learner.iraMetrics.comprehensionPct));
            if (learner.iraMetrics.readingRate) setReadingRate(String(learner.iraMetrics.readingRate));
          }
          setStage("ira");
        } else {
          // Open at Teacher Validation
          setStage("gst_validation");
        }
      }
    } else {
      setGstScore("");
      setStage("gst");
    }

    if (learner.readingLevel === "Frustration") {
      setReadingNeed("Foundational Skills");
    } else if (learner.readingLevel === "Instructional") {
      setReadingNeed("Fluency & Comprehension");
    }
  }, [isOpen, learner]);

  if (!isOpen || !learner) return null;

  const language = learner.language || learner.subject || "English";
  const canEdit = Boolean(
    learner.canEditAssessment ??
      (learner.isAssessor && (!teacherId || learner.assessorTeacherId === teacherId))
  );

  const gstEval = evaluateGstScore({ score: gstScore, language });
  const iraMetricsComputed = calculateIraMetrics({
    assessmentLevelUsed,
    totalWords: totalWords ? Number(totalWords) : null,
    miscues: miscues ? Number(miscues) : null,
    readingTimeSeconds: totalTimeSeconds > 0 ? totalTimeSeconds : null,
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

  // 1. Submit GST Score
  const handleProceedGst = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      showToast(
        "error",
        `Only the assigned ${language} Subject Teacher may record or edit this reading assessment.`
      );
      return;
    }
    const numScore = Number(gstScore);
    if (!Number.isFinite(numScore) || numScore < 0 || numScore > 40) {
      showToast("error", "Score must be a number between 0 and 40.");
      return;
    }

    if (numScore >= 28) {
      // GST 28–40: At Grade Level — Mark Screening Complete, No IRA Required
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
          readingLevel: "Not Assessed", // Strictly no profile (Independent) assigned from GST alone
          screeningInterpretation: "No further individualized assessment from GST",
          candidateStatus: "Baseline Complete",
          documents: gstFile ? [gstFile] : [],
          assessmentPeriod: aralPeriod,
        });

        if (res.error) {
          showToast("error", res.error.message || "Failed to save assessment.");
          return;
        }

        showToast("success", "Screening Complete: At Grade Level");
        setStage("gst_at_grade_level");
        onSuccess?.();
      } catch (err) {
        console.error(err);
        showToast("error", "Failed to save screening result.");
      } finally {
        setSaving(false);
      }
    } else {
      // Score < 28: Proceed to Teacher Validation step
      setAssessmentLevelUsed(gstEval.recommendedStartingPassage || "2 Grade Levels Below");
      setStage("gst_validation");
    }
  };

  // 2. Mark Learner as Absent / For Reschedule
  const handleConfirmAbsent = async () => {
    if (!canEdit) {
      showToast(
        "error",
        `Only the assigned ${language} Subject Teacher may update assessment attendance.`
      );
      return;
    }
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
        isAbsent: true,
        gstScore: null,
        readingLevel: "Not Assessed",
        candidateStatus: "Absent / For Reschedule",
        candidateStatusOverride: "Absent / For Reschedule",
        screeningInterpretation: "No data",
        documents: [],
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to mark as absent.");
        return;
      }

      showToast("success", "Learner marked as Absent / For Reschedule.");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to mark learner as absent.");
    } finally {
      setSaving(false);
    }
  };

  // 3. Save Teacher Review of GST Result (Preserve raw score, no silent change, audit trail)
  const handleSaveTeacherReview = async (e) => {
    e.preventDefault();
    if (!teacherReviewReason.trim()) {
      showToast("error", "Please provide a reason for reviewing this result.");
      return;
    }
    setSaving(true);
    try {
      const studentId = learner.studentId || learner.id;
      const numScore = Number(gstScore) || 0;
      const res = await saveSinglePhilIriResult({
        studentId,
        classId: learner.classId || null,
        teacherId,
        schoolYear,
        quarter,
        subject: language,
        gstScore: numScore,
        individualAssessmentRequired: true,
        readingLevel: "Not Assessed", // No profile assigned
        screeningInterpretation: gstEval.recommendedStartingPassage || "2 Grade Levels Below",
        candidateStatus: "For Review",
        candidateStatusOverride: "For Review",
        teacherReviewReason: teacherReviewReason.trim(),
        documents: gstFile ? [gstFile] : [],
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to save review.");
        return;
      }

      showToast("success", "GST score preserved and flagged for teacher review.");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to save review.");
    } finally {
      setSaving(false);
    }
  };

  // 4. Continue from IRA Form 3 to Post-IRA Support Review
  const handleProceedToSupportReview = (e) => {
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

    setStage("post_ira_review");
  };

  // 5. Submit Form 3 Assessment Result
  const handleSubmitSupportReview = async () => {
    if (!canEdit) {
      showToast(
        "error",
        `Only the assigned ${language} Subject Teacher may submit this reading assessment.`
      );
      return;
    }
    setSaving(true);
    try {
      const studentId = learner.studentId || learner.id;
      const docs = [gstFile, iraFile].filter(Boolean);
      const isEosy =
        String(aralPeriod || "").toUpperCase().includes("EOSY") ||
        String(quarter) === "4";
      const isReadingNeed =
        iraMetricsComputed.readingProfile === "Frustration" ||
        iraMetricsComputed.readingProfile === "Instructional";

      const candidateStatus = isEosy && isReadingNeed
        ? "For Review"
        : "Baseline Complete";

      const res = await saveSinglePhilIriResult({
        studentId,
        classId: learner.classId || null,
        teacherId,
        schoolYear,
        quarter,
        subject: language,
        gstScore: Number(gstScore) || 0,
        individualAssessmentRequired: true,
        readingLevel: iraMetricsComputed.readingProfile,
        screeningInterpretation: assessmentLevelUsed,
        candidateStatus,
        candidateStatusOverride: candidateStatus,
        iraMetrics: {
          passageLevel: assessmentLevelUsed,
          totalWords: totalWords ? Number(totalWords) : null,
          miscues: miscues ? Number(miscues) : null,
          readingTimeSeconds: totalTimeSeconds > 0 ? totalTimeSeconds : null,
          wordReadingPct: Number(wordReadingPct),
          comprehensionPct: Number(comprehensionPct),
          readingRateWpm: readingRate ? Number(readingRate) : null,
          readingProfile: iraMetricsComputed.readingProfile,
        },
        documents: docs,
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to submit assessment.");
        return;
      }

      showToast(
        "success",
        isEosy && isReadingNeed
          ? "Assessment recorded: Flagged For Further Review"
          : "Individual Reading Assessment recorded successfully"
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
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-white/10 dark:bg-slate-900"
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
            LRN {learner.lrn || learner.studentNumber || "—"} · {learner.gradeSectionDisplay || `${learner.grade} - ${learner.section}`} · {language} Subject Teacher Assessor
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
          {!canEdit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>View-only mode:</strong> Only the assigned {language} Subject Teacher ({learner.assessorTeacherName || "Reading assessment teacher"}) has permission to record or edit this reading assessment.
              </span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* STAGE 1: GROUP SCREENING TEST (GST) ENTRY */}
            {stage === "gst" && (
              <motion.form
                key="gst-entry"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onSubmit={handleProceedGst}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Step 1 of 2 — Group Screening Test (GST)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Initial 40-item screening test for {language} · Phil-IRI {language === "Filipino" ? "Form 1A" : "Form 1B"}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setStage("gst_absent_confirm")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      <CalendarX2 size={13} className="text-slate-500" />
                      <span>Mark as Absent / Reschedule</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* GST Score Input */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>GST Score</span>
                      <span className="text-[10px] text-slate-400 font-normal">0–40 items</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={gstScore}
                      onChange={(e) => setGstScore(e.target.value)}
                      placeholder="Enter score (0–40)"
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

                {/* Live System Guidance */}
                {gstScore !== "" && (
                  <div
                    className={cn(
                      "rounded-xl p-3 text-xs border transition-all space-y-1",
                      Number(gstScore) >= 28
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        : "border-blue-200 bg-blue-50/70 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {Number(gstScore) >= 28 ? (
                        <>
                          <CheckCircle2 size={15} className="text-emerald-600" />
                          <span>At Grade Level — Screening Complete</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={15} className="text-blue-600" />
                          <span>Needs Further Reading Assessment</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300">
                      {Number(gstScore) >= 28 ? (
                        <>
                          Score: <strong>{gstScore} / 40</strong> meets the grade-level benchmark.
                          No individual reading assessment is required. (Reading profile is not assigned from GST alone).
                        </>
                      ) : (
                        <>
                          Score: <strong>{gstScore} / 40</strong> is below 28. Teacher validation is required before proceeding to reading assessment.
                          Recommended starting passage: <strong>{gstEval.recommendedStartingPassage}</strong>.
                        </>
                      )}
                    </p>
                  </div>
                )}

                {/* Optional Screening Sheet Upload */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Screening Record (Optional)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Attach Phil-IRI {language === "Filipino" ? "Form 1A" : "Form 1B"} sheet or class reading record
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

                {/* Actions */}
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
                    ) : Number(gstScore) >= 28 ? (
                      <>
                        <span>Record Screening Result</span>
                        <CheckCircle2 size={13} />
                      </>
                    ) : (
                      <>
                        <span>Continue to Teacher Validation</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 1B: ABSENT CONFIRMATION */}
            {stage === "gst_absent_confirm" && (
              <motion.div
                key="gst-absent"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-white/10 dark:bg-slate-800/40">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-slate-200 p-2.5 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      <CalendarX2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Mark as Absent / For Reschedule
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        The learner was absent during the Group Screening Test. This records their status as <strong>Absent / For Reschedule</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                    <p className="font-semibold">DepEd Phil-IRI Absence Safeguard:</p>
                    <p className="mt-0.5 text-[11px] text-blue-800/90 dark:text-blue-300/80">
                      Absence is NOT treated as a score of 0 or a failed assessment. The learner will remain scheduled for a screening test.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Optional Note / Reason
                    </label>
                    <input
                      type="text"
                      value={absentNote}
                      onChange={(e) => setAbsentNote(e.target.value)}
                      placeholder="e.g. Excused absence, medical, etc. (optional)"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStage("gst")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to Screening</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmAbsent}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CalendarX2 size={13} />
                        <span>Confirm Absent / Reschedule</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 2: TEACHER VALIDATION STEP (FOR GST < 28) */}
            {stage === "gst_validation" && (
              <motion.div
                key="gst-validation-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Step 1 Validation — GST Result & System Guidance
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Review screening result before continuing to Individual Reading Assessment
                  </p>
                </div>

                {/* GST Result Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 dark:border-white/10 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        GST Result
                      </span>
                      <p className="text-xl font-black text-slate-900 dark:text-white">
                        Score: {gstScore} / 40
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                      Further Reading Assessment Needed
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-white/5 dark:bg-slate-900/40 space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Recommended Starting Passage:
                    </p>
                    <p className="text-[12px] font-bold text-[#246f54] dark:text-[#38a169]">
                      {getPassageLevelDisplay(learner.grade, gstEval.recommendedStartingPassage)}
                    </p>
                    <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                      Official rule: Scores {Number(gstScore) >= 16 ? "16–27" : "0–15"} start passage assessment {Number(gstScore) >= 16 ? "2" : "3"} grade levels below.
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                    Reading profiles (Independent / Instructional / Frustration) are never assigned from GST alone and will be determined strictly from Form 3.
                  </p>
                </div>

                {/* Teacher Validation Choices */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-white/10 dark:bg-slate-800/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Teacher Validation Action
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Action 1: Continue to Reading Assessment */}
                    <button
                      type="button"
                      onClick={() => {
                        setAssessmentLevelUsed(gstEval.recommendedStartingPassage || "2 Grade Levels Below");
                        setStage("ira");
                      }}
                      className="rounded-xl border border-[#246f54]/30 bg-white p-3.5 text-left shadow-2xs hover:border-[#246f54] hover:bg-[#246f54]/5 transition cursor-pointer dark:bg-slate-800 dark:border-white/10"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-[#246f54] dark:text-[#38a169]">
                        <BookOpen size={16} />
                        <span>Continue to Reading Assessment</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Administer Phil-IRI Form 3 starting at {gstEval.recommendedStartingPassage}.
                      </p>
                    </button>

                    {/* Action 2: Review Result */}
                    <button
                      type="button"
                      onClick={() => setStage("gst_review_reason")}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-2xs hover:border-amber-400 hover:bg-amber-50/50 transition cursor-pointer dark:bg-slate-800 dark:border-white/10"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <FileSearch size={16} />
                        <span>Review Result</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Flag this score with a short teacher note and audit trail without changing raw data.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex justify-start pt-1">
                  <button
                    type="button"
                    onClick={() => setStage("gst")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to Edit GST Score</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 2B: TEACHER REVIEW REASON INPUT */}
            {stage === "gst_review_reason" && (
              <motion.form
                key="gst-review-form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                onSubmit={handleSaveTeacherReview}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert size={18} className="text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-950 dark:text-amber-200">
                        Teacher Review & Audit Trail
                      </h3>
                      <p className="text-[11px] text-amber-900/90 dark:text-amber-300/80">
                        Raw GST Score of <strong>{gstScore} / 40</strong> will be preserved. It will not be silently altered or given an artificial reading profile.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Reason for Review</span>
                      <span className="text-[10px] text-rose-500 font-semibold">* Required</span>
                    </label>
                    <textarea
                      rows={3}
                      value={teacherReviewReason}
                      onChange={(e) => setTeacherReviewReason(e.target.value)}
                      placeholder="e.g. Learner was unwell / distracted during test; oral reading in regular class indicates re-test is recommended."
                      required
                      autoFocus
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setStage("gst_validation")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to Validation</span>
                  </button>

                  <button
                    type="submit"
                    disabled={saving || !teacherReviewReason.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Preserve Score & Save Review</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 3A: GST AT GRADE LEVEL SUMMARY (FOR 28–40) */}
            {stage === "gst_at_grade_level" && (
              <motion.div
                key="gst-at-grade-level-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
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
                      Screening Complete
                    </h3>
                    <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-300/80 max-w-md mx-auto">
                      GST Score: <strong>{gstScore} / 40</strong> meets the Key Stage 3 benchmark for {language}.
                    </p>
                    <p className="mt-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      No further individual reading assessment is required.
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl bg-white/80 p-3 text-left text-xs border border-emerald-200/70 text-slate-700 dark:bg-slate-800/80 dark:border-emerald-900/40 dark:text-slate-300">
                    <p className="font-semibold text-slate-900 dark:text-white">DepEd Standards Compliance:</p>
                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                      Learner is marked screening complete. Reading profile (such as Independent) is strictly not created from GST alone.
                    </p>
                  </div>

                  <div className="mt-5 flex justify-center gap-2">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setStage("gst")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Pencil size={12} />
                        <span>Update Assessment / Re-score</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center rounded-xl bg-[#246f54] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition cursor-pointer"
                    >
                      Done / View Result
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STAGE 3B: FORM 3 INDIVIDUAL READING ASSESSMENT */}
            {stage === "ira" && (
              <motion.form
                key="ira-form"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                onSubmit={handleProceedToSupportReview}
                className="space-y-4"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-white/5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Step 2 of 2 — Individual Reading Assessment
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Graded passage oral assessment · Phil-IRI {language === "Filipino" ? "Form 3A · Filipino" : "Form 3B · English"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStage("gst_validation")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to Validation</span>
                  </button>
                </div>

                {/* Passage Level */}
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

                {/* Oral Reading Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total Words
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={totalWords}
                      onChange={(e) => setTotalWords(e.target.value)}
                      placeholder="e.g. 100"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Miscues / Errors
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={miscues}
                      onChange={(e) => setMiscues(e.target.value)}
                      placeholder="e.g. 5"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Reading Time
                    </label>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={readingMinutes}
                        onChange={(e) => setReadingMinutes(e.target.value)}
                        placeholder="Min"
                        className="h-9 w-1/2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="text-slate-400 text-xs">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={readingSeconds}
                        onChange={(e) => setReadingSeconds(e.target.value)}
                        placeholder="Sec"
                        className="h-9 w-1/2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Rate (WPM)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={readingRate}
                      onChange={(e) => setReadingRate(e.target.value)}
                      placeholder="e.g. 85"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Percentage Scores */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Word Reading %</span>
                      <span className="text-[10px] text-slate-400 font-normal">≥95 Ind | 90-94 Inst | &lt;90 Frust</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={wordReadingPct}
                      onChange={(e) => setWordReadingPct(e.target.value)}
                      placeholder="e.g. 92"
                      required
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Comprehension %</span>
                      <span className="text-[10px] text-slate-400 font-normal">≥80 Ind | 59-79 Inst | &lt;59 Frust</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={comprehensionPct}
                      onChange={(e) => setComprehensionPct(e.target.value)}
                      placeholder="e.g. 75"
                      required
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#246f54] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Derived Profile Live Preview */}
                {wordReadingPct !== "" && comprehensionPct !== "" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5 dark:border-white/10 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Derived Reading Profile (Form 3)
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border",
                          iraMetricsComputed.readingProfile === "Independent"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : iraMetricsComputed.readingProfile === "Instructional"
                            ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        )}
                      >
                        {iraMetricsComputed.readingProfile}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        at {getPassageLevelDisplay(learner.grade, assessmentLevelUsed)}
                      </span>
                      {readingRate && (
                        <span className="text-xs text-slate-400">· {readingRate} WPM</span>
                      )}
                    </div>
                  </div>
                )}

                {/* File Attachment */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Oral Reading Sheet (Optional)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Attach completed Phil-IRI {language === "Filipino" ? "Form 3A" : "Form 3B"} passage record
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

                {/* Action */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={wordReadingPct === "" || comprehensionPct === ""}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>Continue to Support Review</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 4: POST-IRA READING ASSESSMENT REVIEW & CONFIRMATION */}
            {stage === "post_ira_review" && (
              <motion.div
                key="post-ira-review-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Individual Reading Assessment (Form 3) Summary
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Verify oral reading metrics and save the official Phil-IRI assessment record
                  </p>
                </div>

                {/* Reading Result Summary Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 dark:border-white/10 dark:bg-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Form 3 Reading Profile
                      </span>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {getPassageLevelDisplay(learner.grade, assessmentLevelUsed)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border",
                        iraMetricsComputed.readingProfile === "Independent"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : iraMetricsComputed.readingProfile === "Instructional"
                          ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-red-200 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                      )}
                    >
                      {iraMetricsComputed.readingProfile}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Word Reading</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{wordReadingPct}%</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Comprehension</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{comprehensionPct}%</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100 dark:bg-slate-900/40 dark:border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Reading Rate</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {readingRate ? `${readingRate} WPM` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EOSY Reading Need Guidance Notice */}
                {(String(aralPeriod || "").toUpperCase().includes("EOSY") || String(quarter) === "4") &&
                  (iraMetricsComputed.readingProfile === "Frustration" || iraMetricsComputed.readingProfile === "Instructional") && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                        <span>End-of-School-Year Guidance: For Further Review</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed">
                        Reading need remains at end of school year. Status will be marked: <strong>For Further Review</strong> (Informational: Possible ARAL Summer Consideration). Actual summer session management is handled externally outside CNHS LEARN.
                      </p>
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setStage("ira")}
                    disabled={saving}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Back to Form 3 Entry</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSubmitSupportReview()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1b5842] transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving Assessment...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Assessment Result</span>
                        <CheckCircle2 size={13} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 5: SUBMISSION CONFIRMATION */}
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
                    Reading Assessment Recorded
                  </h3>
                  <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-300/80 max-w-md mx-auto">
                    The Form 3 Individual Reading Assessment has been successfully saved to the learner&apos;s reading record.
                  </p>

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
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
