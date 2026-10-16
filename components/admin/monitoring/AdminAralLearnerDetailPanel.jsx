"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import { formatTeacherReadingConcern } from "@/lib/monitoring/aralLearnerAggregation";
import { Pill, RiskPill } from "@/components/teacher/monitoring/shared";
import { useAppToast } from "@/components/shared/AppToast";
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
  const { showToast } = useAppToast();
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState(null); // 'approve' | 'return' | null
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen || !learner) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, learner]);

  if (!mounted) return null;
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
  const rawProfile = row.readingLevel ?? learner?.readingLevel ?? null;
  const hasIra = Boolean(
    learner?.iraCompleted ||
    (rawProfile &&
      rawProfile !== "Not Screened" &&
      rawProfile !== "Pending Oral Profile" &&
      rawProfile !== "Not Set" &&
      rawProfile !== "Instructional" && // avoid legacy auto-default
      rawProfile !== "Pending Individual Assessment")
  );

  const readingLevel = hasIra && rawProfile
    ? rawProfile
    : gstScore != null
      ? (Number(gstScore) >= 14 ? "Independent / Passed" : "Pending Individual Assessment")
      : "Not Assessed";

  const screeningInterpretation =
    row.screeningInterpretation ??
    learner?.screeningInterpretation ??
    (gstScore != null
      ? (Number(gstScore) >= 14
          ? "No individualized assessment needed from GST"
          : `GST: ${gstScore} — Needs Individual Assessment`)
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

      const successMsg =
        decision === ARAL_APPROVAL_DB.APPROVED
          ? "Referral approved. Learner is ready for facilitator assignment."
          : "Referral returned to teacher with notes.";

      setFeedback({
        type: "success",
        message: successMsg,
      });

      showToast({
        title: decision === ARAL_APPROVAL_DB.APPROVED ? "Referral Approved" : "Referral Returned",
        message: decision === ARAL_APPROVAL_DB.APPROVED
          ? `Approved ARAL recommendation for ${studentName}.`
          : `Returned ARAL recommendation for ${studentName} with notes.`,
        tone: decision === ARAL_APPROVAL_DB.APPROVED ? "success" : "info",
        durationMs: 5000,
      });

      onUpdated?.();
    } catch (err) {
      const errMsg = err.message || "Failed to update referral decision.";
      setFeedback({
        type: "error",
        message: errMsg,
      });
      showToast({
        title: "Review Error",
        message: errMsg,
        tone: "error",
        durationMs: 5000,
      });
    } finally {
      setBusyAction(null);
    }
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && learner ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop with subtle blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.18,
              ease: "easeOut",
            }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Centered Modal Card */}
          <motion.div
            initial={{
              scale: prefersReducedMotion ? 1 : 0.96,
              y: prefersReducedMotion ? 0 : 12,
              opacity: 0,
            }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{
              scale: prefersReducedMotion ? 1 : 0.96,
              y: prefersReducedMotion ? 0 : 8,
              opacity: 0,
            }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-detail-title"
            className="relative z-10 flex w-[min(640px,calc(100vw-2rem))] max-h-[88vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]"
          >
            {/* Header (pinned) */}
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[var(--card)]">
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
                  className="mt-1.5 truncate text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {studentName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  LRN <strong className="font-mono text-slate-700 dark:text-slate-200">{studentNumber}</strong> · {gradeSection}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close learner details"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-95 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body (scrollable) */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs text-slate-600 dark:text-slate-300">
              {/* Feedback Alert */}
              {feedback ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium",
                    feedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300"
                  )}
                >
                  {feedback.type === "success" ? (
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle size={15} className="shrink-0 text-red-500 dark:text-red-400" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              ) : null}

              {/* Status & Review State */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-white/5 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                  <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                    Monitoring: <strong className="font-semibold text-slate-800 dark:text-slate-200">{learner.monitoringStatus}</strong>
                  </p>
                ) : null}
              </div>

              {/* Academic Referral Basis */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/40 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                            {item.subject}
                          </span>
                          {item.quarter ? (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.2 text-[10px] font-medium",
                                isHistorical
                                  ? "border border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
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
                              failing ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-slate-200"
                            )}
                          >
                            Grade: {formatGrade(item.grade)}
                          </span>
                          {failing ? (
                            <p className="text-[10px] text-amber-700 dark:text-amber-400">
                              Below passing (75)
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-2 rounded-lg bg-sky-50/60 p-2.5 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                    <span className="font-semibold">Teacher&apos;s Reading Concern:</span>{" "}
                    {formatTeacherReadingConcern(learner)}
                  </div>
                </div>
              </div>

              {/* Assessment Progress */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Phil-IRI Reading Assessment
                </h3>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                    <p className="text-[10px] font-medium text-slate-400">
                      Beginning GST Score
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-800 dark:text-slate-100">
                      {gstScore != null ? `${gstScore} / 20` : "Pending"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                    <p className="text-[10px] font-medium text-slate-400">
                      Assessed Reading Level
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      {readingLevel}
                    </p>
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/40 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                  <p className="text-[10px] font-medium text-slate-400">
                    Screening Interpretation:
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {screeningInterpretation}
                  </p>
                </div>
              </div>

              {/* Assigned Facilitator */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Assigned ARAL Facilitator
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {facilitatorName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      hasFacilitator
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                    )}
                  >
                    {hasFacilitator ? "Active" : "Unassigned"}
                  </span>
                </div>
              </div>

              {/* Principal Review Action Box */}
              {isApproved ? (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-1.5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={15} />
                    Approved for Assessment
                  </div>
                  {note ? (
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      Review note: <span className="font-normal text-slate-700 dark:text-slate-300">{note}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] italic text-emerald-700/70 dark:text-emerald-400/60">
                      No additional review note recorded.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Principal Decision & Endorsement Note
                  </h3>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={Boolean(busyAction)}
                    placeholder="Optional review note or instructions for teacher/facilitator…"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-cnhs-green"
                  />

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={() => handleDecision(ARAL_APPROVAL_DB.RETURNED)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-50 active:scale-95 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
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

            {/* Footer (pinned) */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-white/10 dark:bg-[var(--card)]/80">
              <span className="text-[11px] text-slate-400">
                Press <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">Esc</kbd> to close
              </span>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
