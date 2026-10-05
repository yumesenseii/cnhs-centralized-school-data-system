"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { referLearnerToAral } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AralCandidateSidePanel({
  learner,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [showSourceData, setShowSourceData] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useAppToast();

  if (!isOpen || !learner) return null;

  const handleRefer = async () => {
    setSaving(true);
    try {
      const res = await referLearnerToAral({
        studentId: learner.studentId,
        classId: learner.classId,
        monitoringRecordId: learner.monitoringId,
        notes: `Referred to ARAL based on Phil-IRI screening (${learner.philIriScore || "Tested"}) and class grade (${learner.classSubjectGrade || "Low"}).`,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to refer student to ARAL.");
        return;
      }

      showToast("success", `${learner.name} has been referred to ARAL for Principal assignment.`);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("error", "Error submitting referral.");
    } finally {
      setSaving(false);
    }
  };

  const isReferred = learner.monitoringStatus === "Referred to ARAL" || learner.candidateStatus === "Referred to ARAL";

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-slate-900/40 backdrop-blur-[2px]">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 280 }}
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ARAL Candidate Review
                </h3>
                <p className="text-[11px] text-slate-500">
                  Baseline screening & referral triage
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. Student Information */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Student Information
              </h4>
              <div className="mt-2.5">
                <p className="text-[15px] font-bold text-slate-900">
                  {learner.name || "Learner Name"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                  <span>LRN: {learner.studentNumber || "—"}</span>
                  <span>·</span>
                  <span>{learner.grade} - {learner.section}</span>
                  <span>·</span>
                  <span className="font-semibold text-blue-800">{learner.subject}</span>
                </div>
              </div>
            </div>

            {/* 2. Academic Baseline */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.02)]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Academic Baseline (My Classes)
              </h4>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-slate-500">Current Subject Grade</p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900">
                    {learner.classSubjectGrade ?? learner.academicGrade ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-slate-500">Risk Indicator</p>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold",
                      learner.riskLevel === "High Risk"
                        ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                        : learner.riskLevel === "Moderate Risk"
                        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    )}
                  >
                    {learner.riskLevel || "Identified"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Phil-IRI Baseline */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                  Phil-IRI Baseline Profile
                </h4>
                <span className="rounded-full bg-blue-100/70 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  Form 1B
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 border border-blue-50">
                  <p className="text-[11px] text-slate-500">Total Raw Score</p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900">
                    {learner.philIriScore != null ? `${learner.philIriScore}` : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-white p-3 border border-blue-50">
                  <p className="text-[11px] text-slate-500">Reading Level</p>
                  <p className="mt-0.5 text-[13px] font-bold text-blue-900">
                    {learner.readingLevel || "Pending Import"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-white p-3 border border-blue-50">
                <p className="text-[11px] text-slate-500">DepEd Screening Interpretation</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">
                  {learner.screeningInterpretation ||
                    (learner.philIriScore != null && Number(learner.philIriScore) <= 7
                      ? "3 levels lower Phil-IRI testing"
                      : learner.philIriScore != null && Number(learner.philIriScore) <= 13
                      ? "2 levels lower Phil-IRI testing"
                      : learner.philIriScore != null
                      ? "No Phil-IRI test required"
                      : "Pending Phil-IRI import")}
                </p>
              </div>

              {/* Collapsible Source Data */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowSourceData(!showSourceData)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                >
                  <span>{showSourceData ? "Hide Sub-scores" : "View Source Sub-scores"}</span>
                  {showSourceData ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showSourceData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 rounded-xl bg-white p-3 border border-blue-100 text-[11px] space-y-1.5"
                  >
                    <div className="flex justify-between">
                      <span className="text-slate-500">Literal Comprehension:</span>
                      <span className="font-semibold text-slate-800">
                        {learner.literalScore ?? "Recorded in Excel"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Inferential Comprehension:</span>
                      <span className="font-semibold text-slate-800">
                        {learner.inferentialScore ?? "Recorded in Excel"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Critical Comprehension:</span>
                      <span className="font-semibold text-slate-800">
                        {learner.criticalScore ?? "Recorded in Excel"}
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* 4. ARAL Review & Qualification */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Candidate Status & Referral
              </h4>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[12px] text-slate-600">Review Status:</span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    isReferred
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  )}
                >
                  {isReferred ? "Referred to ARAL" : "ARAL Candidate"}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Referring this student queues them for the Principal to assign an ARAL Basic/Plus pathway and allocate a tutor.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefer}
                disabled={saving || isReferred}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold shadow-sm transition-colors",
                  isReferred
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isReferred ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <ArrowRight size={14} />
                )}
                {isReferred ? "Already Referred" : "Refer to ARAL"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
