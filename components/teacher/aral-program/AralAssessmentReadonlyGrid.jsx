"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ARAL_ASSESSMENT_RESULT,
  aralAssessmentPhaseLabel,
  normalizeAralAssessmentPhase,
  uniqueAralLearners,
} from "@/lib/monitoring/aralAssessments";
import { listAralAssessmentScores } from "@/lib/supabase/queries/aralProgram";
import { cn } from "@/lib/utils";

/**
 * Read-only Pre/Mid/Post score grid for a section roster.
 */
export default function AralAssessmentReadonlyGrid({
  learners = [],
  batchId = null,
  gradeSection = "",
  phase = "pre",
}) {
  const resolvedPhase = normalizeAralAssessmentPhase(phase);
  const phaseLabel = aralAssessmentPhaseLabel(resolvedPhase);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scoresByStudent, setScoresByStudent] = useState(new Map());

  const learnerKey = useMemo(
    () => learners.map((l) => l.studentId || l.id).join("|"),
    [learners]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!batchId || !gradeSection) {
        setLoading(false);
        setScoresByStudent(new Map());
        return;
      }
      setLoading(true);
      setError("");
      const result = await listAralAssessmentScores({
        batchId,
        gradeSection,
        phase: resolvedPhase,
      });
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message);
        setScoresByStudent(new Map());
      } else {
        setScoresByStudent(
          new Map((result.data ?? []).map((row) => [row.studentId, row]))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, gradeSection, resolvedPhase, learnerKey]);

  const uniqueLearners = useMemo(
    () => uniqueAralLearners(learners),
    [learners]
  );

  const scoredCount = useMemo(() => {
    let n = 0;
    for (const learner of uniqueLearners) {
      const id = learner.studentId || learner.id;
      const row = scoresByStudent.get(id);
      if (row?.score != null) n += 1;
    }
    return n;
  }, [uniqueLearners, scoresByStudent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Loading {phaseLabel} scores…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
          {error}
        </p>
      ) : null}
      <p className="text-[11px] text-slate-500">
        View only · {scoredCount} of {uniqueLearners.length} scored ({phaseLabel})
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-[760px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {["Learner", "Student No.", "Score", "Max", "Result", "Notes"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {uniqueLearners.map((learner) => {
              const id = learner.studentId || learner.id;
              const row = scoresByStudent.get(id);
              const result = row?.result;
              return (
                <tr
                  key={id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-3 py-2 text-[12px] font-semibold text-slate-800">
                    {learner.name || learner.studentName}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {learner.studentNumber || "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px] tabular-nums text-slate-700">
                    {row?.score ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px] tabular-nums text-slate-600">
                    {row?.maxScore ?? "—"}
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
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {row?.notes || "—"}
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
