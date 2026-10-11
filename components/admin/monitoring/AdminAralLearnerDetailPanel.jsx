"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  GraduationCap,
  BookOpen,
  User,
  CheckCircle2,
  Clock,
  RotateCcw,
  Loader2,
  TrendingUp,
  Award,
  AlertTriangle,
} from "lucide-react";
import {
  ARAL_APPROVAL_DB,
  ARAL_APPROVAL_STATUS,
  aralApprovalDisplayLabel,
  aralApprovalStyles,
} from "@/lib/monitoring/aralApproval";
import { reviewAralRecommendation } from "@/lib/supabase/queries/aralApprovals";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import { Pill, RiskPill } from "@/components/teacher/monitoring/shared";
import { cn } from "@/lib/utils";

const ARAL_GRADE_THRESHOLD = 75;

function formatGrade(grade) {
  if (grade === null || grade === undefined || grade === "") return "—";
  const num = Number(grade);
  return Number.isFinite(num) ? String(Math.round(num * 100) / 100) : String(grade);
}

export default function AdminAralLearnerDetailPanel({
  learner,
  isOpen,
  onClose,
  onUpdated,
  currentTerm = "Term 1",
}) {
  const prefersReducedMotion = useReducedMotion();
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState(null); // 'approve' | 'return' | null
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Sync draft note and feedback when learner changes
  useEffect(() => {
    if (learner) {
      setNote(learner.note || learner.aralApprovalNote || "");
      setFeedback(null);
    }
  }, [learner]);

  // Handle Escape key to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!learner && !isOpen) return null;

  const row = learner?.sourceRows?.[0] || learner || {};
  const studentName = learner?.name || row?.name || "Learner Details";
  const studentNumber = learner?.studentNumber || row?.studentNumber || row?.lrn || "—";
  const gradeSection = learner?.gradeSection || row?.gradeSection || row?.section || "—";
  const schoolYear = learner?.schoolYear || row?.schoolYear || "SY 2026-2027";
  const quarter = learner?.quarter || row?.quarter || "Term 1";

  // Approval status
  const rawStatus =
    learner?.displayStatus ||
    learner?.aralApprovalStatus ||
    row?.aralApprovalStatus ||
    ARAL_APPROVAL_STATUS.SUGGESTED;
  const isApproved = /approved/i.test(String(rawStatus));
  const isReturned = /returned/i.test(String(rawStatus));
  const isPending = !isApproved && !isReturned;

  // Identified subjects & grades
  const identifiedSubjects =
    learner?.identifiedSubjects?.length
      ? learner.identifiedSubjects
      : learner?.subjects?.length
        ? learner.subjects.map((sub) => ({
            subject: sub,
            grade: row.classSubjectGrade ?? null,
            quarter: learner.quarter || row.quarter || null,
          }))
        : row.subject
          ? [
              {
                subject: row.subject,
                grade: row.classSubjectGrade ?? null,
                quarter: row.quarter || null,
              },
            ]
          : [];

  // Assessment & Facilitator info
  const facilitatorName =
    learner?.aralFacilitatorName ||
    row?.aralFacilitatorName ||
    (learner?.aralFacilitatorTeacherId ? "Assigned" : "Not yet assigned");
  const hasFacilitator = Boolean(
    learner?.aralFacilitatorTeacherId || row?.aralFacilitatorTeacherId
  );

  const gstScore = row.philIriScore ?? learner?.philIriScore ?? null;
  const readingLevel =
    row.readingLevel ?? learner?.readingLevel ?? (gstScore != null ? "Instructional" : "Not Assessed");
  const screeningInterpretation =
    row.screeningInterpretation ??
    learner?.screeningInterpretation ??
    (gstScore != null && Number(gstScore) <= 15
      ? "Individualized Assessment (Starting point: 3 grade levels below)"
      : gstScore != null && Number(gstScore) <= 27
        ? "Individualized Assessment (Starting point: 2 grade levels below)"
        : gstScore != null
          ? "No further individualized assessment from GST"
          : "Assessment Pending");

  // Run single approval or return
  async function handleDecision(decision) {
    if (!learner || busyAction) return;
    setBusyAction(decision === ARAL_APPROVAL_DB.APPROVED ? "approve" : "return");
    setFeedback(null);

    try {
      const session = await getAdminSession();
      const reviewerProfileId = session.data?.id ?? null;
      const targetRows = learner.sourceRows?.length
        ? learner.sourceRows
        : [row];

      for (const item of targetRows) {
        const studentId = item.studentId || item.id || learner.studentId;
        const classId = item.classId || learner.classId || null;
        if (!studentId || !classId) continue;

        const res = await reviewAralRecommendation({
          studentId,
          classId,
          schoolYear,
          quarter: item.quarterNumber || 1,
          status: decision,
          reviewerProfileId,
          note: note.trim() || null,
        });

        if (res.error) throw res.error;
      }

      setFeedback({
        type: "success",
        message:
          decision === ARAL_APPROVAL_DB.APPROVED
            ? "Referral approved. Learner is ready for facilitator assignment."
            : "Referral returned to teacher with notes.",
      });
      onUpdated?.();
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to update referral decision.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && learner ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop: subtle dark fade without blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.2,
              ease: "easeOut",
            }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40"
            aria-hidden="true"
          />

          {/* Slide-in panel from right */}
          <motion.aside
            initial={{
              x: prefersReducedMotion ? 0 : "100%",
              opacity: prefersReducedMotion ? 0 : 1,
            }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: prefersReducedMotion ? 0 : "100%",
              opacity: prefersReducedMotion ? 0 : 0.4,
            }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-detail-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-md bg-cnhs-green-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                    <GraduationCap size={12} />
                    ARAL Learner Profile
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    {schoolYear} · {currentTerm}
                  </span>
                </div>
                <h2
                  id="learner-detail-title"
                  className="mt-1.5 truncate text-lg font-bold text-slate-900"
                >
                  {studentName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  LRN <strong className="font-mono text-slate-700">{studentNumber}</strong> · {gradeSection}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close learner details"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs text-slate-600">
              {/* Feedback Alert */}
              {feedback ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium",
                    feedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle size={15} className="shrink-0 text-red-500" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              ) : null}

              {/* Status & Review State */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Intervention Review Status
                  </span>
                  <Pill
                    value={aralApprovalDisplayLabel(rawStatus)}
                    styles={{
                      ...aralApprovalStyles,
                      [aralApprovalDisplayLabel(rawStatus)]:
                        aralApprovalStyles[rawStatus] || aralApprovalStyles.suggested,
                    }}
                  />
                </div>
                {learner.monitoringStatus ? (
                  <p className="mt-2 text-[11px] text-slate-600">
                    Monitoring: <strong className="font-semibold text-slate-800">{learner.monitoringStatus}</strong>
                  </p>
                ) : null}
              </div>

              {/* Academic Referral Basis */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Target Subject & Performance
                </h3>
                <div className="mt-2.5 space-y-2">
                  {identifiedSubjects.map((item, idx) => {
                    const failing = item.grade !== null && Number(item.grade) < ARAL_GRADE_THRESHOLD;
                    const isHistorical =
                      item.quarter &&
                      String(item.quarter).toLowerCase() !==
                        String(currentTerm).toLowerCase();
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            {item.subject}
                          </span>
                          {item.quarter ? (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.2 text-[10px] font-medium",
                                isHistorical
                                  ? "border border-amber-200/80 bg-amber-50 text-amber-800"
                                  : "text-slate-400"
                              )}
                            >
                              {isHistorical
                                ? `Historical (${item.quarter})`
                                : item.quarter}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <span
                            className={cn(
                              "text-xs font-bold tabular-nums",
                              failing ? "text-amber-700" : "text-slate-800"
                            )}
                          >
                            Grade: {formatGrade(item.grade)}
                          </span>
                          {failing ? (
                            <p className="text-[10px] text-amber-700">
                              Below passing (75)
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {learner.reasonLine ? (
                    <p className="mt-1 text-[11px] italic text-slate-400">
                      {learner.reasonLine}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Assessment Progress */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Phil-IRI Reading Assessment
                </h3>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center">
                    <p className="text-[10px] font-medium text-slate-400">
                      Beginning GST Score
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-800">
                      {gstScore != null ? `${gstScore} / 20` : "Pending"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center">
                    <p className="text-[10px] font-medium text-slate-400">
                      Assessed Reading Level
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-700">
                      {readingLevel}
                    </p>
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/40 p-2.5">
                  <p className="text-[10px] font-medium text-slate-400">
                    Screening Interpretation:
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-700">
                    {screeningInterpretation}
                  </p>
                </div>
              </div>

              {/* Assigned Facilitator */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Assigned ARAL Facilitator
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-800">
                      {facilitatorName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      hasFacilitator
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    )}
                  >
                    {hasFacilitator ? "Active" : "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Principal Review Action Box */}
              {isApproved ? (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                    <CheckCircle2 size={15} />
                    Approved for Assessment
                  </div>
                  {note ? (
                    <p className="text-[11px] text-emerald-800">
                      Review note: <span className="font-normal text-slate-700">{note}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] italic text-emerald-700/70">
                      No additional review note recorded.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Principal Decision & Endorsement Note
                  </h3>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={Boolean(busyAction)}
                    placeholder="Optional review note or instructions for teacher/facilitator…"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white"
                  />

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleDecision(ARAL_APPROVAL_DB.RETURNED)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 active:scale-95 disabled:opacity-50"
                    >
                      {busyAction === "return" ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      Return to Teacher
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleDecision(ARAL_APPROVAL_DB.APPROVED)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white transition hover:bg-[#246f54] active:scale-95 disabled:opacity-50"
                    >
                      {busyAction === "approve" ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      Approve for ARAL
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3">
              <span className="text-[11px] text-slate-400">
                Press <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to close
              </span>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95"
              >
                Close
              </button>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
