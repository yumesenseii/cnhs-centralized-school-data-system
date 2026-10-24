"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Save,
  Eye,
  ArrowRight,
  Bookmark,
  Loader2,
} from "lucide-react";
import { formatGradeSection } from "@/lib/monitoring/philIriEvaluation";
import { saveBatchClassGstScores } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import StatCard from "@/components/dashboard/StatCard";
import AralClassDropdown from "@/components/teacher/aral-program/AralClassDropdown";
import LearnerName from "@/components/shared/LearnerName";
import { normalizeAralPeriod } from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

// Helper to build initial row edits synchronously from learners or saved local draft
function buildInitialRowEdits(learners, classId, schoolYear, aralPeriod) {
  const initial = {};
  let savedDraft = null;
  try {
    const draftKey = `aral_gst_draft_${classId}_${schoolYear}_${aralPeriod}`;
    const raw = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
    if (raw) savedDraft = JSON.parse(raw);
  } catch {}

  for (const l of learners || []) {
    const isAbsentFromDb = Boolean(
      l.isAbsent ||
      l.candidateStatus === "Absent / For Reschedule" ||
      l.screeningStatus === "Absent / For Reschedule" ||
      l.rawPayload?.isAbsent
    );

    if (savedDraft && savedDraft[l.studentId]) {
      const draftRow = savedDraft[l.studentId];
      const isDraftAbsent = Boolean(draftRow.isAbsent);
      initial[l.studentId] = {
        score: isDraftAbsent ? "" : (draftRow.score ?? ""),
        isAbsent: isDraftAbsent,
        isDirty: false,
        isDraft: true,
      };
    } else {
      initial[l.studentId] = {
        score: isAbsentFromDb ? "" : (l.philIriScore != null ? String(l.philIriScore) : ""),
        isAbsent: isAbsentFromDb,
        isDirty: false,
        isDraft: false,
      };
    }
  }
  return initial;
}

export default function AralClassGstSpreadsheet({
  classInfo = {},
  classes = [],
  selectedClassId = null,
  onSelectClass,
  learners = [],
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  aralPeriod = "BOSY",
  onRefresh,
  onOpenIra,
  onOpenRecord,
  onSelectPeriod,
}) {
  const { showToast } = useAppToast();
  const [saving, setSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const canEncode = Boolean(teacherId && normalizeAralPeriod(aralPeriod));
  const hasScreeningRows = learners.some((learner) => !learner.readingWorkflow || learner.readingWorkflow.mode === "screening");
  const canEditScreening = (learner) => !learner.readingWorkflow || learner.readingWorkflow.mode === "screening";
  const [correctionReason, setCorrectionReason] = useState("");

  // Draft state initialized synchronously (prevents empty-render flicker)
  const [rowEdits, setRowEdits] = useState(() =>
    buildInitialRowEdits(learners, classInfo.classId, schoolYear, aralPeriod)
  );

  // Detect whether the teacher is modifying already saved database scores
  const hasSavedScoreModifications = useMemo(() => {
    return learners.some((l) => {
      const edit = rowEdits[l.studentId];
      if (!edit || !edit.isDirty) return false;
      const isAbsentDb = Boolean(
        l.isAbsent ||
        l.candidateStatus === "Absent / For Reschedule" ||
        l.screeningStatus === "Absent / For Reschedule" ||
        l.rawPayload?.isAbsent
      );
      const hasSavedScore = l.philIriScore != null && !isNaN(Number(l.philIriScore));
      const hasSavedRecord = hasSavedScore || isAbsentDb;
      if (!hasSavedRecord) return false;

      if (Boolean(edit.isAbsent) !== isAbsentDb) return true;
      if (hasSavedScore && edit.score !== "" && Number(edit.score) !== Number(l.philIriScore)) {
        return true;
      }
      return false;
    });
  }, [learners, rowEdits]);

  // Sync state if learners change after database save/refresh while preserving in-flight edits
  useEffect(() => {
    setRowEdits((prev) => {
      const next = { ...prev };
      for (const l of learners || []) {
        const isAbsentFromDb = Boolean(
          l.isAbsent ||
          l.candidateStatus === "Absent / For Reschedule" ||
          l.screeningStatus === "Absent / For Reschedule" ||
          l.rawPayload?.isAbsent
        );
        // Only update row if not currently dirty with teacher's unsaved keystrokes
        if (!next[l.studentId]?.isDirty && !next[l.studentId]?.isDraft) {
          next[l.studentId] = {
            score: isAbsentFromDb ? "" : (l.philIriScore != null ? String(l.philIriScore) : ""),
            isAbsent: isAbsentFromDb,
            isDirty: false,
            isDraft: false,
          };
        }
      }
      return next;
    });
  }, [learners]);

  // Preserve only local drafts across period/class switches; database writes remain explicit.
  useEffect(() => {
    if (Object.values(rowEdits).some((row) => row.isDirty || row.isDraft)) {
      try { localStorage.setItem(`aral_gst_draft_${classInfo.classId}_${schoolYear}_${aralPeriod}`, JSON.stringify(rowEdits)); } catch {}
    }
  }, [rowEdits, classInfo.classId, schoolYear, aralPeriod]);

  // Handle score change for a learner (automatically clears absent state)
  function handleScoreChange(studentId, val) {
    if (!canEncode || !canEditScreening(learners.find((l) => l.studentId === studentId) || {})) return;
    setRowEdits((prev) => {
      const current = prev[studentId] || {};
      return {
        ...prev,
        [studentId]: {
          ...current,
          score: val,
          isAbsent: false, // Entering a score automatically clears absent status
          isDirty: true,
          isDraft: false,
        },
      };
    });
  }

  // Handle absent toggle for a learner (clears score input and sets absent)
  function handleAbsentToggle(studentId, currentAbsent) {
    if (!canEncode || !canEditScreening(learners.find((l) => l.studentId === studentId) || {})) return;
    const nextAbsent = !currentAbsent;
    setRowEdits((prev) => {
      const current = prev[studentId] || {};
      return {
        ...prev,
        [studentId]: {
          ...current,
          isAbsent: nextAbsent,
          score: "", // If Absent is selected, clear any entered score
          isDirty: true,
          isDraft: false,
        },
      };
    });
  }

  // Handle keys: advance on Enter, block invalid minus/scientific characters
  function handleKeyDown(e, currentIndex) {
    if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const nextInput = document.querySelector(
        `input[data-row-idx="${currentIndex + 1}"]`
      );
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  }

  // Handle Paste: paste column of scores down consecutive rows
  function handlePaste(e, startIndex) {
    if (!canEncode) return;
    const clipboardText = e.clipboardData?.getData("text") || "";
    if (!clipboardText) return;

    const lines = clipboardText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) {
      return;
    }

    e.preventDefault();
    setRowEdits((prev) => {
      const next = { ...prev };
      lines.forEach((lineVal, idx) => {
        const targetLearner = learners[startIndex + idx];
        if (!targetLearner || !canEditScreening(targetLearner)) return;

        const isAbsentWord = /absent|excused/i.test(lineVal);
        if (isAbsentWord) {
          next[targetLearner.studentId] = {
            ...(next[targetLearner.studentId] || {}),
            score: "",
            isAbsent: true,
            isDirty: true,
          };
        } else {
          const num = Number(lineVal);
          if (Number.isFinite(num) && num >= 0 && num <= 40) {
            next[targetLearner.studentId] = {
              ...(next[targetLearner.studentId] || {}),
              score: String(num),
              isAbsent: false,
              isDirty: true,
            };
          }
        }
      });
      return next;
    });

    showToast(`Pasted ${lines.length} values starting at row ${startIndex + 1}.`);
  }

  // 1. Authoritative 4 compact counters based on officially saved records:
  const finalizedStats = useMemo(() => {
    let completedThisTerm = 0;
    let needsReadingAssessment = 0;
    let pendingOrReschedule = 0;

    for (const l of learners) {
      const workflow = l.readingWorkflow;
      // Completed earlier or completed this term with benchmark met / passed
      if (workflow?.mode === "complete") {
        completedThisTerm++;
        continue;
      }
      // Incomplete assessment carried over from an earlier period
      if (workflow?.mode === "incomplete_earlier") {
        if (workflow.incompleteEarlierReason === "needs_form3") {
          needsReadingAssessment++;
        } else {
          pendingOrReschedule++;
        }
        continue;
      }
      // Reassessment in MOSY or EOSY
      if (workflow?.mode === "reassessment") {
        if (workflow.hasIndividualResult) {
          completedThisTerm++;
        } else {
          needsReadingAssessment++;
        }
        continue;
      }
      // Regular screening row
      const isAbsent = Boolean(
        l.isAbsent ||
        l.candidateStatus === "Absent / For Reschedule" ||
        l.screeningStatus === "Absent / For Reschedule" ||
        l.rawPayload?.isAbsent
      );

      if (isAbsent) {
        pendingOrReschedule++;
      } else if (l.philIriScore != null && !Number.isNaN(Number(l.philIriScore))) {
        if (Number(l.philIriScore) < 28 && !l.iraMetrics && !workflow?.hasIndividualResult) {
          needsReadingAssessment++;
        } else {
          completedThisTerm++;
        }
      } else {
        pendingOrReschedule++;
      }
    }

    return {
      total: learners.length,
      completedThisTerm,
      needsReadingAssessment,
      pendingOrReschedule,
    };
  }, [learners]);

  // Overall class assessment progress percentage
  const progressPercent = useMemo(() => {
    if (!finalizedStats.total) return 0;
    const assessed = finalizedStats.completedThisTerm + finalizedStats.needsReadingAssessment;
    return Math.round((assessed / finalizedStats.total) * 100);
  }, [finalizedStats]);

  // 2. Dashboard-matched 4 KPI stat definitions (reusing standard StatCard with neutral default styling)
  const kpiStats = useMemo(
    () => [
      {
        id: "total-learners",
        label: "Total Learners",
        value: finalizedStats.total,
        subtext: "Enrolled in this class",
        variant: "default",
      },
      {
        id: "completed-term",
        label: "Assessment Complete",
        value: finalizedStats.completedThisTerm,
        subtext: "Complete or no further assessment needed",
        variant: "default",
      },
      {
        id: "needs-ira",
        label: "Needs Further Assessment",
        value: finalizedStats.needsReadingAssessment,
        subtext: "Individual assessment or reassessment",
        variant: "default",
      },
      {
        id: "pending-reschedule",
        label: "Pending / Reschedule",
        value: finalizedStats.pendingOrReschedule,
        subtext: "Awaiting assessment or absent",
        variant: "default",
      },
    ],
    [finalizedStats]
  );

  // 3. Draft/Live tallies used inside Review Results modal
  const draftSummary = useMemo(() => {
    let enteredCount = 0;
    let atGradeCount = 0;
    let needsIraCount = 0;
    let absentCount = 0;
    let pendingCount = 0;
    let dirtyCount = 0;

    for (const l of learners) {
      const edit = rowEdits[l.studentId];
      if (edit?.isDirty) dirtyCount++;

      if (edit?.isAbsent) {
        absentCount++;
      } else if (edit?.score !== "" && edit?.score != null && !Number.isNaN(Number(edit.score))) {
        enteredCount++;
        const num = Number(edit.score);
        if (num >= 28) {
          atGradeCount++;
        } else {
          needsIraCount++;
        }
      } else {
        pendingCount++;
      }
    }

    return {
      total: learners.length,
      enteredCount,
      atGradeCount,
      needsIraCount,
      absentCount,
      pendingCount,
      dirtyCount,
    };
  }, [learners, rowEdits]);

  // Action: Save Draft (saves locally to state / localStorage)
  function handleSaveDraft() {
    if (!canEncode) {
      showToast("Sign in as the assigned teacher and choose an assessment period.");
      return;
    }

    try {
      const draftKey = `aral_gst_draft_${classInfo.classId}_${schoolYear}_${aralPeriod}`;
      localStorage.setItem(draftKey, JSON.stringify(rowEdits));
      setRowEdits((prev) => {
        const next = {};
        for (const [id, val] of Object.entries(prev)) {
          next[id] = {
            ...val,
            isDraft: val.isDirty || val.isDraft,
            isDirty: false,
          };
        }
        return next;
      });
      showToast("Draft saved locally. Changes preserved for this session.");
    } catch {
      showToast("Draft preserved in memory.");
    }
  }

  // Action: Save All Results (commits validated records to database)
  async function handleSaveAllResults() {
    if (!canEncode) {
      showToast("Sign in as the assigned teacher and choose an assessment period.");
      return;
    }

    // Validate score ranges (0 to 40)
    const hasInvalidScores = learners.some((l) => {
      const edit = rowEdits[l.studentId];
      if (!edit || edit.isAbsent || edit.score === "" || edit.score == null) return false;
      const num = Number(edit.score);
      return isNaN(num) || num < 0 || num > 40;
    });

    if (hasInvalidScores) {
      showToast("Please correct invalid scores before saving (scores must be 0–40).");
      return;
    }

    setSaving(true);
    setIsReviewOpen(false);

    try {
      const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ""));
      const resolveClassId = (cid) => isUuid(cid) ? cid : (isUuid(classInfo.rawClassId) ? classInfo.rawClassId : (isUuid(classInfo.classId) ? classInfo.classId : null));

      // Preserve saved individual assessments when saving the remaining screening rows.
      const scoresPayload = learners.filter((learner) => {
        const edit = rowEdits[learner.studentId];
        return canEditScreening(learner) && (edit?.isDirty || edit?.isDraft);
      }).map((l) => {
        const edit = rowEdits[l.studentId] || {};
        const hasValidScore =
          !edit.isAbsent &&
          edit.score !== "" &&
          edit.score != null &&
          !isNaN(Number(edit.score)) &&
          Number(edit.score) >= 0 &&
          Number(edit.score) <= 40;

        return {
          studentId: l.studentId,
          classId: resolveClassId(l.classId),
          gstScore: hasValidScore ? Number(edit.score) : null,
          isAbsent: Boolean(edit.isAbsent),
          studentName: l.name || `${l.lastName}, ${l.firstName}`,
          lrn: l.lrn || l.studentNumber,
          subject: classInfo.subject || l.subject || "English",
        };
      });

      if (!scoresPayload.length) {
        showToast("No new screening results to save.");
        return;
      }

      const { data, error } = await saveBatchClassGstScores({
        classId: resolveClassId(classInfo.classId),
        teacherId,
        schoolYear,
        quarter,
        assessmentPeriod: aralPeriod || "BOSY",
        subject: classInfo.subject || "English",
        scores: scoresPayload,
        correctionReason: hasSavedScoreModifications ? correctionReason : "",
      });

      if (error) {
        throw error;
      }

      try {
        const draftKey = `aral_gst_draft_${classInfo.classId}_${schoolYear}_${aralPeriod}`;
        localStorage.removeItem(draftKey);
      } catch {}

      showToast(`Successfully saved GST results for ${data?.count || 0} learners.`);
      setRowEdits((previous) => Object.fromEntries(Object.entries(previous).map(([id, edit]) =>
        [id, { ...edit, isDirty: false, isDraft: false }]
      )));
      await onRefresh?.();
    } catch (err) {
      console.error("handleSaveAllResults error:", err?.message || err);
      showToast({ message: err?.message || "Failed to save class GST results. Please try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const gradeSectionLabel = formatGradeSection(classInfo.grade, classInfo.section);

  return (
    <div className="space-y-4">
      {/* 1. Class Selector & Batch Actions Row (Simple horizontal section with thin divider, no large rounded card) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="aral-class-select"
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0"
          >
            Class:
          </label>
          <AralClassDropdown
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClass={onSelectClass}
          />
        </div>

        {/* Batch Action Buttons: Save Draft (secondary), Review (secondary), Save All Results (primary CNHS green) */}
        {hasScreeningRows && <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={!canEncode}
            className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Bookmark size={13} className="text-slate-400" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReviewOpen(true)}
            className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            <Eye size={13} className="text-slate-400" />
            <span>Review Results</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAllResults}
            disabled={!canEncode || saving}
            className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg bg-[#246f54] px-3.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[#1b5842] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span>Save All Results</span>
          </button>
        </div>}
      </div>

      {/* 2. 4 Standard Dashboard-Matched Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {aralPeriod} Assessment Progress
          </span>
          <span className="font-mono text-slate-500 dark:text-slate-400">
            {finalizedStats.completedThisTerm + finalizedStats.needsReadingAssessment} of {finalizedStats.total} learners assessed ({progressPercent}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[#246f54] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {hasSavedScoreModifications && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <label className="block font-semibold text-amber-900 dark:text-amber-200 mb-1">
            Notes / Reason for update (optional)
          </label>
          <input
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
            maxLength={500}
            className="w-full rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-2xs focus:border-[#246f54] focus:outline-hidden dark:border-white/10 dark:bg-slate-900 dark:text-white"
            placeholder="Optional: explain why the saved score or attendance is being updated"
          />
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
            A changed screening score automatically logs an audit record with previous and new values. Later assessments and progress are kept.
          </p>
        </div>
      )}
      {/* 3. Fast Entry Instruction (Muted helper text, no blue banner) */}
      <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
        {hasScreeningRows
          ? "Record GST scores (0–40), then save before opening an individual reading assessment. Press Enter to move down, or paste a column from Excel."
          : "Open the reading reassessment for learners who need follow-up. Earlier screening scores are shown for reference."}
        {" "}Click a learner&apos;s name to view their complete reading history.
      </p>

      {/* 4. Main Spreadsheet Table (Visually dominant school record sheet style) */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-semibold uppercase tracking-wider text-[10px] text-slate-500 dark:border-white/5 dark:bg-slate-800/40">
              <tr>
                <th className="w-10 px-3 py-2 text-center whitespace-nowrap">#</th>
                <th className="px-3 py-2 whitespace-nowrap">Learner</th>
                <th className="w-36 px-3 py-2 whitespace-nowrap">{hasScreeningRows ? "GST Score / 40" : "Screening Reference"}</th>
                {hasScreeningRows && <th className="w-24 px-3 py-2 text-center whitespace-nowrap">Absent</th>}
                <th className="w-44 px-3 py-2 whitespace-nowrap">Result</th>
                <th className="w-28 px-3 py-2 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {learners.map((learner, idx) => {
                const workflow = learner.readingWorkflow;
                const screeningEditable = canEncode && canEditScreening(learner);
                const edit = rowEdits[learner.studentId] || {
                  score: "",
                  isAbsent: false,
                  isDirty: false,
                  isDraft: false,
                };

                const hasScore = edit.score !== "" && edit.score != null;
                const numScore = Number(edit.score);
                const isValidScore =
                  hasScore && !isNaN(numScore) && numScore >= 0 && numScore <= 40;
                const isOutOfRange =
                  hasScore && (isNaN(numScore) || numScore < 0 || numScore > 40);

                // 1. Result: Neutral dark text by default
                // - At Grade Level → dark neutral text
                // - Needs Assessment → dark neutral text
                // - For Reschedule → amber
                // - Not Recorded → muted gray
                let resultText = "Not Recorded";
                let resultClass = "text-slate-400 dark:text-slate-500";

                if (workflow?.mode === "incomplete_earlier") {
                  if (workflow.incompleteEarlierReason === "needs_form3") {
                    resultText = `${workflow.incompleteEarlierPeriod} Form 3 Needed`;
                    resultClass = "font-medium text-amber-700 dark:text-amber-400";
                  } else if (workflow.incompleteEarlierReason === "absent") {
                    resultText = `Absent in ${workflow.incompleteEarlierPeriod} (Reschedule)`;
                    resultClass = "font-medium text-amber-700 dark:text-amber-400";
                  } else {
                    resultText = `${workflow.incompleteEarlierPeriod} Not Tested`;
                    resultClass = "font-medium text-slate-500 dark:text-slate-400";
                  }
                } else if (workflow?.mode === "complete") {
                  if (learner.readingLevel && learner.readingLevel !== "Not Assessed") {
                    resultText = `Reading Assessment Complete (${learner.readingLevel})`;
                  } else {
                    resultText = "Screening Complete — At Grade Level";
                  }
                  resultClass = "font-medium text-slate-800 dark:text-slate-200";
                } else if (workflow?.mode === "reassessment") {
                  if (workflow.hasIndividualResult) {
                    if (aralPeriod === "EOSY" && (learner.readingLevel === "Frustration" || learner.readingLevel === "Instructional")) {
                      resultText = "ARAL Eligible — For Review";
                      resultClass = "font-medium text-sky-800 dark:text-sky-300";
                    } else if (learner.readingLevel === "Independent") {
                      resultText = "Reading Assessment Complete (Independent)";
                      resultClass = "font-medium text-emerald-800 dark:text-emerald-300";
                    } else {
                      resultText = `Form 3 Complete — ${learner.readingLevel || "Assessed"}`;
                      resultClass = "font-medium text-slate-800 dark:text-slate-200";
                    }
                  } else {
                    resultText = "Reassessment Needed";
                    resultClass = "font-medium text-slate-800 dark:text-slate-200";
                  }
                } else if (edit.isAbsent) {
                  resultText = "Absent / For Reschedule";
                  resultClass = "font-medium text-amber-700 dark:text-amber-400";
                } else if (isValidScore) {
                  if (numScore >= 28) {
                    resultText = "Screening Complete — At Grade Level";
                    resultClass = "font-medium text-slate-800 dark:text-slate-200";
                  } else {
                    resultText = "Needs Form 3 Assessment";
                    resultClass = "font-medium text-slate-800 dark:text-slate-200";
                  }
                }

                // 2. Status indicator
                const isSavedInDb =
                  !edit.isDirty &&
                  (learner.philIriScore != null ||
                    learner.isAbsent ||
                    learner.candidateStatus === "Absent / For Reschedule" ||
                    learner.screeningStatus === "Absent / For Reschedule" ||
                    learner.rawPayload?.isAbsent);

                let statusBadge = null;
                if (edit.isDirty) {
                  statusBadge = (
                    <span className="ml-1.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                      · Unsaved
                    </span>
                  );
                } else if (edit.isDraft) {
                  statusBadge = (
                    <span className="ml-1.5 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                      · Draft
                    </span>
                  );
                } else if (isSavedInDb) {
                  statusBadge = (
                    <span className="ml-1.5 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                      · Saved
                    </span>
                  );
                }

                // 3. Action
                let actionElement = (
                  <span className="text-slate-300 text-xs">—</span>
                );

                if (!isOutOfRange) {
                  if (workflow?.mode === "incomplete_earlier") {
                    if (workflow.incompleteEarlierReason === "needs_form3") {
                      actionElement = (
                        <button
                          type="button"
                          onClick={() => onOpenIra?.(workflow.incompleteEarlierLearner || learner, workflow.incompleteEarlierPeriod)}
                          disabled={!canEncode}
                          className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50/80 px-2 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 whitespace-nowrap"
                        >
                          <span>Complete {workflow.incompleteEarlierPeriod} Form 3</span>
                          <ArrowRight size={11} className="text-amber-600 dark:text-amber-400" />
                        </button>
                      );
                    } else {
                      actionElement = (
                        <button
                          type="button"
                          onClick={() => onSelectPeriod?.(workflow.incompleteEarlierPeriod)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#246f54] hover:underline transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>Go to {workflow.incompleteEarlierPeriod}</span>
                          <ArrowRight size={11} />
                        </button>
                      );
                    }
                  } else if (workflow?.mode === "complete" || (isValidScore && numScore >= 28)) {
                    actionElement = (
                      <button
                        type="button"
                        onClick={() => onOpenRecord?.(learner)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-2 transition-colors cursor-pointer dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap"
                      >
                        View Record
                      </button>
                    );
                  } else if (workflow?.mode === "reassessment" || workflow?.requiresIndividual || (isValidScore && numScore < 28)) {
                    actionElement = (
                      <button
                        type="button"
                        onClick={() => onOpenIra?.(learner, aralPeriod)}
                        disabled={!canEncode || edit.isDirty || edit.isDraft}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shadow-2xs dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{edit.isDirty || edit.isDraft ? "Save score first" : workflow?.hasIndividualResult ? "Review Assessment" : hasScreeningRows ? "Individual Assessment" : "Reassess Reading"}</span>
                        <ArrowRight size={11} className="text-slate-400" />
                      </button>
                    );
                  }
                }

                return (
                  <tr
                    key={learner.studentId}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Index */}
                    <td className="px-3 py-1.5 text-center font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {idx + 1}
                    </td>

                    {/* Learner Name + LRN underneath */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div>
                        <button
                          type="button"
                          onClick={() => onOpenRecord?.(learner)}
                          className="font-medium text-slate-900 hover:text-[#246f54] hover:underline text-left cursor-pointer dark:text-white transition-colors truncate block max-w-[220px] sm:max-w-none text-xs"
                          title="Click to view complete reading assessment history"
                        >
                          <LearnerName
                            firstName={learner.firstName}
                            lastName={learner.lastName}
                            name={learner.name}
                          />
                        </button>
                        <div className="font-mono text-[10.5px] text-slate-400 dark:text-slate-500">
                          {learner.lrn || learner.studentNumber ? (
                            `LRN: ${learner.lrn || learner.studentNumber}`
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                    </td>

                    {/* GST Score / 40 Input */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {workflow && workflow.mode !== "screening" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {workflow.screening?.philIriScore != null
                              ? `${workflow.screening.philIriScore} / 40`
                              : workflow.incompleteEarlierReason === "absent"
                              ? "Absent"
                              : "—"}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {workflow.screening?.screeningPeriod || workflow.incompleteEarlierPeriod || aralPeriod}
                          </span>
                        </div>
                      ) : <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          data-row-idx={idx}
                          aria-label={`GST score for ${learner.name || learner.studentNumber}`}
                          min={0}
                          max={40}
                          value={edit.score}
                          disabled={!screeningEditable || edit.isAbsent}
                          placeholder={edit.isAbsent ? "—" : "—"}
                          onChange={(e) =>
                            handleScoreChange(learner.studentId, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(e, idx)}
                          onPaste={(e) => handlePaste(e, idx)}
                          className={cn(
                            "h-7 w-14 rounded border px-2 text-center font-mono text-xs font-semibold tabular-nums text-slate-800 shadow-2xs transition focus:outline-hidden dark:text-white",
                            !canEncode
                              ? "border-slate-200 bg-slate-100 text-slate-400 opacity-70 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/60"
                              : edit.isAbsent
                              ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/60"
                              : isOutOfRange
                              ? "border-red-400 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-200 dark:border-red-500 dark:bg-red-950/20 dark:text-red-300"
                              : edit.isDirty
                              ? "border-amber-400 bg-amber-50/20 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 dark:border-amber-500 dark:bg-amber-950/20"
                              : "border-slate-200 bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-white/10 dark:bg-slate-800"
                          )}
                        />
                        <span className="font-mono text-[10px] text-slate-400">
                          / 40
                        </span>

                        {isOutOfRange && (
                          <span className="text-[10px] font-medium text-red-600 dark:text-red-400 whitespace-nowrap ml-1">
                            0–40 only
                          </span>
                        )}
                      </div>}
                    </td>

                    {/* Dedicated Absent Checkbox Column */}
                    {hasScreeningRows && <td className="px-3 py-1.5 text-center whitespace-nowrap">
                      {screeningEditable ? (
                        <label className={cn("inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 select-none", canEncode ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
                          <input
                            type="checkbox"
                            checked={edit.isAbsent}
                            disabled={!screeningEditable}
                            onChange={() =>
                              handleAbsentToggle(learner.studentId, edit.isAbsent)
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#246f54] focus:ring-[#246f54] cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className="text-[11px]">Absent</span>
                        </label>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>}

                    {/* Result (with subtle saved/unsaved status) */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className={cn("text-xs", resultClass)}>
                        {resultText}
                      </span>
                      {statusBadge}
                    </td>

                    {/* Action (Continue button or View Record text link) */}
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {actionElement}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Review Results Dialog */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Review Class GST Results
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {gradeSectionLabel} · {classInfo.language || "English"} ({learners.length} learners)
            </p>

            <div className="mt-4 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-white/5 dark:bg-slate-800/40">
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">Total Enrolled:</span>
                <span className="font-bold text-slate-900 dark:text-white">{draftSummary.total}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-700 dark:text-slate-300">At Grade Level (28–40):</span>
                <span className="font-bold text-slate-900 dark:text-white">{draftSummary.atGradeCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-700 dark:text-slate-300">Needs Further Assessment (0–27):</span>
                <span className="font-bold text-slate-900 dark:text-white">{draftSummary.needsIraCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-amber-700 dark:text-amber-400">For Reschedule:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{draftSummary.absentCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">Not Recorded:</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">{draftSummary.pendingCount}</span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              Saving will commit scores for {draftSummary.enteredCount} learners and record {draftSummary.absentCount} absences with null scores.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="inline-flex h-8.5 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
              >
                Back to Editing
              </button>
              <button
                type="button"
                onClick={handleSaveAllResults}
                disabled={saving || !canEncode}
                className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg bg-[#246f54] px-4 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] transition disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Confirm & Save All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
