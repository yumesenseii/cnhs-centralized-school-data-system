"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Play, Save } from "lucide-react";
import {
  ARAL_ASSESSMENT_PHASE,
  ARAL_ASSESSMENT_RESULT,
  DEFAULT_ARAL_MAX_SCORE,
  DEFAULT_ARAL_PASS_PERCENT,
  aralAssessmentPhaseLabel,
  computeAralAssessmentResult,
  normalizeAralAssessmentPhase,
  parseOptionalScore,
} from "@/lib/monitoring/aralAssessments";
import { downloadAralAssessmentTemplateExcel } from "@/lib/reports/aralAssessmentExcel";
import {
  listAralAssessmentScores,
  saveAralAssessmentScores,
  startAralAssessmentForSection,
} from "@/lib/supabase/queries/aralProgram";
import { cn } from "@/lib/utils";

/**
 * Facilitator scoring grid for Pre / Mid / Post (one section).
 * Edit in portal; Download Excel is a scores overview (no upload).
 */
export default function AralAssessmentPanel({
  group,
  teacherId = null,
  phase = ARAL_ASSESSMENT_PHASE.PRE,
}) {
  const resolvedPhase = normalizeAralAssessmentPhase(phase);
  const phaseLabel = aralAssessmentPhaseLabel(resolvedPhase);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [maxScore, setMaxScore] = useState(DEFAULT_ARAL_MAX_SCORE);
  const [passPercent, setPassPercent] = useState(DEFAULT_ARAL_PASS_PERCENT);
  const [drafts, setDrafts] = useState({});
  const [phaseStarted, setPhaseStarted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const learners = group?.learners ?? [];
  const batchId = learners[0]?.batchId ?? null;
  const gradeSection = group?.gradeSection ?? "";
  const learnerKey = useMemo(
    () => learners.map((l) => l.studentId).join("|"),
    [learners]
  );

  const refresh = useCallback(async () => {
    if (!batchId || !gradeSection) {
      setLoading(false);
      setDrafts({});
      return;
    }
    setLoading(true);
    setError("");
    const result = await listAralAssessmentScores({
      batchId,
      gradeSection,
      phase: resolvedPhase,
    });
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const byStudent = new Map(
      (result.data ?? []).map((row) => [row.studentId, row])
    );

    let nextMax = DEFAULT_ARAL_MAX_SCORE;
    let nextPass = DEFAULT_ARAL_PASS_PERCENT;
    let started = false;
    const nextDrafts = {};

    for (const learner of learners) {
      const existing = byStudent.get(learner.studentId);
      if (existing) {
        if (existing.maxScore) nextMax = existing.maxScore;
        if (existing.passPercent != null) nextPass = existing.passPercent;
        if (
          existing.status === "in_progress" ||
          existing.status === "scored" ||
          existing.startedAt
        ) {
          started = true;
        }
      }
      const score = existing?.score ?? null;
      const rowMax = existing?.maxScore ?? nextMax;
      const rowPass = existing?.passPercent ?? nextPass;
      nextDrafts[learner.studentId] = {
        score: score == null ? "" : String(score),
        notes: existing?.notes || "",
        result:
          existing?.result ||
          computeAralAssessmentResult(score, rowMax, rowPass),
        status: existing?.status || "not_started",
        startedAt: existing?.startedAt || null,
        assignmentId: learner.id,
      };
    }

    setMaxScore(nextMax);
    setPassPercent(nextPass);
    setPhaseStarted(started);
    setDrafts(nextDrafts);
    setLoading(false);
    // learners captured via learnerKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, gradeSection, learnerKey, resolvedPhase]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const scoredCount = useMemo(() => {
    return Object.values(drafts).filter((d) => {
      const s = parseOptionalScore(d.score);
      return s != null;
    }).length;
  }, [drafts]);

  function updateDraft(studentId, patch) {
    setDrafts((prev) => {
      const current = prev[studentId] || {
        score: "",
        notes: "",
        result: null,
        status: "not_started",
      };
      const next = { ...current, ...patch };
      const score = parseOptionalScore(next.score);
      next.result = computeAralAssessmentResult(score, maxScore, passPercent);
      return { ...prev, [studentId]: next };
    });
    setToast("");
  }

  function recomputeAllResults(nextMax, nextPass) {
    setDrafts((prev) => {
      const next = {};
      for (const [studentId, row] of Object.entries(prev)) {
        const score = parseOptionalScore(row.score);
        next[studentId] = {
          ...row,
          result: computeAralAssessmentResult(score, nextMax, nextPass),
        };
      }
      return next;
    });
  }

  async function handleStart() {
    if (!teacherId) {
      setError(`Teacher session required to start ${phaseLabel}.`);
      return;
    }
    setStarting(true);
    setError("");
    setToast("");
    const result = await startAralAssessmentForSection({
      learners,
      gradeSection,
      phase: resolvedPhase,
      maxScore,
      passPercent,
      teacherId,
    });
    setStarting(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setToast(
      `${phaseLabel} started for ${result.data?.length || learners.length} learner(s).`
    );
    await refresh();
  }

  async function handleSave() {
    if (!teacherId || !batchId) {
      setError("Teacher session and batch are required to save.");
      return;
    }
    setSaving(true);
    setError("");
    setToast("");

    const rows = learners.map((learner) => {
      const draft = drafts[learner.studentId] || {};
      const score = parseOptionalScore(draft.score);
      return {
        studentId: learner.studentId,
        assignmentId: learner.id,
        score,
        maxScore,
        passPercent,
        result: computeAralAssessmentResult(score, maxScore, passPercent),
        notes: draft.notes || "",
        status: draft.status || "in_progress",
        startedAt: draft.startedAt || null,
      };
    });

    const result = await saveAralAssessmentScores({
      batchId,
      gradeSection,
      phase: resolvedPhase,
      teacherId,
      rows,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setToast(
      `Saved ${phaseLabel} scores for ${result.data?.length || rows.length} learner(s).`
    );
    await refresh();
  }

  async function handleDownloadOverview() {
    if (!learners.length) return;
    setDownloading(true);
    setError("");
    setToast("");
    try {
      const result = await downloadAralAssessmentTemplateExcel({
        learners,
        drafts,
        gradeSection,
        phase: resolvedPhase,
        maxScore,
        passPercent,
        schoolYear: group?.schoolYear || learners[0]?.schoolYear || "",
        generatedBy: "ARAL Facilitator",
      });
      setToast(
        `Downloaded ${phaseLabel} scores overview (${result.count} learner(s)).`
      );
    } catch (err) {
      setError(err?.message ?? "Unable to download Excel overview.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Loading {phaseLabel} scores…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-medium text-slate-500">
            Max score
            <input
              type="number"
              min={1}
              step={1}
              value={maxScore}
              onChange={(e) => {
                const next = Math.max(1, Number(e.target.value) || 1);
                setMaxScore(next);
                recomputeAllResults(next, passPercent);
              }}
              className="mt-1 block h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-cnhs-green"
            />
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            Pass %
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={passPercent}
              onChange={(e) => {
                const next = Math.min(
                  100,
                  Math.max(0, Number(e.target.value) || 0)
                );
                setPassPercent(next);
                recomputeAllResults(maxScore, next);
              }}
              className="mt-1 block h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-cnhs-green"
            />
          </label>
          <p className="pb-1.5 text-[10px] text-slate-400">
            Result auto: ≥{passPercent}% → Passed · below → For ARAL
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={starting || !teacherId || !learners.length}
            onClick={handleStart}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Start {phaseLabel} for class
          </button>
          <button
            type="button"
            disabled={downloading || !learners.length}
            onClick={handleDownloadOverview}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Download Excel
          </button>
          <button
            type="button"
            disabled={saving || !teacherId || !learners.length}
            onClick={handleSave}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save scores
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        {phaseStarted ? `${phaseLabel} open` : "Not started"} · {scoredCount} of{" "}
        {learners.length} scored
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-[820px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Learner",
                "Student No.",
                "Score",
                "Max",
                "Result",
                "Notes",
              ].map((column) => (
                <th
                  key={column}
                  className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => {
              const draft = drafts[learner.studentId] || {
                score: "",
                notes: "",
                result: null,
              };
              const result = draft.result;
              return (
                <tr
                  key={learner.studentId}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-3 py-2">
                    <p className="text-[12px] font-semibold text-slate-800">
                      {learner.studentName}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {learner.studentNumber}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={maxScore}
                      step={0.5}
                      value={draft.score}
                      onChange={(e) =>
                        updateDraft(learner.studentId, {
                          score: e.target.value,
                        })
                      }
                      placeholder="—"
                      className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-cnhs-green"
                    />
                  </td>
                  <td className="px-3 py-2 text-[12px] tabular-nums text-slate-600">
                    {maxScore}
                  </td>
                  <td className="px-3 py-2">
                    {result ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                          result === ARAL_ASSESSMENT_RESULT.PASSED
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                            : "bg-amber-50 text-amber-800 ring-amber-100"
                        )}
                      >
                        {result}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={draft.notes}
                      onChange={(e) =>
                        updateDraft(learner.studentId, {
                          notes: e.target.value,
                        })
                      }
                      placeholder="Optional"
                      className="h-8 w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-cnhs-green"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
