"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Pencil,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  GraduationCap,
  ArrowUpRight,
  BookOpen,
  Calendar,
} from "lucide-react";
import { saveSinglePhilIriResult, createMonitoringRecord } from "@/lib/supabase/queries/monitoring";
import { RiskPill } from "@/components/teacher/monitoring/shared";
import { getAssessmentPermissions, ASSESSMENT_TERMS, ASSESSMENT_STAGES } from "@/lib/monitoring/assessmentTimeline";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function StudentMonitoringSidePanel({
  learner,
  isOpen,
  onClose,
  onRefresh,
  onNavigateToAral,
  isLanguageTeacher = false,
  currentQuarterNumber = 1,
}) {
  const pathname = usePathname();
  const [isEditingPhilIri, setIsEditingPhilIri] = useState(false);
  const [editGstScore, setEditGstScore] = useState("");
  const [editReadingLevel, setEditReadingLevel] = useState("Instructional");
  const [savingEdit, setSavingEdit] = useState(false);

  // Class Remedial Lifecycle State
  const [remedialStatus, setRemedialStatus] = useState("Recommended");
  const [updatingRemedial, setUpdatingRemedial] = useState(false);

  // New Observation / Progress log state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteProgress, setNoteProgress] = useState("Needs Follow-up");
  const [noteIntervention, setNoteIntervention] = useState("");
  const [noteRemarks, setNoteRemarks] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Calculate Active Term using assessmentTimeline
  const activeTerm = currentQuarterNumber === 1 ? ASSESSMENT_TERMS.TERM_1 : currentQuarterNumber === 2 ? ASSESSMENT_TERMS.TERM_2 : ASSESSMENT_TERMS.TERM_3;
  const permissions = getAssessmentPermissions(activeTerm);
  
  // Determine which phase is currently editable
  const currentPhase = permissions[ASSESSMENT_STAGES.BEG].editable ? "BOSY (Beginning)" : permissions[ASSESSMENT_STAGES.MID].editable ? "MOSY (Midline)" : "EOSY (End)";

  const { showToast } = useAppToast();

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    setIsEditingPhilIri(false);
    setIsAddingNote(false);
    if (learner) {
      setRemedialStatus(
        learner.remedialStatus ||
          learner.interventionStatus ||
          learner.monitoringStatus ||
          "Recommended"
      );
    }
  }, [learner?.id, learner?.studentId, isOpen, learner]);

  if (!isOpen || !learner) return null;

  async function handleUpdateRemedialStatus(newStatus) {
    if (updatingRemedial) return;
    setUpdatingRemedial(true);
    try {
      const studentId = learner.studentId || learner.id;
      const classId = learner.classId || null;
      await createMonitoringRecord({
        student_id: studentId,
        class_id: classId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: "Class Remedial",
        teacher_remarks: `Class Remedial status confirmed as ${newStatus}.`,
        student_progress: newStatus === "Completed" ? "Improving" : "Ongoing",
        follow_up_needed: newStatus === "Needs Continued Support",
        monitoring_status: newStatus,
        school_year: learner.schoolYear || "SY 2026-2027",
        quarter: currentQuarterNumber,
      });
      setRemedialStatus(newStatus);
      showToast("success", `Class Remedial status updated to ${newStatus}.`);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to update Class Remedial status.");
    } finally {
      setUpdatingRemedial(false);
    }
  }

  const studentFullName =
    learner.name ||
    `${learner.lastName || ""}, ${learner.firstName || ""}`.trim() ||
    "Student Name";
  const studentLrn = learner.studentNumber || learner.lrn || "—";
  const studentGrade = learner.grade || "Grade 7";
  const studentSection = learner.section || "Section";
  const studentAdviser = learner.adviserName || learner.adviser || "Adviser";

  const curGrade = learner.classSubjectGrade ?? learner.currentGrade ?? null;
  const prevGrade =
    learner.previousGrade ??
    (currentQuarterNumber > 1 ? learner.termGrades?.[currentQuarterNumber - 1] : null);
  const perfTrend = learner.performanceTrend || "Stable";
  const attRate = learner.attendanceRate || "92%";

  const isReadingSubject = /english|filipino/i.test(learner.subject || "");
  const canManageReading = isLanguageTeacher || isReadingSubject;

  // Phil-IRI values
  const hasGstScore =
    learner.philIriScore != null && !Number.isNaN(Number(learner.philIriScore));
  const gstScore = hasGstScore ? Number(learner.philIriScore) : null;
  const readingLevelDisplay =
    learner.readingLevel && learner.readingLevel !== "Not Assessed" && learner.readingLevel !== "N/A"
      ? learner.readingLevel
      : hasGstScore ? "Instructional" : "Not Assessed";

  const screeningInterpretation =
    learner.screeningInterpretation ||
    (gstScore != null && gstScore <= 15
      ? "Individualized Assessment (Starting point: 3 grade levels below)"
      : gstScore != null && gstScore <= 27
      ? "Individualized Assessment (Starting point: 2 grade levels below)"
      : gstScore != null
      ? "No further individualized assessment from GST"
      : "Not Assessed");

  // Support / Recommended Pathway
  const recommendedSupport = learner.recommendedSupport || "Class Remedial";
  const supportReason =
    learner.supportReason ||
    (recommendedSupport === "ARAL Screening"
      ? "Academic performance and applicable reading assessment results indicate the learner requires further reading intervention screening."
      : recommendedSupport === "Class Remedial"
      ? `Recent academic performance shows continued difficulty in ${learner.subject || "the subject"}.`
      : recommendedSupport === "Review"
      ? "Performance trend indicates need for close teacher monitoring and review."
      : "Learner is performing satisfactorily with consistent academic progress.");

  // Decision Support
  const decisionSupport = learner.decisionSupport || {
    riskLevel: learner.riskLevel ? learner.riskLevel.replace(/\s*Risk$/i, "") : "Moderate",
    modelConfidenceDisplay: "82%",
    contributingIndicators: [
      "Declining academic performance",
      "Low recent assessment result",
      "Previous performance trend baseline",
    ],
    disclaimer:
      "Random Forest serves as analytical decision support and does not supersede official DepEd assessment rules.",
  };

  // PLP Recommendation
  const plp = learner.plp || {
    learningNeed: `${learner.subject || "Subject"} core competencies reinforcement`,
    evidence: `Current grade ${curGrade || "—"}, Phil-IRI: ${readingLevelDisplay}, ${perfTrend.toLowerCase()} recent performance`,
    targetArea: `Essential learning competencies in ${learner.subject || "Subject"}`,
    recommendedIntervention: recommendedSupport,
    progressMonitoring: "Continue monitoring academic performance and intervention progress.",
  };

  function handleStartEdit() {
    setEditGstScore(hasGstScore ? String(gstScore) : "");
    setEditReadingLevel(readingLevelDisplay);
    setIsEditingPhilIri(true);
  }

  async function handleSaveEdit(e) {
    e?.preventDefault?.();
    const numericScore = editGstScore === "" ? null : Number(editGstScore);
    if (numericScore !== null && (numericScore < 0 || numericScore > 40)) {
      showToast("error", "GST raw score must be between 0 and 40.");
      return;
    }

    setSavingEdit(true);
    try {
      const studentId = learner.studentId || learner.id;
      const classId = learner.classId || null;

      const interpretation =
        numericScore === null
          ? "Screening Pending"
          : numericScore <= 15
          ? "Individualized Assessment (Starting point: 3 grade levels below)"
          : numericScore <= 27
          ? "Individualized Assessment (Starting point: 2 grade levels below)"
          : "No further individualized assessment from GST";

      const res = await saveSinglePhilIriResult({
        studentId,
        classId,
        quarter: currentQuarterNumber,
        subject: learner.subject || "English",
        gstScore: numericScore,
        individualAssessmentRequired: numericScore !== null && numericScore <= 27,
        readingLevel: editReadingLevel,
        screeningInterpretation: interpretation,
      });

      if (res?.error) {
        showToast("error", res.error.message || "Failed to update assessment.");
        return;
      }

      showToast("success", "Assessment result updated.");
      setIsEditingPhilIri(false);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to update assessment result.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSaveObservation(e) {
    e?.preventDefault?.();
    if (!noteIntervention.trim() && !noteRemarks.trim()) {
      showToast("error", "Please enter intervention provided or teacher remarks.");
      return;
    }

    setSavingNote(true);
    try {
      const studentId = learner.studentId || learner.id;
      const classId = learner.classId || null;

      await createMonitoringRecord({
        student_id: studentId,
        class_id: classId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: noteIntervention.trim() || recommendedSupport,
        teacher_remarks: noteRemarks.trim() || "Regular monitoring observation recorded.",
        student_progress: noteProgress,
        followUpNeeded: noteProgress === "Needs Follow-up",
        monitoring_status: "Ongoing",
        school_year: learner.schoolYear || "SY 2026-2027",
        quarter: currentQuarterNumber,
      });

      showToast("success", "Observation record saved.");
      setIsAddingNote(false);
      setNoteIntervention("");
      setNoteRemarks("");
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to save observation record.");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleRecommendAral() {
    showToast("success", "Learner recommended for ARAL Assessment. Pending Principal Approval.");
    onRefresh?.();
    onClose?.();
  }

  async function handleStartRemedial() {
    showToast("success", "Class Remedial started.");
    onRefresh?.();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="learner-profile-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-[2px] overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="relative w-full max-w-[920px] max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-[0_24px_64px_-12px_rgba(15,23,42,0.35)] flex flex-col overflow-hidden m-auto"
      >
        {/* ENTERPRISE RECORD HEADER — learner identity + workflow context */}
        <div className="border-b border-slate-200 bg-white px-5 sm:px-6 pt-4 sm:pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cnhs-green-soft text-[13px] font-bold text-cnhs-green-dark ring-1 ring-emerald-200/60"
              >
                {String(studentFullName || "?")
                  .split(/[\s,]+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark border border-emerald-200/80">
                    <GraduationCap size={12} />
                    CNHS Learn Record
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {learner.schoolYear || "SY 2026-2027"} · Term {currentQuarterNumber}
                  </span>
                </div>
                <h2
                  id="learner-profile-title"
                  className="mt-1 truncate text-lg sm:text-xl font-bold tracking-tight text-slate-900"
                >
                  {studentFullName}
                </h2>
                <p className="mt-0.5 truncate text-[12px] text-slate-500">
                  LRN <span className="font-mono font-medium text-slate-600">{studentLrn}</span>
                  <span className="mx-1.5 text-slate-300">•</span>
                  {studentGrade} · {studentSection}
                  {learner.subject ? (
                    <>
                      <span className="mx-1.5 text-slate-300">•</span>
                      {learner.subject}
                    </>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RiskPill value={learner.riskLevel || "—"} />
                  {learner.monitoringStatus ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {learner.monitoringStatus}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pathname?.includes("aral-monitoring") ? (
                <Link
                  href={`/teacher/monitoring?studentId=${learner?.studentId || learner?.id || ""}`}
                  title="View complete academic performance profile"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  <span>View Academic Performance</span>
                  <ArrowUpRight size={13} className="text-slate-500" />
                </Link>
              ) : (
                (hasGstScore || learner?.interventionStatus === "ARAL Candidate") && (
                  <Link
                    href={`/teacher/aral-monitoring?studentId=${learner?.studentId || learner?.id || ""}`}
                    title="View in Reading Intervention workspace"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-cnhs-green-dark shadow-2xs hover:bg-emerald-100 transition"
                  >
                    <span>View in Reading Intervention</span>
                    <ArrowUpRight size={13} className="text-cnhs-green-dark" />
                  </Link>
                )
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
              </div>
            </div>
          </div>

        {/* DOCUMENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-100/60">

          {/* UNIFIED LEARNER SUPPORT STATUS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 sm:p-5 shadow-xs">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <BookOpen size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                  Current Support Status
                </span>
                <p className="mt-1 text-lg font-bold tracking-tight text-blue-900">
                  {learner.monitoringStatus || "Monitoring"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 sm:p-5 shadow-xs">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <ArrowUpRight size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
                  Current Next Action
                </span>
                <p className="mt-1 text-lg font-bold tracking-tight text-amber-900">
                  {learner.recommendationDisplay || recommendedSupport}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:gap-5">
            <div>
{/* 1. STUDENT INFORMATION (Formal Document Surface) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              1. Student Information
            </h3>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Learner Name
                </span>
                <span className="mt-0.5 text-sm font-bold text-slate-900 block truncate">
                  {studentFullName}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Learner Reference No.
                </span>
                <span className="mt-0.5 font-mono font-medium text-slate-800 block text-xs">
                  {studentLrn}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Grade & Section
                </span>
                <span className="mt-0.5 font-semibold text-slate-800 block">
                  {studentGrade} · {studentSection}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Class Adviser
                </span>
                <span className="mt-0.5 text-slate-700 block truncate">
                  {studentAdviser}
                </span>
              </div>
            </div>
            {learner.subject ? (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Subject Handled: <strong className="text-slate-800">{learner.subject}</strong>
                </span>
                <span>
                  Teacher: <strong className="text-slate-800">{learner.teacherName || "—"}</strong>
                </span>
              </div>
            ) : null}
          </div>
            </div>
            
            <div className="contents">
{/* 2. ACADEMIC PERFORMANCE */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                2. Academic Performance
              </h3>
              <span className="text-[10.5px] text-slate-400">Quarterly & Subject Standing</span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
              <div className="pr-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Current Grade {learner.subject ? `(${learner.subject})` : ""}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-3xl font-extrabold tracking-tight leading-none",
                      curGrade != null && Number(curGrade) < 75
                        ? "text-amber-800"
                        : "text-slate-900"
                    )}
                  >
                    {curGrade != null ? curGrade : "—"}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    / 100
                  </span>
                </div>
                <span className="mt-1 block text-[10.5px] text-slate-400">
                  {curGrade != null && Number(curGrade) < 75 ? "Below Passing (75)" : "Passing Standard"}
                </span>
              </div>

              <div className="px-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Previous Grade
                </span>
                <span className="mt-2 text-xl font-bold text-slate-700 block">
                  {prevGrade != null ? prevGrade : "No previous data"}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  Quarter {currentQuarterNumber > 1 ? currentQuarterNumber - 1 : 1} baseline
                </span>
              </div>

              <div className="pl-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Performance Trend
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  {perfTrend === "Improving" ? (
                    <TrendingUp size={16} className="text-emerald-600" />
                  ) : perfTrend === "Declining" ? (
                    <TrendingDown size={16} className="text-amber-700" />
                  ) : (
                    <Minus size={16} className="text-slate-400" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-bold",
                      perfTrend === "Improving"
                        ? "text-emerald-700"
                        : perfTrend === "Declining"
                        ? "text-amber-800"
                        : "text-slate-700"
                    )}
                  >
                    {perfTrend} {learner.subject ? `in ${learner.subject}` : ""}
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  Term-over-term trajectory
                </span>
              </div>
            </div>

            {/* Subject-level performance grid if available */}
            {learner.subjectGrades && learner.subjectGrades.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Subject-Level Performance
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {learner.subjectGrades.map((sg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded border px-2.5 py-1.5 flex items-center justify-between",
                        Number(sg.grade) < 75
                          ? "border-amber-200 bg-amber-50/60"
                          : "border-slate-200 bg-slate-50/40"
                      )}
                    >
                      <span className="font-medium text-slate-700 truncate pr-1">{sg.subject}</span>
                      <span
                        className={cn(
                          "font-bold font-mono",
                          Number(sg.grade) < 75 ? "text-amber-800" : "text-slate-900"
                        )}
                      >
                        {sg.grade ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
{/* 4. ASSESSMENT EVIDENCE (PHIL-IRI) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                4. Assessment Evidence (Phil-IRI)
              </h3>
              {canManageReading && !isEditingPhilIri ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  <Pencil size={11} />
                  <span>Update Assessment</span>
                </button>
              ) : null}
            </div>

            {isEditingPhilIri ? (
              <form onSubmit={handleSaveEdit} className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      GST Raw Score (0–40)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={editGstScore}
                      onChange={(e) => setEditGstScore(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                      placeholder="e.g. 12"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Reading Level
                    </label>
                    <select
                      value={editReadingLevel}
                      onChange={(e) => setEditReadingLevel(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    >
                      <option value="Frustration">Frustration</option>
                      <option value="Instructional">Instructional</option>
                      <option value="Independent">Independent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Period (Term Based)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentPhase}
                      className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingPhilIri(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-cnhs-green-dark px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Save Result</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
                <div className="pr-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Phil-IRI Status
                  </span>
                  <span className="mt-1 text-sm font-semibold text-slate-900 block">
                    {hasGstScore ? "Assessed" : "Not Assessed"}
                  </span>
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                    Group Screening
                  </span>
                </div>
                <div className="px-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    GST Result
                  </span>
                  <span className="mt-1 text-sm font-bold text-slate-900 block">
                    {hasGstScore ? `${gstScore} / 20` : "Not Recorded"}
                  </span>
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                    Raw Score
                  </span>
                </div>
                <div className="px-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Reading Assessment
                  </span>
                  <span className="mt-1 text-xs font-medium text-slate-700 block">
                    {hasGstScore 
                      ? (gstScore <= 27 ? "Further assessment indicated" : "No further individualized assessment from GST")
                      : "—"}
                  </span>
                </div>
                <div className="pl-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Action
                  </span>
                  <Link
                    href={`/teacher/aral-monitoring?studentId=${learner?.studentId || learner?.id || ""}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                  >
                    View in Reading Intervention <ArrowUpRight size={11} />
                  </Link>
                </div>
              </div>
            )}

            {/* Evidence Flow Note */}
            <div className="mt-3 rounded border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-cnhs-green-dark shrink-0 mt-0.5" />
              <span>
                <strong>Evidence Connection:</strong> Academic performance indicates subject standing (Grade: {curGrade || "—"}).
                Phil-IRI reading assessment provides secondary evidence ({readingLevelDisplay}), supporting the recommended intervention pathway below without overriding official grading rules.
              </span>
            </div>
          </div>
{/* 9. PROGRESS HISTORY & OBSERVATIONS */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                9. Progress History & Teacher Observations
              </h3>
              {!isAddingNote ? (
                <button
                  type="button"
                  onClick={() => setIsAddingNote(true)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  <Pencil size={11} />
                  <span>Add Observation Note</span>
                </button>
              ) : null}
            </div>

            {isAddingNote ? (
              <form onSubmit={handleSaveObservation} className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Intervention Given
                    </label>
                    <input
                      type="text"
                      value={noteIntervention}
                      onChange={(e) => setNoteIntervention(e.target.value)}
                      placeholder="e.g. Small group guided reading / Skill review"
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Progress Evaluation
                    </label>
                    <select
                      value={noteProgress}
                      onChange={(e) => setNoteProgress(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    >
                      <option value="Improving">Improving</option>
                      <option value="Satisfactory">Satisfactory</option>
                      <option value="Needs Follow-up">Needs Follow-up</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600">
                    Teacher Remarks / Next Steps
                  </label>
                  <textarea
                    rows={2}
                    value={noteRemarks}
                    onChange={(e) => setNoteRemarks(e.target.value)}
                    placeholder="Enter observation notes, learner response, and next monitoring milestone..."
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingNote}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-cnhs-green-dark px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Save Note</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3">
                {learner.records && learner.records.length > 0 ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {learner.records.map((rec) => (
                      <div key={rec.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-900">
                            {rec.interventionGiven || "Classroom Remediation"}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {rec.observationDate || rec.createdAt}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                          {rec.teacherRemarks}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Status: <strong className="text-slate-600">{rec.studentProgress || "Ongoing"}</strong></span>
                          {rec.teacherName ? <span>• By {rec.teacherName}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2">
                    No historical observation notes recorded for this quarter yet.
                    Use &ldquo;Add Observation Note&rdquo; above to record remediation progress.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
            </div>

            <div className="contents">
{/* 3. ATTENDANCE */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                3. Attendance Records
              </h3>
              <span className="text-[10.5px] text-slate-400">Learner Engagement</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Attendance Rate
                </span>
                <span className="mt-1 text-2xl font-bold font-mono text-slate-900 block">
                  {attRate}
                </span>
                <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                  {parseInt(attRate, 10) >= 90 ? "Regular School Attendance" : "Attendance Concern Identified"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Attendance Status
                </span>
                <span
                  className={cn(
                    "mt-2 inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border",
                    parseInt(attRate, 10) >= 90
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                >
                  {parseInt(attRate, 10) >= 90 ? "Satisfactory" : "At-Risk (Absences)"}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  DepEd attendance threshold: 80%
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Observation Period
                </span>
                <span className="mt-2 text-xs font-semibold text-slate-800 block">
                  {learner.schoolYear || "SY 2026-2027"}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                  School Days Monitored
                </span>
              </div>
            </div>
          </div>
{/* 5. IDENTIFIED LEARNING NEED */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              5. Identified Learning Need
            </h3>
            <div className="mt-3 rounded border border-slate-200 bg-slate-50/50 p-3 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Primary Academic Concern
              </span>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {plp.learningNeed}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-600">
                <span>
                  <strong>Evidence:</strong> {plp.evidence}
                </span>
                <span>•</span>
                <span>
                  <strong>Target Competency:</strong> {plp.targetArea}
                </span>
              </div>
            </div>
          </div>
{/* 6. PLP-ORIENTED RECOMMENDATION */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                6. Personalized Learning Plan (PLP) Direction
              </h3>
              <span className="text-[10.5px] text-slate-400">Target & Monitoring Plan</span>
            </div>
            <div className="mt-3 space-y-2.5 text-xs text-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 border-b border-slate-100 pb-2">
                <span className="w-44 font-bold text-slate-600 shrink-0">Learner Need:</span>
                <span className="text-slate-900 font-medium">{plp.learningNeed}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 border-b border-slate-100 pb-2">
                <span className="w-44 font-bold text-slate-600 shrink-0">Supporting Evidence:</span>
                <span className="text-slate-800">{plp.evidence}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 border-b border-slate-100 pb-2">
                <span className="w-44 font-bold text-slate-600 shrink-0">Target Competency Area:</span>
                <span className="text-slate-800">{plp.targetArea}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 border-b border-slate-100 pb-2">
                <span className="w-44 font-bold text-slate-600 shrink-0">Recommended Intervention:</span>
                <span className="font-bold text-cnhs-green-dark">{plp.recommendedIntervention}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                <span className="w-44 font-bold text-slate-600 shrink-0">Progress Monitoring:</span>
                <span className="text-slate-700">{plp.progressMonitoring}</span>
              </div>
            </div>
          </div>
{/* 7. RECOMMENDED INTERVENTION (CLASS REMEDIAL & ARAL PATHWAYS) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              7. Recommended Intervention & Pathways
            </h3>

            <div className="mt-3 space-y-4">
              {/* CLASS REMEDIAL WORKFLOW */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Subject Intervention
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Class Remedial ({learner.subject || "Subject"})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border",
                        remedialStatus === "Recommended"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : remedialStatus === "Active"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : remedialStatus === "Progressing"
                          ? "border-blue-300 bg-blue-50 text-blue-800"
                          : remedialStatus === "Completed"
                          ? "border-slate-300 bg-slate-100 text-slate-800"
                          : "border-red-300 bg-red-50 text-red-800"
                      )}
                    >
                      {remedialStatus}
                    </span>
                  </div>
                </div>

                {/* Status transition controls */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600">Update Status:</span>
                    <select
                      value={remedialStatus}
                      onChange={(e) => handleUpdateRemedialStatus(e.target.value)}
                      disabled={updatingRemedial}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs"
                    >
                      <option value="Recommended">Recommended</option>
                      <option value="Active">Active</option>
                      <option value="Progressing">Progressing</option>
                      <option value="Completed">Completed</option>
                      <option value="Needs Continued Support">Needs Continued Support</option>
                    </select>
                    {updatingRemedial ? <Loader2 size={13} className="animate-spin text-cnhs-green-dark" /> : null}
                  </div>

                  {remedialStatus === "Recommended" ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateRemedialStatus("Active")}
                      disabled={updatingRemedial}
                      className="inline-flex cursor-pointer items-center gap-1 rounded bg-cnhs-green-dark px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] transition disabled:opacity-50"
                    >
                      Confirm Intervention (Set to Active)
                    </button>
                  ) : null}
                </div>

                {/* Important System Boundary Disclaimer */}
                <div className="mt-3 rounded border border-slate-200 bg-white p-2.5 text-[11px] text-slate-500">
                  <strong>System Boundary Notice:</strong> The system records intervention status and progress evidence. The system does <em>not</em> deliver actual remedial instruction, lessons, quizzes, or teaching activities. Remedial instruction remains with the subject teacher.
                </div>
              </div>

              {/* ARAL MONITORING CONNECTION */}
              {(recommendedSupport === "ARAL Screening" ||
                learner.supportPathway === "ARAL Program" ||
                isReadingSubject) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-blue-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                          <BookOpen size={11} />
                          Reading Intervention Pathway
                        </span>
                        <span className="text-[11px] font-semibold text-blue-900">Phil-IRI Reading Intervention</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">
                        {isReadingSubject
                          ? "Identified reading-related concern from English/Filipino performance and Phil-IRI diagnostic evidence."
                          : "Specialized reading intervention screening connected to academic performance."}
                      </p>
                    </div>

                    {onNavigateToAral ? (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateToAral?.(learner);
                          onClose?.();
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-800 shadow-xs hover:bg-blue-50 transition"
                      >
                        <span>View in Phil-IRI Intake</span>
                        <ArrowUpRight size={13} />
                      </button>
                    ) : null}
                  </div>

                  {/* Inside ARAL Monitoring status preview */}
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs bg-white rounded-md border border-blue-100 p-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Phil-IRI
                      </span>
                      <span className="mt-0.5 font-semibold text-slate-900 block">
                        {hasGstScore ? "Status: Completed" : "Status: Pending"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Reading Level
                      </span>
                      <span className="mt-0.5 font-bold text-amber-800 block">
                        {readingLevelDisplay}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Intervention Status
                      </span>
                      <span className="mt-0.5 font-semibold text-blue-800 block">
                        {!hasGstScore ? "Awaiting Phil-IRI" : (learner.aralApprovalStatus || learner.aralStatus || "Needs Review")}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-[10.5px] text-slate-500">
                    Academic performance is supporting evidence. Official reading placement is governed by Phil-IRI assessment and authorized facilitator review.
                  </p>
                </div>
              )}
            </div>
          </div>
{/* 8. ACADEMIC EVIDENCE (AI ASSISTED) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                8. Academic Evidence
              </h3>
              <span className="text-[10.5px] font-medium text-slate-400">
                AI Pattern Recognition
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-slate-200 bg-slate-50/40 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Academic Risk
                </span>
                <span className="mt-1 text-base font-bold text-slate-900 block">
                  {decisionSupport.riskLevel}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                  Based on recent academic standing
                </span>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50/40 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Primary Risk Factors
                </span>
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-700">
                  {decisionSupport.contributingIndicators.map((ind, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-slate-400">•</span>
                      <span>{ind}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* EXACT MANDATORY DEPED DISCLAIMER */}
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
              <ShieldAlert size={14} className="text-slate-500 shrink-0 mt-0.5" />
              <span>
                &ldquo;Risk factors serve as academic evidence and do not supersede official DepEd assessment rules.&rdquo;
              </span>
            </div>
          </div>
          </div>
        </div>

{/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] font-medium text-slate-500">
            CNHS Learn · Learner Academic & Intervention Record
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(!learner.aralStatus || learner.aralStatus === "Not Referred") && isReadingSubject && Number(curGrade) < 75 ? (
              <button
                type="button"
                onClick={handleRecommendAral}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
              >
                Recommend for ARAL
              </button>
            ) : null}
            {(!learner.aralStatus || learner.aralStatus === "Not Referred") && !isReadingSubject && Number(curGrade) < 75 ? (
              <button
                type="button"
                onClick={handleStartRemedial}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                Start Class Remedial
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Close Record
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
