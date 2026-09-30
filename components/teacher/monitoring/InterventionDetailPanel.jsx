"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
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

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * Compose existing roster + monitoring_records + ARAL scores.
 * Teacher write: evaluation / status only. HT: view.
 */
export default function InterventionDetailPanel({
  learner,
  canWrite = false,
  teacherId = null,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();
  const [records, setRecords] = useState([]);
  const [scores, setScores] = useState([]);
  const [evalForm, setEvalForm] = useState({
    progressEvaluation: "",
    nextAction: "",
    remarks: "",
    status: INTERVENTION_STATUS.ONGOING,
  });
  const [pendingStatus, setPendingStatus] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");

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
    const evalRow = rows.find((row) => row.week_number == null);
    const statusRow = evalRow || rows[0];
    setEvalForm({
      progressEvaluation:
        evalRow?.progress_evaluation || statusRow?.progress_evaluation || "",
      nextAction: evalRow?.next_action || statusRow?.next_action || "",
      remarks: evalRow?.teacher_remarks || "",
      status: displayInterventionStatus(
        statusRow?.monitoring_status || learner.monitoringStatus
      ),
    });
    setLoading(false);
  }, [learner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const progress = useMemo(() => buildRecordedProgress(scores), [scores]);
  const type = interventionTypeLabel(learner);
  const name = learnerDisplayName(learner);
  const evalRecord = useMemo(
    () => records.find((row) => row.week_number == null) || records[0] || null,
    [records]
  );

  async function persistEvaluation(nextStatus) {
    const classId = learner.classId || learner.sourceClassId;
    if (!canWrite || !teacherId || !learner?.studentId || !classId) {
      setError("Sign in as the assigned teacher to save evaluation.");
      return;
    }
    setSaving(true);
    setError("");
    const statusFields = {
      progress_evaluation: evalForm.progressEvaluation || null,
      next_action: evalForm.nextAction || null,
      monitoring_status: nextStatus,
      evaluated_by: teacherId,
      evaluated_at: new Date().toISOString(),
      follow_up_needed:
        nextStatus === INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT ||
        nextStatus === INTERVENTION_STATUS.FOR_FURTHER_MONITORING,
    };
    const remarksFields = {
      ...statusFields,
      teacher_remarks: evalForm.remarks,
    };
    const weeklyRow = records.find((row) => row.week_number != null);
    const evalRow = records.find((row) => row.week_number == null);
    const evalPayload = {
      student_id: learner.studentId,
      class_id: classId,
      teacher_id: teacherId,
      observation_date: new Date().toISOString().slice(0, 10),
      school_year: learner.schoolYear,
      quarter: Number(learner.quarterNumber) || 4,
      ...remarksFields,
    };

    let result;
    if (weeklyRow && !evalRow) {
      result = await updateMonitoringRecord(weeklyRow.id, statusFields);
      if (!result.error) {
        result = await createMonitoringRecord(evalPayload);
      }
    } else if (evalRow) {
      result = await updateMonitoringRecord(evalRow.id, remarksFields);
      if (!result.error && weeklyRow) {
        const weeklyResult = await updateMonitoringRecord(
          weeklyRow.id,
          statusFields
        );
        if (weeklyResult.error) result = weeklyResult;
      }
    } else {
      result = await createMonitoringRecord(evalPayload);
    }
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    showToast("Saved teacher evaluation and status.");
    await refresh();
    onSaved?.();
  }

  function requestStatusSave() {
    const next = evalForm.status;
    if (
      next === INTERVENTION_STATUS.COMPLETED ||
      next === INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT ||
      next === INTERVENTION_STATUS.FOR_FURTHER_MONITORING
    ) {
      setPendingStatus(next);
      return;
    }
    persistEvaluation(next);
  }

  if (!learner) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative z-10 flex max-h-[86vh] w-[min(920px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
              Intervention Record
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">{name}</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              LRN: {learner.studentNumber || "—"} · {learner.gradeSection || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-100 bg-slate-50/50 px-5 py-2">
          {[
            { id: "overview", label: "Overview & Risk" },
            { id: "progress", label: "Assessments & Progress" },
            { id: "evaluation", label: "Teacher Evaluation" },
          ].map((tab) => {
            const active = detailTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDetailTab(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-white text-cnhs-green-dark shadow-xs ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading intervention record…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <RiskPill value={learner.riskLevel} />
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold",
                    pathwayStyles[type] ?? "bg-slate-100 text-slate-700"
                  )}
                >
                  {type}
                </span>
                {learner.aralPlacementTier ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[10px]",
                      tierStyles[learner.aralPlacementTier] ?? "bg-indigo-50 text-indigo-700"
                    )}
                  >
                    ARAL Tier: {learner.aralPlacementTier}
                  </span>
                ) : null}
                {learner.readingLevel && learner.readingLevel !== "N/A" ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[10px]",
                      readingLevelStyles[learner.readingLevel] ?? "bg-slate-100 text-slate-600"
                    )}
                  >
                    Phil-IRI: {learner.readingLevel}
                  </span>
                ) : null}
                <Pill
                  value={displayInterventionStatus(learner.monitoringStatus)}
                  styles={monitoringStatusStyles}
                />
              </div>

              {/* Tab 1: Overview & Risk */}
              {detailTab === "overview" ? (
                <div className="space-y-3">
                  <Section title="A. Learner Information">
                    <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                      <p><span className="text-slate-400">Name:</span><br /><span className="font-semibold text-slate-800">{name}</span></p>
                      <p><span className="text-slate-400">Grade Level:</span><br /><span className="font-medium text-slate-700">{learner.grade || "—"}</span></p>
                      <p><span className="text-slate-400">Section:</span><br /><span className="font-medium text-slate-700">{learner.section || "—"}</span></p>
                      <p><span className="text-slate-400">Student LRN:</span><br /><span className="font-medium text-slate-700">{learner.studentNumber || "—"}</span></p>
                    </div>
                  </Section>

                  <Section title="B. Academic Performance & Risk Insight">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          1. Official Academic Risk (ECR)
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <RiskPill value={learner.officialRiskLevel || learner.riskLevel} />
                          <span className="text-[12px] font-medium text-slate-700">
                            {learner.subject}: <span className="font-semibold text-slate-900">{learner.classSubjectGrade ?? "—"}</span>
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Based on CNHS official grading criteria &amp; ECR records.
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          2. RF Academic Pattern Analysis
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                            Predicted: {learner.rfPredictedRisk || learner.riskLevel || "Low Risk"}
                          </span>
                          {learner.recommendationConfidence ? (
                            <span className="text-[11px] font-medium text-slate-600">
                              ({Math.round(learner.recommendationConfidence * 100)}% confidence)
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {learner.weakSubject
                            ? `Weak learning area: ${learner.weakSubject}`
                            : "Analytical decision-support from subject patterns."}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          3. Assessment &amp; Context
                        </span>
                        <p className="mt-1 text-[12px] font-medium text-slate-800">
                          {learner.readingLevel && learner.readingLevel !== "N/A"
                            ? `Phil-IRI / CRLA: ${learner.readingLevel}`
                            : "Diagnostic assessment pending or classroom-evaluated."}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Requires teacher evaluation before ARAL placement.
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-100 bg-white p-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          4. Intervention Pathway
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold",
                              pathwayStyles[type] ?? "bg-slate-100 text-slate-700"
                            )}
                          >
                            {type}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {type.includes("ARAL")
                            ? "Reading intervention (English/Filipino) with Principal approval."
                            : "Subject-specific teacher-led classroom support."}
                        </p>
                      </div>
                    </div>
                  </Section>

                  <Section title="C. Longitudinal History Overview">
                    <p className="text-[11px] text-slate-500">
                      {records.length} intervention session log(s) recorded for this period. Progress is tracked continuously across terms.
                    </p>
                  </Section>
                </div>
              ) : null}

              {/* Tab 2: Assessments & Progress */}
              {detailTab === "progress" ? (
                <div className="space-y-3">
                  <Section title="A. Diagnostic Assessment Profile & Placement">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[12px]">
                      <div className="rounded-lg border border-slate-100 bg-white p-2">
                        <span className="text-[10px] uppercase text-slate-400">Assessment Type</span>
                        <p className="mt-0.5 font-medium text-slate-800">
                          {learner.assessmentType || (type.includes("ARAL") ? "Phil-IRI BOSY Reading Assessment" : "Classroom Diagnostic Assessment")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-white p-2">
                        <span className="text-[10px] uppercase text-slate-400">Reading Level / Baseline</span>
                        <p className="mt-0.5 font-medium text-slate-800">
                          {learner.readingLevel || (type.includes("ARAL") ? "Frustration (Priority Target)" : "Subject Deficiency")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-100 bg-white p-2">
                        <span className="text-[10px] uppercase text-slate-400">Intervention Pathway</span>
                        <p className="mt-0.5 font-semibold text-slate-800">
                          {type} {learner.aralPlacementTier ? `(${learner.aralPlacementTier} Tier)` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-600">Principal Review:</span>{" "}
                      {learner.aralApprovalStatus || "Pending Review"} · Assigned Tutor / Teacher:{" "}
                      <span className="font-medium text-slate-700">{learner.aralFacilitatorName || "Classroom Teacher"}</span>
                    </div>
                  </Section>

                  <Section title="B. Beginning, Middle & End Assessment Tracking">
                    {progress.checkCount ? (
                      <>
                        <div className="space-y-2">
                          {progress.checks.map((check) => (
                            <div key={check.phase} className="flex items-center gap-2">
                              <span className="w-28 text-[11px] font-medium text-slate-600">
                                {aralAssessmentPhaseLabel(check.phase)}
                              </span>
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-cnhs-green-dark"
                                  style={{ width: `${Math.min(100, check.percent)}%` }}
                                />
                              </div>
                              <span className="w-16 text-right text-[11px] font-semibold text-slate-800">
                                {check.percent}%
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-600">
                          Beginning Baseline: <span className="font-semibold">{progress.baseline?.percent ?? "—"}%</span> · Latest
                          Score: <span className="font-semibold">{progress.latest?.percent ?? "—"}%</span> · Progress Gain:{" "}
                          <span className="font-bold text-cnhs-green-dark">{formatImprovement(progress.improvement)}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] text-slate-400">
                        Pre / Mid / Post assessment results will be displayed here as they are recorded.
                      </p>
                    )}
                  </Section>

                  <Section title="C. Intervention Sessions & Activities">
                    {records.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-[640px] w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-[9px] uppercase tracking-[0.06em] text-slate-400">
                              {["Date", "Week", "Session Focus / Topic", "Activity", "Attendance", "Remarks"].map((h) => (
                                <th key={h} className="px-2 py-1.5">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((row) => (
                              <tr key={row.id} className="border-t border-slate-100">
                                <td className="px-2 py-1.5">{row.observation_date || "—"}</td>
                                <td className="px-2 py-1.5">
                                  {resolveStoredWeekNumber(row)
                                    ? `Week ${resolveStoredWeekNumber(row)}`
                                    : "—"}
                                </td>
                                <td className="px-2 py-1.5">{row.topic || row.skill_focus || "—"}</td>
                                <td className="px-2 py-1.5">{row.activity || "—"}</td>
                                <td className="px-2 py-1.5">
                                  {ARAL_SESSION_LABELS[row.session_status] || "Attended"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500">
                                  {stripAralWeekPrefix(row.teacher_remarks) || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-400">
                        No intervention session logs recorded yet. Use the form below to add a progress observation.
                      </p>
                    )}
                  </Section>
                </div>
              ) : null}

              {/* Tab 3: Teacher Evaluation */}
              {detailTab === "evaluation" ? (
                <div className="space-y-3">
                  <Section title="Teacher Evaluation & Next Action">
                    {canWrite ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="text-[11px] text-slate-500">
                            Progress evaluation
                            <AppSelect
                              label="Progress evaluation"
                              value={evalForm.progressEvaluation}
                              onChange={(next) =>
                                setEvalForm((prev) => ({
                                  ...prev,
                                  progressEvaluation: next,
                                }))
                              }
                              options={[
                                { value: "", label: "—" },
                                ...PROGRESS_EVALUATION_OPTIONS.map((opt) => ({
                                  value: opt,
                                  label: opt,
                                })),
                              ]}
                              className="mt-1"
                              triggerClassName="h-8 rounded-lg px-2 text-[12px]"
                            />
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Next action
                            <AppSelect
                              label="Next action"
                              value={evalForm.nextAction}
                              onChange={(next) =>
                                setEvalForm((prev) => ({
                                  ...prev,
                                  nextAction: next,
                                }))
                              }
                              options={[
                                { value: "", label: "—" },
                                ...NEXT_ACTION_OPTIONS.map((opt) => ({
                                  value: opt,
                                  label: opt,
                                })),
                              ]}
                              className="mt-1"
                              triggerClassName="h-8 rounded-lg px-2 text-[12px]"
                            />
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Intervention status
                            <AppSelect
                              label="Status"
                              value={evalForm.status}
                              onChange={(next) =>
                                setEvalForm((prev) => ({
                                  ...prev,
                                  status: next,
                                }))
                              }
                              options={INTERVENTION_STATUS_OPTIONS}
                              className="mt-1"
                              triggerClassName="h-8 rounded-lg px-2 text-[12px]"
                            />
                          </div>
                        </div>
                        <textarea
                          value={evalForm.remarks}
                          onChange={(e) =>
                            setEvalForm((prev) => ({ ...prev, remarks: e.target.value }))
                          }
                          rows={2}
                          placeholder="Teacher observation notes and recommendations..."
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] outline-none focus:border-cnhs-green"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={requestStatusSave}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3.5 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-60"
                        >
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Save Evaluation & Progress
                        </button>
                      </div>
                    ) : (
                      <p className="text-[12px] text-slate-600">
                        Evaluation: <span className="font-medium text-slate-800">{evalRecord?.progress_evaluation || "—"}</span> · Action:{" "}
                        <span className="font-medium text-slate-800">{evalRecord?.next_action || "—"}</span>
                        {evalRecord?.evaluated_at
                          ? ` · Recorded on ${new Date(evalRecord.evaluated_at).toLocaleDateString("en-PH")}`
                          : ""}
                      </p>
                    )}
                  </Section>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={pendingStatus != null}
        title="Change intervention status?"
        message={`Set this learner to “${pendingStatus}”? The teacher decision is recorded; scores do not auto-complete.`}
        confirmLabel="Save status"
        cancelLabel="Cancel"
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => {
          const next = pendingStatus;
          setPendingStatus(null);
          if (next) persistEvaluation(next);
        }}
      />
    </div>
  );
}
