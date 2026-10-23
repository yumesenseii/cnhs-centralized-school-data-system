"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  RotateCcw,
  ShieldCheck,
  FileText,
  Edit3,
  Layers,
  ChevronRight,
  Plus,
  Trash2,
  Download,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportPlpPdf } from "@/lib/reports/plpReportExport";
import { termLabel } from "@/lib/academic/termLabels";
import {
  generateDraftPlp,
  PLP_PLAN_TYPE,
  PLP_STATUS,
  isPlpProtected,
} from "@/lib/monitoring/plpGenerator";

export default function PlpDocumentModal({
  isOpen = false,
  onClose,
  learner = null,
  academicContext = null,
  readingContext = null,
  schoolYear = "2026-2027",
  existingPlp = null,
}) {
  const [plp, setPlp] = useState(null);
  const [generatorError, setGeneratorError] = useState(null);
  const [isEdited, setIsEdited] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Initialize or re-generate draft when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (existingPlp) {
      setPlp(JSON.parse(JSON.stringify(existingPlp)));
      setIsEdited(Boolean(existingPlp.is_teacher_edited));
      setGeneratorError(null);
      return;
    }

    try {
      const studentId =
        learner?.studentId ||
        learner?.student_id ||
        learner?.id ||
        "preview-student";
      const studentName =
        learner?.studentName ||
        learner?.name ||
        learner?.student_name ||
        "Learner Preview";
      const gradeLevel =
        learner?.gradeLevel ||
        learner?.grade ||
        learner?.grade_level ||
        7;

      const result = generateDraftPlp({
        student: {
          id: studentId,
          name: studentName,
          gradeLevel,
          sectionId: learner?.sectionId || learner?.section_id || null,
        },
        schoolYear: schoolYear || "2026-2027",
        academicContext,
        readingContext,
      });

      if (result.success && result.plan) {
        setPlp(result.plan);
        setIsEdited(false);
        setGeneratorError(null);
      } else {
        setGeneratorError(result.message || "Unable to generate draft PLP.");
      }
    } catch (err) {
      console.error("PLP generation error:", err);
      setGeneratorError(err.message || "Failed to generate PLP draft.");
    }
  }, [isOpen, learner, academicContext, readingContext, schoolYear, existingPlp]);

  if (!isOpen) return null;

  const learnerName =
    learner?.studentName ||
    learner?.name ||
    learner?.student_name ||
    "Learner Preview";
  const sectionLabel =
    learner?.sectionLabel ||
    learner?.section ||
    learner?.section_name ||
    "Section Preview";

  // In-memory edit handlers (temporary component-state only)
  function handleResetDraft() {
    try {
      const studentId =
        learner?.studentId ||
        learner?.student_id ||
        learner?.id ||
        "preview-student";
      const studentName =
        learner?.studentName ||
        learner?.name ||
        learner?.student_name ||
        "Learner Preview";
      const gradeLevel =
        learner?.gradeLevel ||
        learner?.grade ||
        learner?.grade_level ||
        7;

      const result = generateDraftPlp({
        student: { id: studentId, name: studentName, gradeLevel },
        schoolYear: schoolYear || "2026-2027",
        academicContext,
        readingContext,
      });

      if (result.success && result.plan) {
        setPlp(result.plan);
        setIsEdited(false);
      }
    } catch (err) {
      console.error("Reset draft error:", err);
    }
  }

  function handleExportPdf() {
    if (!plp) return;
    exportPlpPdf({
      plp,
      learner,
      teacherName: academicContext?.teacherName || "Class Adviser / Teacher",
      schoolHeadName: null,
    });
  }

  function handleUpdateNotes(newNotes) {
    if (!plp) return;
    setPlp((prev) => ({
      ...prev,
      teacher_notes: newNotes,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  function handleUpdateObjective(index, field, value) {
    if (!plp) return;
    const next = [...(plp.target_objectives || [])];
    if (next[index]) {
      next[index] = { ...next[index], [field]: value };
      setPlp((prev) => ({
        ...prev,
        target_objectives: next,
        is_teacher_edited: true,
      }));
      setIsEdited(true);
    }
  }

  function handleAddObjective() {
    if (!plp) return;
    const next = [
      ...(plp.target_objectives || []),
      {
        target: "New tailored learning objective...",
        competencyFocus: "Specific skill or standard focus",
      },
    ];
    setPlp((prev) => ({
      ...prev,
      target_objectives: next,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  function handleDeleteObjective(index) {
    if (!plp) return;
    const next = (plp.target_objectives || []).filter((_, i) => i !== index);
    setPlp((prev) => ({
      ...prev,
      target_objectives: next,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  function handleUpdateActivity(index, field, value) {
    if (!plp) return;
    const next = [...(plp.recommended_activities || [])];
    if (next[index]) {
      next[index] = { ...next[index], [field]: value };
      setPlp((prev) => ({
        ...prev,
        recommended_activities: next,
        is_teacher_edited: true,
      }));
      setIsEdited(true);
    }
  }

  function handleAddActivity() {
    if (!plp) return;
    const next = [
      ...(plp.recommended_activities || []),
      {
        type: "Teacher-Guided Support",
        title: "Tailored Support Activity",
        description: "Specify instructional activities and weekly schedule.",
      },
    ];
    setPlp((prev) => ({
      ...prev,
      recommended_activities: next,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  function handleDeleteActivity(index) {
    if (!plp) return;
    const next = (plp.recommended_activities || []).filter((_, i) => i !== index);
    setPlp((prev) => ({
      ...prev,
      recommended_activities: next,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  function handleUpdateIndicator(index, field, value) {
    if (!plp) return;
    const next = [...(plp.monitoring_indicators || [])];
    if (next[index]) {
      next[index] = { ...next[index], [field]: value };
      setPlp((prev) => ({
        ...prev,
        monitoring_indicators: next,
        is_teacher_edited: true,
      }));
      setIsEdited(true);
    }
  }

  function handleAddIndicator() {
    if (!plp) return;
    const next = [
      ...(plp.monitoring_indicators || []),
      {
        metric: "Weekly Assessment",
        frequency: "Weekly",
        target: "Targeted performance benchmark",
      },
    ];
    setPlp((prev) => ({
      ...prev,
      monitoring_indicators: next,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  function handleDeleteIndicator(index) {
    if (!plp) return;
    const next = (plp.monitoring_indicators || []).filter((_, i) => i !== index);
    setPlp((prev) => ({
      ...prev,
      monitoring_indicators: next,
      is_teacher_edited: true,
    }));
    setIsEdited(true);
  }

  // Format plan type label & badge
  const planTypeMeta = useMemo(() => {
    switch (plp?.plan_type) {
      case PLP_PLAN_TYPE.COMPOSITE:
        return {
          label: "Composite Plan (Academic & Reading)",
          badgeClass: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800/40",
          desc: "Dual-track intervention covering classroom academic subjects and Phil-IRI reading development.",
        };
      case PLP_PLAN_TYPE.READING_ARAL:
        return {
          label: "Reading ARAL Plan",
          badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40",
          desc: "Targeted literacy intervention based on Phil-IRI screening and verified Form 3 reading profile.",
        };
      case PLP_PLAN_TYPE.ACADEMIC_REMEDIAL:
      default:
        return {
          label: "Academic Remedial Plan",
          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40",
          desc: "Classroom remedial and targeted reinforcement based on verified quarterly grades.",
        };
    }
  }, [plp?.plan_type]);

  const riskBadgeClass = useMemo(() => {
    const risk = plp?.overall_risk_level || "Low Risk";
    if (risk === "High Risk") {
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/40";
    }
    if (risk === "Moderate Risk") {
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40";
    }
    if (risk.includes("Pending")) {
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40";
    }
    return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
  }, [plp?.overall_risk_level]);

  // Evidence Period (when the grade was recorded) vs Target Term (plan.academic_term).
  // Neither is defaulted to Term 1; Final Grade is evidence only.
  const evidencePeriodText = plp?.academic_evidence?.evidence_period_label ?? null;
  const targetTermText =
    plp?.academic_term != null ? termLabel(plp.academic_term) : "Not specified";

  // Plain language explanation of why the learner needs support
  const plainReason = useMemo(() => {
    const acadGrade = academicContext?.subjectGrade != null ? Number(academicContext.subjectGrade) : null;
    const subj = academicContext?.subjectName || "Subject";
    const evidenceText = plp?.academic_evidence?.evidence_period_label ?? null;
    const evidenceSuffix = evidenceText ? `, ${evidenceText}` : "";

    if (plp?.plan_type === PLP_PLAN_TYPE.COMPOSITE) {
      return `The learner has an academic deficiency in ${subj} (Grade: ${acadGrade ?? "not recorded"}${evidenceSuffix}) alongside reading support needs identified in Phil-IRI (${readingContext?.form3ReadingProfile || "diagnostic required"}). Both classroom remedial and reading intervention are recommended.`;
    }

    if (plp?.plan_type === PLP_PLAN_TYPE.READING_ARAL) {
      if (readingContext?.form3ReadingProfile) {
        return `Phil-IRI individual reading assessment indicates ${readingContext.form3ReadingProfile} reading level in ${readingContext.language || "English"}. Structured reading support under ARAL is recommended.`;
      }
      return `Phil-IRI screening test indicates that individual reading assessment (Form 3) is required to determine exact reading support needs.`;
    }

    // Academic Remedial
    if (acadGrade !== null && acadGrade < 75) {
      return `The learner has a recorded grade of ${acadGrade} in ${subj}${evidenceText ? ` (${evidenceText})` : ""}, which is below the passing mark of 75. Classroom remedial support is recommended.`;
    }

    if (academicContext?.isProvisional) {
      return `Academic evaluation for ${subj} is provisional pending full-term grade completion. Classroom monitoring is recommended.`;
    }

    if (acadGrade === null || !Number.isFinite(acadGrade)) {
      return `No recorded grade is available for ${subj} yet. Academic objectives will be set once grade evidence is recorded.`;
    }

    return `Learner is performing within standard expectations in ${subj}. Standard instructional monitoring applies.`;
  }, [plp, academicContext, readingContext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plp-document-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="relative z-10 flex max-h-[90vh] w-[min(880px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
        
        {/* 1. TEACHER-FRIENDLY PREVIEW NOTICE */}
        <div className="shrink-0 border-b border-amber-200 bg-amber-50/90 px-5 py-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200 sm:px-6">
          <div className="flex items-center gap-2">
            <Info size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="font-medium">
              This plan is a preview and has not been saved. Changes will be lost when you close it.
            </p>
          </div>
        </div>

        {/* 2. SIMPLE LEARNER HEADER */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                Personalized Learning Plan (PLP)
              </span>
              <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
                Draft Preview
              </span>
              {isEdited ? (
                <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  Teacher Customized
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2
                id="plp-document-modal-title"
                className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl"
              >
                {learnerName}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
                  planTypeMeta.badgeClass
                )}
              >
                {planTypeMeta.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
                  riskBadgeClass
                )}
              >
                {plp?.overall_risk_level || "Standard Risk"}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {sectionLabel} · School Year {schoolYear} · Version {plp?.version ?? 1}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-5 dark:bg-black/10 sm:p-6 space-y-4">
          
          {generatorError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <p className="font-semibold">Generation Error</p>
              <p className="mt-1">{generatorError}</p>
            </div>
          ) : !plp ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Loading PLP draft details…
            </div>
          ) : (
            <>
              {/* 1. REASON FOR SUPPORT */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                      Reason for Support
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {plainReason}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. PERFORMANCE SUMMARY CARD */}
              {plp.plan_type === PLP_PLAN_TYPE.ACADEMIC_REMEDIAL ? (
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <GraduationCap size={14} className="text-cnhs-green-dark" />
                      <span>Academic Standing · {academicContext?.subjectName || "Subject"}</span>
                    </div>
                    <span className="text-[10.5px] font-semibold text-slate-500">
                      {evidencePeriodText ?? "Grading period not recorded"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Recorded Grade</span>
                      <span
                        className={cn(
                          "font-bold text-sm block mt-0.5",
                          academicContext?.subjectGrade != null && Number(academicContext.subjectGrade) < 75
                            ? "text-amber-800 dark:text-amber-400"
                            : "text-slate-900 dark:text-slate-100"
                        )}
                      >
                        {academicContext?.subjectGrade != null ? `${academicContext.subjectGrade} / 100` : "—"}
                        {academicContext?.subjectGrade != null && Number(academicContext.subjectGrade) < 75 ? (
                          <span className="ml-1 text-[10px] font-normal text-amber-700">(Below 75)</span>
                        ) : null}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Passing Standard</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                        75 / 100
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Target Term</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm block mt-0.5">
                        {targetTermText}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Prescribed Support</span>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs block mt-1 truncate">
                        {plp?.recommended_support_level?.split("&")[0]?.trim() || "Classroom Remedial"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Dual / Reading Summary for Composite or Reading-only plans */
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <GraduationCap size={14} className="text-cnhs-green-dark" />
                        <span>Academic Standing</span>
                      </div>
                      <span className="text-[10.5px] font-semibold text-slate-500">
                        {evidencePeriodText ?? "No academic record"}
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Subject:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {academicContext?.subjectName || "Subject"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Recorded Grade:</span>
                        <span className="font-bold text-amber-800 dark:text-amber-400">
                          {academicContext?.subjectGrade != null ? `${academicContext.subjectGrade} / 100` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <BookOpen size={14} className="text-blue-600 dark:text-blue-400" />
                        <span>Reading Assessment (Phil-IRI)</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        {readingContext?.language || "English"}
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Screening (GST):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {readingContext?.gstScore != null ? `${readingContext.gstScore} / 40` : "Not recorded"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Form 3 Profile:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {readingContext?.form3ReadingProfile || "Pending Assessment"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. UNIFIED 1-PAGE DOCUMENT CONTENT (ZERO TABS) */}
              <div className="space-y-4">
                
                {/* SECTION A: TARGET LEARNING GOAL & OBJECTIVES */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <Target size={14} className="text-cnhs-green-dark" />
                      <span>Target Learning Goal &amp; Objective</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddObjective}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Goal</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {plp.target_objectives?.length ? (
                      plp.target_objectives.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-white/5 dark:bg-white/[0.02] flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[10px]">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                value={item.target || ""}
                                onChange={(e) => handleUpdateObjective(idx, "target", e.target.value)}
                                placeholder="Target objective..."
                                className="w-full font-semibold text-slate-800 bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 px-1.5 py-0.5 rounded border border-transparent focus:border-slate-300 dark:text-slate-100"
                              />
                            </div>
                            {item.competencyFocus ? (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                                <strong className="font-semibold text-slate-600 dark:text-slate-300">Competency Focus: </strong>
                                {item.competencyFocus}
                              </p>
                            ) : null}
                          </div>
                          {plp.target_objectives.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteObjective(idx)}
                              className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer shrink-0"
                              title="Remove goal"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No specific objectives set.</p>
                    )}
                  </div>
                </div>

                {/* SECTION B: SUGGESTED CLASSROOM REMEDIAL ACTIVITIES */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <BookOpen size={14} className="text-blue-600" />
                      <span>Suggested Remedial Activities ({plp.recommended_activities?.length ?? 0})</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddActivity}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Activity</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {plp.recommended_activities?.length ? (
                      plp.recommended_activities.map((act, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-white/5 dark:bg-white/[0.02] flex items-start justify-between gap-3"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                {act.title || act.type}
                              </span>
                              {act.type ? (
                                <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                  {act.type}
                                </span>
                              ) : null}
                            </div>
                            <textarea
                              rows={2}
                              value={act.description || ""}
                              onChange={(e) => handleUpdateActivity(idx, "description", e.target.value)}
                              className="w-full text-xs text-slate-600 dark:text-slate-300 bg-transparent outline-none focus:bg-white dark:focus:bg-slate-900 px-1.5 py-1 rounded border border-transparent focus:border-slate-300 resize-none"
                            />
                          </div>
                          {plp.recommended_activities.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(idx)}
                              className="text-slate-400 hover:text-red-600 transition p-1 cursor-pointer shrink-0"
                              title="Remove activity"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic">No activities planned.</p>
                    )}
                  </div>
                </div>

                {/* SECTION C: PROGRESS MONITORING & INDICATORS */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-white/5">
                    <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Progress Monitoring &amp; Indicators</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddIndicator}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>Add Check-in</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {plp.monitoring_indicators?.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs dark:border-white/5 dark:bg-white/[0.02] space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            {item.metric}
                          </span>
                          <span className="rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[10px] px-1.5 py-0.5">
                            {item.frequency}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {item.target}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION D: TEACHER NOTES & OBSERVATIONS */}
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Teacher Notes (Optional)
                    </span>
                    <span className="text-[10px] text-slate-400">In-memory preview</span>
                  </div>
                  <textarea
                    rows={3}
                    value={plp.teacher_notes || ""}
                    onChange={(e) => handleUpdateNotes(e.target.value)}
                    placeholder="Add specific observations, remedial notes, or parent communication logs..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100 resize-none"
                  />
                </div>

              </div>

              {/* 6. EXPANDABLE TECHNICAL DETAILS ACCORDION */}
              <div className="pt-2">
                <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white dark:border-white/5 dark:bg-[var(--card)]">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center justify-between p-3 text-left text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-slate-400" />
                      <span>Technical Diagnostics &amp; Reference</span>
                    </div>
                    {showTechnicalDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {showTechnicalDetails ? (
                    <div className="border-t border-slate-100 p-3.5 text-xs dark:border-white/5 space-y-2 bg-slate-50/50 dark:bg-white/[0.01]">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">Plan Type Contract:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{plp.plan_type}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Target Term (academic_term):</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {plp.plan_type === PLP_PLAN_TYPE.READING_ARAL
                              ? "N/A (Reading Only)"
                              : plp.academic_term ?? "Not specified"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Evidence Period:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                            {plp.academic_evidence?.evidence_period_label ?? "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Reading Period:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{plp.reading_period ?? "N/A (Academic Only)"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Class ID / Context:</span>
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{plp.class_id ?? "None"}</span>
                        </div>
                      </div>
                      <p className="text-[10.5px] text-slate-400 italic pt-1">
                        Formulated strictly under DepEd Learning Recovery / Remediation Guidelines &amp; RA 12028 (ARAL Program Act).
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 7. CLEAN TEACHER FOOTER */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 dark:border-white/5 dark:bg-black/20 sm:px-6">
          <div className="flex items-center gap-2">
            {isEdited ? (
              <button
                type="button"
                onClick={handleResetDraft}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <RotateCcw size={13} />
                <span>Reset to Generated Draft</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                Unsaved Draft Preview
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={!plp}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#1a533f] transition-colors"
            >
              <Download size={13} />
              <span>Export PLP (PDF)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
