"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Loader2, Save } from "lucide-react";
import { saveSinglePhilIriResult } from "@/lib/supabase/queries/monitoring";
import {
  calculateIraMetrics,
  formatGradeSection,
} from "@/lib/monitoring/philIriEvaluation";
import { useAppToast } from "@/components/shared/AppToast";
import { normalizeAralPeriod } from "@/lib/monitoring/assessmentTimeline";
import LearnerName from "@/components/shared/LearnerName";
import { cn } from "@/lib/utils";
import { getAralReadingWorkflow } from "@/lib/monitoring/aralReadingWorkflow";

/**
 * Standard Phil-IRI Form 3 graded passage word counts.
 */
const DEFAULT_PASSAGE_WORDS = {
  "Grade 1": 50,
  "Grade 2": 70,
  "Grade 3": 95,
  "Grade 4": 110,
  "Grade 5": 125,
  "Grade 6": 140,
  "Grade 7": 155,
  "Grade 8": 165,
  "Grade 9": 175,
  "Grade 10": 185,
  "Grade 11": 195,
  "Grade 12": 200,
};

/**
 * Returns options for passage levels relative to learner's grade level.
 */
function getPassageLevelOptions(grade) {
  const match = String(grade || "").match(/\d+/);
  const currentGrade = match ? parseInt(match[0], 10) : 7;
  const options = [];

  if (currentGrade - 3 >= 1) {
    options.push({
      value: `Grade ${currentGrade - 3}`,
      label: `Grade ${currentGrade - 3} (3 Levels Below)`,
    });
  }
  if (currentGrade - 2 >= 1) {
    options.push({
      value: `Grade ${currentGrade - 2}`,
      label: `Grade ${currentGrade - 2} (2 Levels Below)`,
    });
  }
  if (currentGrade - 1 >= 1) {
    options.push({
      value: `Grade ${currentGrade - 1}`,
      label: `Grade ${currentGrade - 1} (1 Level Below)`,
    });
  }
  options.push({
    value: `Grade ${currentGrade}`,
    label: `Grade ${currentGrade} (At Grade Level)`,
  });

  return options;
}

export default function AralAssessmentFlowModal({
  isOpen,
  onClose,
  learner: sourceLearner = null,
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  aralPeriod = "BOSY",
  onSuccess,
}) {
  const { showToast } = useAppToast();
  const [saving, setSaving] = useState(false);
  const workflow = useMemo(() => getAralReadingWorkflow(sourceLearner || {}, aralPeriod, schoolYear), [sourceLearner, aralPeriod, schoolYear]);
  const learner = sourceLearner ? workflow.assessmentLearner : null;

  const canEncode = Boolean(teacherId && normalizeAralPeriod(aralPeriod));
  const [correctionReason, setCorrectionReason] = useState("");

  // Essential raw assessment inputs
  const [passageLevel, setPassageLevel] = useState("");
  const [totalWords, setTotalWords] = useState("");
  const [miscues, setMiscues] = useState("");
  const [readingMinutes, setReadingMinutes] = useState("");
  const [readingSeconds, setReadingSeconds] = useState("");
  const [comprehensionCorrect, setComprehensionCorrect] = useState("");
  const [comprehensionTotal, setComprehensionTotal] = useState("8");

  // Teacher-confirmed term progression outcome
  const [progressionOutcome, setProgressionOutcome] = useState("");

  // Passage level options based on student grade
  const passageOptions = useMemo(() => {
    return getPassageLevelOptions(learner?.grade || "Grade 7");
  }, [learner?.grade]);

  // Determine continuation label for current period
  const continuationLabel =
    aralPeriod === "EOSY"
      ? "For Further Review after EOSY"
      : "Continue to Next Assessment Period";

  // Initialize or prefill state when learner opens
  useEffect(() => {
    if (!isOpen || !learner) return;
    setCorrectionReason("");

    const existingMetrics =
      learner.iraMetrics || learner.rawPayload?.iraMetrics || null;

    const match = String(learner.grade || "").match(/\d+/);
    const gradeNum = match ? parseInt(match[0], 10) : 7;
    const gstScore =
      learner.philIriScore != null ? Number(learner.philIriScore) : null;

    // Default recommended starting level based on GST score
    let defaultPassage = `Grade ${Math.max(1, gradeNum - 2)}`;
    if (gstScore !== null && gstScore < 16 && gradeNum - 3 >= 1) {
      defaultPassage = `Grade ${gradeNum - 3}`;
    }

    if (existingMetrics) {
      const lvl = existingMetrics.passageLevel || defaultPassage;
      setPassageLevel(lvl);
      setTotalWords(
        existingMetrics.totalWords != null
          ? String(existingMetrics.totalWords)
          : String(DEFAULT_PASSAGE_WORDS[lvl] || 155)
      );
      setMiscues(
        existingMetrics.miscues != null ? String(existingMetrics.miscues) : ""
      );
      if (existingMetrics.readingMinutes != null) {
        setReadingMinutes(String(existingMetrics.readingMinutes));
      } else if (existingMetrics.readingTimeSeconds != null) {
        setReadingMinutes(
          String(Math.floor(existingMetrics.readingTimeSeconds / 60))
        );
      } else {
        setReadingMinutes("");
      }
      if (existingMetrics.readingSeconds != null) {
        setReadingSeconds(String(existingMetrics.readingSeconds));
      } else if (existingMetrics.readingTimeSeconds != null) {
        setReadingSeconds(String(existingMetrics.readingTimeSeconds % 60));
      } else {
        setReadingSeconds("");
      }
      setComprehensionCorrect(
        existingMetrics.comprehensionCorrect != null
          ? String(existingMetrics.comprehensionCorrect)
          : ""
      );
      setComprehensionTotal(
        existingMetrics.comprehensionTotal != null
          ? String(existingMetrics.comprehensionTotal)
          : "8"
      );

      // Restore existing teacher confirmed outcome if present
      if (existingMetrics.progressionOutcome) {
        setProgressionOutcome(existingMetrics.progressionOutcome);
      } else {
        setProgressionOutcome(continuationLabel);
      }
    } else {
      setPassageLevel(defaultPassage);
      setTotalWords(String(DEFAULT_PASSAGE_WORDS[defaultPassage] || 155));
      setMiscues("");
      setReadingMinutes("");
      setReadingSeconds("");
      setComprehensionCorrect("");
      setComprehensionTotal("8");
      setProgressionOutcome(continuationLabel);
    }
  }, [isOpen, learner, continuationLabel]);

  // Total reading time in seconds
  const totalTimeSeconds = useMemo(() => {
    const mins = Number(readingMinutes);
    const secs = Number(readingSeconds);
    const validMins = Number.isFinite(mins) && mins >= 0 ? mins : 0;
    const validSecs = Number.isFinite(secs) && secs >= 0 ? secs : 0;
    return validMins * 60 + validSecs;
  }, [readingMinutes, readingSeconds]);

  // Derived auto-computed metrics (calculated silently in background)
  const computedMetrics = useMemo(() => {
    const numWords = Number(totalWords);
    const numMiscues = Number(miscues);
    const numCorrect = Number(comprehensionCorrect);
    const numTotal = Number(comprehensionTotal);

    return calculateIraMetrics({
      assessmentLevelUsed: passageLevel,
      totalWords:
        totalWords !== "" && Number.isFinite(numWords) && numWords > 0
          ? numWords
          : null,
      miscues:
        miscues !== "" && Number.isFinite(numMiscues) && numMiscues >= 0
          ? numMiscues
          : null,
      readingTimeSeconds: totalTimeSeconds > 0 ? totalTimeSeconds : null,
      comprehensionCorrect:
        comprehensionCorrect !== "" &&
        Number.isFinite(numCorrect) &&
        numCorrect >= 0
          ? numCorrect
          : null,
      comprehensionTotal:
        comprehensionTotal !== "" && Number.isFinite(numTotal) && numTotal > 0
          ? numTotal
          : null,
    });
  }, [
    passageLevel,
    totalWords,
    miscues,
    totalTimeSeconds,
    comprehensionCorrect,
    comprehensionTotal,
  ]);

  // Automatically update recommended outcome based on Reading Profile
  useEffect(() => {
    if (computedMetrics.readingProfile) {
      if (computedMetrics.readingProfile === "Independent") {
        setProgressionOutcome("No Further Assessment Required");
      } else {
        setProgressionOutcome(continuationLabel);
      }
    }
  }, [computedMetrics.readingProfile, continuationLabel]);

  // Submit handler
  async function handleSave() {
    if (!learner?.studentId) return;

    if (!canEncode) {
      showToast("Sign in as the assigned teacher and choose an assessment period.");
      return;
    }

    if (!workflow.requiresIndividual) {
      showToast(workflow.message);
      return;
    }

    const numWords = Number(totalWords);
    const numMiscues = Number(miscues);
    const numCorrect = Number(comprehensionCorrect);
    const numTotal = Number(comprehensionTotal);

    if (!totalWords || isNaN(numWords) || numWords <= 0) {
      showToast("Please enter a valid total word count.");
      return;
    }
    if (miscues === "" || isNaN(numMiscues) || numMiscues < 0) {
      showToast("Please enter a valid number of miscues (0 or higher).");
      return;
    }
    if (numMiscues > numWords) {
      showToast("Miscues cannot exceed the total word count.");
      return;
    }
    if (totalTimeSeconds <= 0) {
      showToast("Please enter reading time (minutes and seconds).");
      return;
    }
    if (comprehensionCorrect === "" || isNaN(numCorrect) || numCorrect < 0) {
      showToast("Please enter the number of correct comprehension answers.");
      return;
    }
    if (!comprehensionTotal || isNaN(numTotal) || numTotal <= 0) {
      showToast("Please enter the total number of comprehension items.");
      return;
    }
    if (numCorrect > numTotal) {
      showToast("Correct answers cannot exceed the total number of items.");
      return;
    }
    if (!progressionOutcome) {
      showToast("Please select a term progression outcome.");
      return;
    }
    if (!computedMetrics.readingProfile) {
      showToast("Please verify complete word reading and comprehension metrics.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await saveSinglePhilIriResult({
        studentId: learner.studentId,
        classId: learner.classId,
        teacherId,
        schoolYear,
        quarter,
        assessmentPeriod: aralPeriod || "BOSY",
        correctionReason,
        subject: learner.subject || "English",
        gstScore: learner.philIriScore,
        documents: learner.rawPayload?.documents || [],
        readingLevel: computedMetrics.readingProfile || "Not Assessed",
        individualAssessmentRequired: true,
        iraMetrics: {
          screeningPeriod: learner.screeningPeriod,
          assessmentKind: aralPeriod === "BOSY" ? "individual" : "reassessment",
          passageLevel,
          totalWords: numWords,
          miscues: numMiscues,
          readingMinutes: Number(readingMinutes) || 0,
          readingSeconds: Number(readingSeconds) || 0,
          readingTimeSeconds: totalTimeSeconds,
          comprehensionCorrect: numCorrect,
          comprehensionTotal: numTotal,
          wordReadingPct: computedMetrics.wordReadingPct,
          wordReadingLevel: computedMetrics.wordReadingLevel,
          readingRate: computedMetrics.readingRate,
          comprehensionPct: computedMetrics.comprehensionPct,
          comprehensionLevel: computedMetrics.comprehensionLevel,
          readingProfile: computedMetrics.readingProfile,
          progressionOutcome,
          evaluatedAt: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      showToast("Individual Reading Assessment saved successfully.");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to save IRA result:", err);
      showToast({ message: err.message || "Failed to save assessment result.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !learner) return null;

  const gstScore =
    learner.philIriScore != null ? Number(learner.philIriScore) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-label={aralPeriod === "BOSY" ? "Individual Reading Assessment" : "Reading Reassessment"}
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-white/10">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {aralPeriod === "BOSY" ? "Individual Reading Assessment" : "Reading Reassessment"}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Form {learner.language === "Filipino" ? "3A" : "3B"} · {aralPeriod} · {schoolYear}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {!workflow.requiresIndividual && (
          <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">{workflow.message}</p>
        )}

        {/* Compact Learner Bar: Learner name, Grade & Section, GST Score only */}
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-xs dark:border-white/5 dark:bg-slate-800/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-slate-900 dark:text-white">
              <LearnerName
                firstName={learner.firstName}
                lastName={learner.lastName}
                name={learner.name}
              />
              <span className="text-slate-500 dark:text-slate-400 font-normal ml-2">
                ({formatGradeSection(learner.grade, learner.section)})
              </span>
            </div>
            <div className="text-slate-600 dark:text-slate-300 text-[11.5px]">
              GST Score {learner.screeningPeriod ? `(${learner.screeningPeriod})` : ""}:{" "}
              <strong className="font-mono text-slate-900 dark:text-white">
                {gstScore != null ? `${gstScore} / 40` : "—"}
              </strong>
            </div>
          </div>
        </div>

        {/* Form Body: Raw Inputs Only */}
        <fieldset disabled={!canEncode || !workflow.requiresIndividual || saving} className="p-5 space-y-3.5 max-h-[calc(85vh-130px)] overflow-y-auto">
          {/* 1. Passage Level & Auto-filled Total Words */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Passage Level
              </label>
              <select
                aria-label="Passage Level"
                value={passageLevel}
                onChange={(e) => {
                  const newLvl = e.target.value;
                  setPassageLevel(newLvl);
                  if (DEFAULT_PASSAGE_WORDS[newLvl]) {
                    setTotalWords(String(DEFAULT_PASSAGE_WORDS[newLvl]));
                  }
                }}
                className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
              >
                {passageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Total Words
              </label>
              <input
                type="number"
                min={1}
                placeholder="155"
                value={totalWords}
                aria-label="Total Words"
                onChange={(e) => setTotalWords(e.target.value)}
                className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800 shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* 2. Miscues / Errors & Reading Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Miscues / Errors
              </label>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={miscues}
                aria-label="Miscues / Errors"
                onChange={(e) => setMiscues(e.target.value)}
                className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800 shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reading Time
              </label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={readingMinutes}
                    aria-label="Reading minutes"
                    onChange={(e) => setReadingMinutes(e.target.value)}
                    className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-800 text-center shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">min</span>
                </div>
                <span className="text-slate-400 font-bold text-xs">:</span>
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    placeholder="00"
                    value={readingSeconds}
                    aria-label="Reading seconds"
                    onChange={(e) => setReadingSeconds(e.target.value)}
                    className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2 font-mono text-xs text-slate-800 text-center shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">sec</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Comprehension Score */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Comprehension Score
            </label>
            <div className="flex items-center gap-2 max-w-xs">
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={comprehensionCorrect}
                  aria-label="Comprehension correct"
                  onChange={(e) => setComprehensionCorrect(e.target.value)}
                  className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800 text-center shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">correct</span>
              </div>
              <span className="text-slate-400 font-mono text-xs">/</span>
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  placeholder="8"
                  value={comprehensionTotal}
                  aria-label="Comprehension total"
                  onChange={(e) => setComprehensionTotal(e.target.value)}
                  className="w-full h-8.5 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800 text-center shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-800 dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">total</span>
              </div>
            </div>
          </div>

          {/* 4. Single Simple Summary Area: Reading Profile & Outcome */}
          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">
                Reading Profile:
              </span>
              <span
                className={cn(
                  "font-semibold text-xs",
                  computedMetrics.readingProfile === "Independent"
                    ? "text-slate-900 dark:text-white"
                    : computedMetrics.readingProfile === "Instructional"
                    ? "text-slate-900 dark:text-white"
                    : computedMetrics.readingProfile === "Frustration"
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-400"
                )}
              >
                {computedMetrics.readingProfile || "—"}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Assessment Outcome
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer select-none transition-colors",
                    progressionOutcome === "No Further Assessment Required"
                      ? "border-slate-800 bg-slate-50 font-medium text-slate-900 dark:border-white/40 dark:bg-slate-800 dark:text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                  )}
                >
                  <input
                    type="radio"
                    name="progressionOutcome"
                    value="No Further Assessment Required"
                    checked={
                      progressionOutcome === "No Further Assessment Required"
                    }
                    onChange={(e) => setProgressionOutcome(e.target.value)}
                    className="h-3.5 w-3.5 text-slate-900 focus:ring-slate-800 cursor-pointer"
                  />
                  <span>No Further Assessment Required</span>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2.5 text-xs cursor-pointer select-none transition-colors",
                    progressionOutcome === continuationLabel
                      ? "border-slate-800 bg-slate-50 font-medium text-slate-900 dark:border-white/40 dark:bg-slate-800 dark:text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                  )}
                >
                  <input
                    type="radio"
                    name="progressionOutcome"
                    value={continuationLabel}
                    checked={progressionOutcome === continuationLabel}
                    onChange={(e) => setProgressionOutcome(e.target.value)}
                    className="h-3.5 w-3.5 text-slate-900 focus:ring-slate-800 cursor-pointer"
                  />
                  <span>{continuationLabel}</span>
                </label>
              </div>
            </div>
          </div>
        </fieldset>

        {workflow.hasIndividualResult && <label className="block px-5 pb-3 text-xs text-slate-600 dark:text-slate-300">
          Reason for correction
          <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} maxLength={500}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm" placeholder="Explain any changes to the saved result" />
        </label>}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canEncode || !workflow.requiresIndividual || saving}
            className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg bg-[#246f54] px-4 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#1b5842] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span>Save Assessment Result</span>
          </button>
        </div>
      </div>
    </div>
  );
}
