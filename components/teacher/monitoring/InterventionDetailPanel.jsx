"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, X, Check } from "lucide-react";
import ConfirmModal from "@/components/shared/ConfirmModal";
import {
  Pill,
  RiskPill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import {
  ARAL_SESSION_LABELS,
  resolveStoredWeekNumber,
  stripAralWeekPrefix,
} from "@/lib/monitoring/aralProgress";
import { ARAL_APPROVAL_STATUS } from "@/lib/monitoring/aralApproval";
import {
  INTERVENTION_STATUS,
  INTERVENTION_STATUS_OPTIONS,
  NEXT_ACTION_OPTIONS,
  PROGRESS_EVALUATION_OPTIONS,
  buildRecordedProgress,
  displayInterventionStatus,
  formatImprovement,
  interventionTypeLabel,
  learnerDisplayName,
} from "@/lib/monitoring/interventionLifecycle";
import { aralAssessmentPhaseLabel } from "@/lib/monitoring/aralAssessments";
import { listAralAssessmentScoresForStudent } from "@/lib/supabase/queries/aralProgram";
import {
  createMonitoringRecord,
  listMonitoringRecordsForStudents,
  updateMonitoringRecord,
} from "@/lib/supabase/queries/monitoring";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";
import { useAppToast } from "@/components/shared/AppToast";

export default function InterventionDetailPanel({
  learner,
  canWrite = false,
  teacherId = null,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();
  const [records, setRecords] = useState([]);
  const [scores, setScores] = useState([]);

  const refresh = useCallback(async () => {
    if (!learner?.studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const classIds = learner.sourceClassId
      ? [learner.sourceClassId]
      : learner.classId
        ? [learner.classId]
        : [];
    const [recResult, scoreResult] = await Promise.all([
      listMonitoringRecordsForStudents({
        studentIds: [learner.studentId],
        classIds,
      }),
      listAralAssessmentScoresForStudent(learner.studentId),
    ]);
    if (recResult.error) setError(recResult.error.message);
    const rows = [...(recResult.data ?? [])].sort((a, b) => {
      const da = String(a.observation_date || a.created_at || "");
      const db = String(b.observation_date || b.created_at || "");
      return db.localeCompare(da);
    });
    setRecords(rows);
    setScores(scoreResult.data ?? []);
    setLoading(false);
  }, [learner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const progress = useMemo(() => buildRecordedProgress(scores), [scores]);
  const type = interventionTypeLabel(learner);
  const name = learnerDisplayName(learner);
  
  const begScore = progress.checks?.find((c) => c.phase === "BOSY")?.percent;
  const midScore = progress.checks?.find((c) => c.phase === "MOSY")?.percent;
  const endScore = progress.checks?.find((c) => c.phase === "EOSY")?.percent;

  const currentStatus = displayInterventionStatus(learner.monitoringStatus);
  const hasIntervention = type !== "No Intervention" && type !== "General Classroom Observation";

  // Determine workflow steps
  const workflowStages = [
    { label: "Identified", active: true },
    { label: "Assessment", active: Boolean(learner.assessmentType || learner.readingLevel) },
    { label: "Teacher Endorsement", active: Boolean(learner.monitoringStatus && learner.monitoringStatus !== "Not Started") },
    { label: "Principal Review", active: Boolean(learner.aralApprovalStatus === "Approved") },
    { label: "Assigned", active: Boolean(learner.aralFacilitatorName) },
    { label: "Monitoring", active: currentStatus === "Ongoing" },
    { label: "Completed", active: currentStatus === "Completed" },
  ];

  if (!learner) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 lg:p-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 shadow-2xl">
        
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">{name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <p>Grade {learner.grade} · {learner.section}</p>
              <p>LRN: {learner.studentNumber || "—"}</p>
              <RiskPill value={learner.riskLevel} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : (
            <>
              {/* SECTION 1: Academic Performance */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Academic Performance</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Learning Area</p>
                    <p className="text-sm font-medium text-slate-900">{learner.subject || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Current Grade</p>
                    <p className="text-sm font-medium text-slate-900">{learner.classSubjectGrade || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Academic Risk</p>
                    <RiskPill value={learner.riskLevel} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Area Needing Attention</p>
                    <p className="text-sm font-medium text-slate-900">{learner.weakSubject || learner.subject || "—"}</p>
                  </div>
                </div>
              </section>

              {/* SECTION 2: Assessment Progress */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Assessment Progress</h3>
                {progress.checkCount > 0 ? (
                  <div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">BEG</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{begScore != null ? begScore : <span className="text-sm font-normal text-slate-400">Not yet assessed</span>}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">MID</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{midScore != null ? midScore : <span className="text-sm font-normal text-slate-400">Not yet assessed</span>}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
                        <p className="text-xs font-semibold text-slate-500">END</p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">{endScore != null ? endScore : <span className="text-sm font-normal text-slate-400">Not yet assessed</span>}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50/50 rounded-lg p-4 border border-emerald-100/50">
                      <div className="flex items-center gap-4 text-sm font-semibold text-slate-700 w-full sm:w-auto">
                        <span className={begScore != null ? "text-emerald-700" : "text-slate-400"}>BEG</span>
                        <div className="h-px flex-1 sm:w-16 bg-slate-300" />
                        <span className={midScore != null ? "text-emerald-700" : "text-slate-400"}>MID</span>
                        <div className="h-px flex-1 sm:w-16 bg-slate-300" />
                        <span className={endScore != null ? "text-emerald-700" : "text-slate-400"}>END</span>
                      </div>
                      
                      {progress.improvement != null && (
                        <div className="mt-3 sm:mt-0 text-right">
                          <p className="text-xs text-slate-500 font-medium">Progress</p>
                          <p className="text-lg font-bold text-emerald-700">
                            {progress.improvement > 0 ? "+" : ""}{progress.improvement} points
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No assessment results available.</p>
                )}
              </section>

              {/* SECTION 3: Academic Risk Progression */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Academic Risk Progression</h3>
                <div className="flex flex-col sm:flex-row gap-6">
                  {learner.officialRiskLevel && learner.officialRiskLevel !== learner.riskLevel ? (
                    <>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Beginning</p>
                        <RiskPill value={learner.officialRiskLevel} />
                      </div>
                      <div className="hidden sm:flex items-center text-slate-300">
                        →
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current</p>
                        <RiskPill value={learner.riskLevel} />
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current</p>
                      <RiskPill value={learner.riskLevel} />
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 4 & 5: Intervention Context */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Intervention Details */}
                <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Intervention</h3>
                  {hasIntervention ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Intervention Type</p>
                        <p className="text-sm font-medium text-slate-900">{type}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Pathway / Tier</p>
                        <p className="text-sm font-medium text-slate-900">{learner.aralPlacementTier ? `Tier ${learner.aralPlacementTier}` : "Standard Pathway"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Status</p>
                        <Pill
                          value={currentStatus}
                          styles={{
                            "Not Started": "bg-amber-50 text-amber-700",
                            "Ongoing": "bg-emerald-50 text-emerald-700",
                            "Completed": "bg-blue-50 text-blue-700",
                            "Needs Further Support": "bg-red-50 text-red-700",
                            "For Further Monitoring": "bg-purple-50 text-purple-700",
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Teacher / Tutor</p>
                        <p className="text-sm font-medium text-slate-900">{learner.aralFacilitatorName || "Classroom Teacher"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Start Date</p>
                        <p className="text-sm font-medium text-slate-900">{learner.created_at ? new Date(learner.created_at).toLocaleDateString() : "—"}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No intervention assigned.</p>
                  )}
                </section>

                {/* Intervention Progress (Workflow) */}
                <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Intervention Progress</h3>
                  {hasIntervention ? (
                    <div className="space-y-3">
                      {workflowStages.map((stage, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center w-5 h-5 rounded-full border text-[10px]",
                            stage.active ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 border-slate-200 text-transparent"
                          )}>
                            <Check size={12} />
                          </div>
                          <span className={cn(
                            "text-sm",
                            stage.active ? "font-medium text-slate-900" : "text-slate-400"
                          )}>
                            {stage.label}
                          </span>
                          {stage.active && stage.label === "Monitoring" && currentStatus === "Ongoing" && (
                            <span className="ml-auto text-xs font-bold text-emerald-600">Current</span>
                          )}
                          {!stage.active && stage.label === "Completed" && (
                            <span className="ml-auto text-xs text-slate-400">Pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Not applicable.</p>
                  )}
                </section>
              </div>

              {/* SECTION 6: Recommended Action */}
              <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
                <h3 className="text-sm font-bold text-blue-900 mb-2">Recommended Action</h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {learner.weakSubject
                    ? `Continue classroom monitoring for ${learner.weakSubject}. Ensure assessment progress is checked at the next interval.`
                    : "Monitor the learner's next assessment results and provide necessary subject support."}
                </p>
              </section>

            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
