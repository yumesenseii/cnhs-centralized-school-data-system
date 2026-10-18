"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  ArrowRight,
  Bookmark,
  CalendarX2,
  Loader2,
  Info,
} from "lucide-react";
import { evaluateGstScore, formatGradeSection } from "@/lib/monitoring/philIriEvaluation";
import { saveBatchClassGstScores } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import StatCard from "@/components/dashboard/StatCard";
import LearnerName from "@/components/shared/LearnerName";
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
  learners = [],
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  aralPeriod = "BOSY",
  onRefresh,
  onOpenIra,
  onOpenRecord,
}) {
  const { showToast } = useAppToast();
  const [saving, setSaving] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Draft state initialized synchronously (prevents empty-render flicker)
  const [rowEdits, setRowEdits] = useState(() =>
    buildInitialRowEdits(learners, classInfo.classId, schoolYear, aralPeriod)
  );

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
        if (!next[l.studentId]?.isDirty) {
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

  // Handle score change for a learner (automatically clears absent state)
  function handleScoreChange(studentId, val) {
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
    const clipboardText = e.clipboardData?.getData("text") || "";
    if (!clipboardText) return;

    // Check if paste contains line breaks (column paste)
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
        if (!targetLearner) return;

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
  // - Total Learners
  // - Completed This Term (only officially saved records, not unsaved browser drafts)
  // - Needs Reading Assessment (saved score < 28)
  // - Pending / For Reschedule (unassessed + absent)
  const finalizedStats = useMemo(() => {
    let completedThisTerm = 0;
    let needsReadingAssessment = 0;
    let pendingOrReschedule = 0;

    for (const l of learners) {
      const isAbsent = Boolean(
        l.isAbsent ||
        l.candidateStatus === "Absent / For Reschedule" ||
        l.screeningStatus === "Absent / For Reschedule" ||
        l.rawPayload?.isAbsent
      );

      if (isAbsent) {
        pendingOrReschedule++;
      } else if (l.philIriScore != null && !Number.isNaN(Number(l.philIriScore))) {
        completedThisTerm++;
        if (Number(l.philIriScore) < 28) {
          needsReadingAssessment++;
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

  // 2. Dashboard-matched 4 KPI stat definitions (reusing Teacher Dashboard StatCard style)
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
        label: "Completed This Term",
        value: finalizedStats.completedThisTerm,
        subtext: "Assessment completed",
        variant: "default",
      },
      {
        id: "needs-ira",
        label: "Needs Reading Assessment",
        value: finalizedStats.needsReadingAssessment,
        subtext: "Requires individual assessment",
        variant: finalizedStats.needsReadingAssessment > 0 ? "warning" : "default",
      },
      {
        id: "pending-reschedule",
        label: "Pending / For Reschedule",
        value: finalizedStats.pendingOrReschedule,
        subtext: "Not yet completed",
        variant: "default",
      },
    ],
    [finalizedStats]
  );

  // 2. Draft/Live tallies used inside the Review Results summary modal:
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
      const scoresPayload = learners.map((l) => {
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
          classId: l.classId || classInfo.classId,
          gstScore: hasValidScore ? Number(edit.score) : null,
          isAbsent: Boolean(edit.isAbsent),
          studentName: l.name || `${l.lastName}, ${l.firstName}`,
          lrn: l.lrn || l.studentNumber,
          subject: classInfo.subject || l.subject || "English",
        };
      });

      const { data, error } = await saveBatchClassGstScores({
        classId: classInfo.classId,
        teacherId,
        schoolYear,
        quarter,
        assessmentPeriod: aralPeriod || "BOSY",
        subject: classInfo.subject || "English",
        scores: scoresPayload,
      });

      if (error) {
        throw error;
      }

      try {
        const draftKey = `aral_gst_draft_${classInfo.classId}_${schoolYear}_${aralPeriod}`;
        localStorage.removeItem(draftKey);
      } catch {}

      showToast(`Successfully saved GST results for ${data?.count || 0} learners.`);
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Failed to save class GST results. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const gradeSectionLabel = formatGradeSection(classInfo.grade, classInfo.section);

  return (
    <div className="space-y-4">
      {/* 1. Header Bar: Class Info & Batch Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300">
              {classInfo.language || "English"}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {gradeSectionLabel}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            GST Screening · {schoolYear} · {aralPeriod} · {learners.length} Enrolled Learners
          </p>
        </div>

        {/* Batch Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            <Bookmark size={13} className="text-slate-400" />
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReviewOpen(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            <Eye size={13} className="text-slate-400" />
            <span>Review Results</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAllResults}
            disabled={saving}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#246f54] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1e5d46] disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span>Save All Results</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Dashboard-Matched Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiStats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      {/* 3. Fast Entry Instruction */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2 text-[11px] text-slate-600 dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-300">
        <Info size={14} className="shrink-0 text-slate-400" />
        <span>
          <strong>Fast Entry:</strong> Type score (0–40) and press <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px] shadow-2xs dark:border-white/10 dark:bg-slate-800">Enter</kbd> to move down. You can also paste a vertical column from Excel or Sheets. Click a learner's name to view their complete reading history.
        </span>
      </div>

      {/* 4. Main Spreadsheet Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 font-semibold uppercase tracking-wider text-[10px] text-slate-500 dark:border-white/5 dark:bg-slate-800/40">
              <tr>
                <th className="w-10 px-3 py-2.5 text-center whitespace-nowrap">#</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Learner</th>
                <th className="w-28 px-4 py-2.5 whitespace-nowrap">LRN</th>
                <th className="w-48 px-4 py-2.5 whitespace-nowrap">GST Score / 40</th>
                <th className="w-36 px-4 py-2.5 whitespace-nowrap">Result</th>
                <th className="w-24 px-4 py-2.5 whitespace-nowrap">Status</th>
                <th className="w-32 px-4 py-2.5 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {learners.map((learner, idx) => {
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

                // 1. Result = Reading interpretation only
                // Allowed values: "At Grade Level", "Needs Assessment", "Not Recorded", "For Reschedule"
                let resultText = "Not Recorded";
                let resultBadgeClass = null;

                if (edit.isAbsent) {
                  resultText = "For Reschedule";
                  resultBadgeClass = "border-slate-200 bg-slate-100 text-slate-700";
                } else if (isValidScore) {
                  if (numScore >= 28) {
                    resultText = "At Grade Level";
                    resultBadgeClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
                  } else {
                    resultText = "Needs Assessment";
                    resultBadgeClass = "border-amber-200 bg-amber-50 text-amber-800";
                  }
                }

                // 2. Status = Save state only
                // Allowed values: "Saved", "Unsaved", "Draft", "Pending"
                let statusText = "Pending";
                let statusBadgeClass = null;

                const isSavedInDb =
                  !edit.isDirty &&
                  (learner.philIriScore != null ||
                    learner.isAbsent ||
                    learner.candidateStatus === "Absent / For Reschedule" ||
                    learner.screeningStatus === "Absent / For Reschedule" ||
                    learner.rawPayload?.isAbsent);

                if (edit.isDirty) {
                  statusText = "Unsaved";
                  statusBadgeClass = "border-amber-200 bg-amber-50 text-amber-800";
                } else if (edit.isDraft) {
                  statusText = "Draft";
                  statusBadgeClass = "border-slate-200 bg-slate-100 text-slate-700";
                } else if (isSavedInDb) {
                  statusText = "Saved";
                  statusBadgeClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
                }

                // 3. Action = Next step only
                // Blank score: no action (dash)
                // Score 28–40 or Absent: "View Record"
                // Score 0–27: "Continue"
                let actionElement = (
                  <span className="text-slate-300 text-xs">—</span>
                );

                if (!isOutOfRange) {
                  if (edit.isAbsent || (isValidScore && numScore >= 28)) {
                    actionElement = (
                      <button
                        type="button"
                        onClick={() => onOpenRecord?.(learner)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <Eye size={12} className="text-slate-400" />
                        <span>View Record</span>
                      </button>
                    );
                  } else if (isValidScore && numScore < 28) {
                    actionElement = (
                      <button
                        type="button"
                        onClick={() => onOpenIra?.(learner)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer whitespace-nowrap shrink-0 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span>Continue</span>
                        <ArrowRight size={12} className="text-slate-400" />
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
                    <td className="px-3 py-2 text-center font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {idx + 1}
                    </td>

                    {/* Learner Name (Clickable to open reading record modal) */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenRecord?.(learner)}
                        className="font-semibold text-slate-900 hover:text-[#246f54] hover:underline text-left cursor-pointer dark:text-white transition-colors truncate block max-w-[220px] sm:max-w-none"
                        title="Click to view complete reading assessment history"
                      >
                        <LearnerName
                          firstName={learner.firstName}
                          lastName={learner.lastName}
                          name={learner.name}
                        />
                      </button>
                    </td>

                    {/* LRN */}
                    <td className="px-4 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {learner.lrn || learner.studentNumber || "—"}
                    </td>

                    {/* GST Score / 40 + Inline Absent Toggle */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            data-row-idx={idx}
                            min={0}
                            max={40}
                            value={edit.score}
                            disabled={edit.isAbsent}
                            placeholder={edit.isAbsent ? "Absent" : "—"}
                            onChange={(e) =>
                              handleScoreChange(learner.studentId, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            onPaste={(e) => handlePaste(e, idx)}
                            className={cn(
                              "h-7 w-16 rounded-md border px-2 font-mono text-xs font-semibold tabular-nums text-slate-800 shadow-2xs transition focus:outline-hidden dark:text-white",
                              edit.isAbsent
                                ? "border-slate-200 bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed dark:border-white/10 dark:bg-slate-800/60"
                                : isOutOfRange
                                ? "border-red-400 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-200 dark:border-red-500 dark:bg-red-950/20 dark:text-red-300"
                                : edit.isDirty
                                ? "border-amber-400 bg-amber-50/20 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-200 dark:border-amber-500 dark:bg-amber-950/20"
                                : "border-slate-200 bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-white/10 dark:bg-slate-800"
                            )}
                          />
                          <span className="ml-1 font-mono text-[10px] text-slate-400">
                            / 40
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleAbsentToggle(learner.studentId, edit.isAbsent)
                          }
                          title={edit.isAbsent ? "Click to clear absent status" : "Mark learner as Absent / For Reschedule"}
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10.5px] font-medium transition cursor-pointer shrink-0",
                            edit.isAbsent
                              ? "border-slate-400 bg-slate-200 text-slate-800 font-semibold dark:border-white/20 dark:bg-slate-700 dark:text-white"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          <CalendarX2 size={11} className={edit.isAbsent ? "text-slate-700 dark:text-white" : "text-slate-400"} />
                          <span>Absent</span>
                        </button>

                        {/* Inline validation message */}
                        {isOutOfRange && (
                          <span className="ml-1 text-[10px] font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                            Enter 0–40 only
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Result (reading interpretation only) */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {resultBadgeClass ? (
                        <span
                          className={cn(
                            "inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium whitespace-nowrap",
                            resultBadgeClass
                          )}
                        >
                          {resultText}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {resultText}
                        </span>
                      )}
                    </td>

                    {/* Status (save state only) */}
                    <td className="px-4 py-2 whitespace-nowrap">
                      {statusBadgeClass ? (
                        <span
                          className={cn(
                            "inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium whitespace-nowrap",
                            statusBadgeClass
                          )}
                        >
                          {statusText}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {statusText}
                        </span>
                      )}
                    </td>

                    {/* Action (next step only) */}
                    <td className="px-4 py-2 text-right whitespace-nowrap">
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Review Class GST Results
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {gradeSectionLabel} · {classInfo.language || "English"} ({learners.length} learners)
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs dark:border-white/5 dark:bg-slate-800/40">
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-600 dark:text-slate-400">Total Enrolled:</span>
                <span className="font-bold text-slate-900 dark:text-white">{draftSummary.total}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-[#246f54] font-medium dark:text-emerald-400">At Grade Level (28–40):</span>
                <span className="font-bold text-[#246f54]">{draftSummary.atGradeCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-amber-800 font-medium dark:text-amber-400">Needs Assessment (0–27):</span>
                <span className="font-bold text-amber-800 dark:text-amber-400">{draftSummary.needsIraCount}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-white/5">
                <span className="text-slate-700 font-medium dark:text-slate-300">For Reschedule:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{draftSummary.absentCount}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">Not Recorded:</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">{draftSummary.pendingCount}</span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-400">
              Saving will commit scores for {draftSummary.enteredCount} learners and record {draftSummary.absentCount} absences with null scores. Learners with scores 28–40 complete screening.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
              >
                Back to Editing
              </button>
              <button
                type="button"
                onClick={handleSaveAllResults}
                disabled={saving}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#246f54] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#1e5d46] transition disabled:opacity-60"
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
