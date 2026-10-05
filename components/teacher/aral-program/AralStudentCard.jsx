"use client";

import { useState } from "react";
import { Check, CheckCircle2, ChevronRight, AlertTriangle, Sparkles, Loader2, Award, Calendar } from "lucide-react";
import { generatePlpPrescription } from "@/lib/monitoring/plpRules";
import { cn } from "@/lib/utils";

const DEFAULT_MILESTONES = [
  { id: "diagnostic", label: "Diagnostic / Initial Assessment verified" },
  { id: "formative", label: "Formative Practice & Guided Drills completed" },
  { id: "midline", label: "Midline Progress Check evaluated" },
  { id: "review", label: "Final Competency Review administered" },
];

export default function AralStudentCard({
  learner,
  onOutcomeSelect,
  isArchive = false,
  archiveOutcome = "proficient",
}) {
  const [submitting, setSubmitting] = useState(false);
  const [completedMilestones, setCompletedMilestones] = useState(() => {
    // If archived, all milestones are completed
    if (isArchive) return new Set(["diagnostic", "formative", "midline", "review"]);
    // Local storage key per learner
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`aral_milestones_${learner.studentId || learner.id}`);
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set(["diagnostic"]);
  });

  // 1. PLP Prescription String
  const plpPrescription = generatePlpPrescription({
    learningArea: learner.subject || "English",
    philIriScore: learner.philIriScore,
    crlaScore: learner.crlaScore,
    readingLevel: learner.readingLevel,
    gradeLevel: learner.grade || 7,
  });

  const toggleMilestone = (id) => {
    if (isArchive) return;
    setCompletedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(
          `aral_milestones_${learner.studentId || learner.id}`,
          JSON.stringify([...next])
        );
      } catch {}
      return next;
    });
  };

  const handleOutcome = async (outcome) => {
    if (isArchive || submitting) return;
    setSubmitting(true);
    try {
      await onOutcomeSelect?.(learner, outcome);
    } finally {
      setSubmitting(false);
    }
  };

  const allMilestonesDone = completedMilestones.size >= DEFAULT_MILESTONES.length;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)] transition-all",
        isArchive
          ? "border-slate-200 bg-slate-50/50 opacity-95"
          : "border-slate-200 bg-white hover:border-cnhs-green/30"
      )}
    >
      {/* Student Banner */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h4 className="text-[14px] font-bold text-slate-800">
            {learner.studentName || `${learner.firstName} ${learner.lastName}`}
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-500">
            LRN: {learner.studentNumber || "—"} · {learner.gradeSection || `Grade ${learner.grade || 7}`}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold",
            isArchive
              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          )}
        >
          {isArchive ? "Completed / Exited" : learner.subject || "ARAL Active"}
        </span>
      </div>

      {/* 1. Rule-Based PLP Prescription */}
      <div className="mt-4 rounded-xl bg-emerald-50/50 border border-emerald-100 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900">
          <Sparkles size={13} className="text-emerald-600 shrink-0" />
          <span>Personalized Learning Plan (PLP)</span>
        </div>
        <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-emerald-950">
          {plpPrescription}
        </p>
      </div>

      {/* 2. Progress Milestone Checklist */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Session Milestones ({completedMilestones.size}/{DEFAULT_MILESTONES.length})
          </p>
          {allMilestonesDone && (
            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={11} /> Ready for EOSY
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {DEFAULT_MILESTONES.map((m) => {
            const isChecked = completedMilestones.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                disabled={isArchive}
                onClick={() => toggleMilestone(m.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg p-2 text-left text-[11px] transition-colors",
                  isChecked
                    ? "bg-slate-50 text-slate-800 font-medium"
                    : "hover:bg-slate-50 text-slate-500",
                  isArchive && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    isChecked
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white"
                  )}
                >
                  {isChecked && <Check size={11} strokeWidth={3} />}
                </span>
                <span className={cn(isChecked && "text-slate-800")}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. EOSY Post-Assessment Selector */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          EOSY Post-Assessment Outcome
        </p>

        {isArchive ? (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 border border-blue-100 p-2.5 text-[11px] text-blue-900 font-medium">
            <Award size={16} className="text-blue-600 shrink-0" />
            <div>
              <p className="font-bold">Proficient / Met Standard</p>
              <p className="text-[10px] text-blue-700">Archived · Successfully exited the ARAL program.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleOutcome("proficient")}
                className="flex flex-col items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50/60 p-2.5 text-center transition-all hover:bg-emerald-100 hover:border-emerald-400 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Proficient</span>
                </div>
                <span className="text-[10px] text-emerald-700 mt-0.5">
                  ≥ 75% · Exit to Archive
                </span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => handleOutcome("deficient")}
                className="flex flex-col items-center justify-center rounded-xl border border-amber-300 bg-amber-50/60 p-2.5 text-center transition-all hover:bg-amber-100 hover:border-amber-400 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>Deficient</span>
                </div>
                <span className="text-[10px] text-amber-700 mt-0.5">
                  &lt; 75% · Summer Referral
                </span>
              </button>
            </div>
            {submitting && (
              <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-500">
                <Loader2 size={12} className="animate-spin text-slate-500" />
                <span>Routing assessment…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
