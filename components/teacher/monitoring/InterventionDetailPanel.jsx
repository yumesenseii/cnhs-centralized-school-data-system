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
  const [toast, setToast] = useState("");
  const [records, setRecords] = useState([]);
  const [scores, setScores] = useState([]);
  const [evalForm, setEvalForm] = useState({
    progressEvaluation: "",
    nextAction: "",
    remarks: "",
    status: INTERVENTION_STATUS.ONGOING,
  });
  const [pendingStatus, setPendingStatus] = useState(null);

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
    setToast("");
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
    setToast("Saved teacher evaluation and status.");
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
      <div className="relative z-10 flex max-h-[86vh] w-[min(920px,96vw)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              Intervention record
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{name}</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {learner.studentNumber || "—"} · {learner.gradeSection || "—"}
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
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

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading intervention record…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <RiskPill value={learner.riskLevel} />
                <Pill value={type} styles={interventionStyles} />
                <Pill
                  value={displayInterventionStatus(learner.monitoringStatus)}
                  styles={monitoringStatusStyles}
                />
              </div>

              <Section title="A. Learner">
                <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                  <p><span className="text-slate-400">Name</span><br />{name}</p>
                  <p><span className="text-slate-400">Grade</span><br />{learner.grade || "—"}</p>
                  <p><span className="text-slate-400">Section</span><br />{learner.section || "—"}</p>
                  <p><span className="text-slate-400">LRN</span><br />{learner.studentNumber || "—"}</p>
                </div>
              </Section>

              <Section title="B. Academic basis">
                <p className="text-[12px] text-slate-700">
                  {learner.subject} · {learner.classSubjectGrade ?? "—"}
                  {learner.weakSubject ? ` · Weak: ${learner.weakSubject}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {learner.recommendationReason ||
                    "Recommendation from ECR grades and Random Forest risk. Attendance is not a prediction input."}
                </p>
              </Section>

              <Section title="C. Intervention">
                <p className="text-[12px] text-slate-700">
                  {type} · Facilitator: {learner.aralFacilitatorName || "Not assigned"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  HT status: {learner.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED}
                  {learner.latestObservationDate
                    ? ` · Last session ${learner.latestObservationDate}`
                    : ""}
                </p>
              </Section>

              <Section title="D. Sessions">
                {records.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[640px] w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-[9px] uppercase tracking-[0.06em] text-slate-400">
                          {["Date", "Week", "Topic", "Activity", "Attendance", "Remarks"].map((h) => (
                            <th key={h} className="px-1.5 py-1">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="px-1.5 py-1.5">{row.observation_date || "—"}</td>
                            <td className="px-1.5 py-1.5">
                              {resolveStoredWeekNumber(row)
                                ? `Week ${resolveStoredWeekNumber(row)}`
                                : "—"}
                            </td>
                            <td className="px-1.5 py-1.5">{row.topic || row.skill_focus || "—"}</td>
                            <td className="px-1.5 py-1.5">{row.activity || "—"}</td>
                            <td className="px-1.5 py-1.5">
                              {ARAL_SESSION_LABELS[row.session_status] || "—"}
                            </td>
                            <td className="px-1.5 py-1.5 text-slate-500">
                              {stripAralWeekPrefix(row.teacher_remarks) || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-400">
                    No sessions saved yet. Recommendation is not an active intervention
                    until a teacher records a session or evaluation.
                  </p>
                )}
              </Section>

              <Section title="E. Recorded Progress">
                {progress.checkCount ? (
                  <>
                    <div className="space-y-1.5">
                      {progress.checks.map((check) => (
                        <div key={check.phase} className="flex items-center gap-2">
                          <span className="w-20 text-[11px] text-slate-500">
                            {aralAssessmentPhaseLabel(check.phase)}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-cnhs-green-dark"
                              style={{ width: `${Math.min(100, check.percent)}%` }}
                            />
                          </div>
                          <span className="w-14 text-right text-[11px] font-semibold text-slate-700">
                            {check.percent}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Starting {progress.baseline?.percent ?? "—"}% · Latest{" "}
                      {progress.latest?.percent ?? "—"}% · Improvement{" "}
                      {formatImprovement(progress.improvement)} ·{" "}
                      {progress.checkCount} check
                      {progress.checkCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Recorded Progress from saved Pre / Mid / Post only. Not proof
                      that the intervention caused the change.
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-slate-400">
                    No Pre / Mid / Post scores saved yet.
                  </p>
                )}
              </Section>

              <Section title="F. Teacher evaluation">
                {canWrite ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="text-[11px] text-slate-500">
                        Progress evaluation
                        <select
                          value={evalForm.progressEvaluation}
                          onChange={(e) =>
                            setEvalForm((prev) => ({
                              ...prev,
                              progressEvaluation: e.target.value,
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
                        >
                          <option value="">—</option>
                          {PROGRESS_EVALUATION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-500">
                        Next action
                        <select
                          value={evalForm.nextAction}
                          onChange={(e) =>
                            setEvalForm((prev) => ({
                              ...prev,
                              nextAction: e.target.value,
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
                        >
                          <option value="">—</option>
                          {NEXT_ACTION_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-500">
                        Status
                        <select
                          value={evalForm.status}
                          onChange={(e) =>
                            setEvalForm((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                          className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
                        >
                          {INTERVENTION_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <textarea
                      value={evalForm.remarks}
                      onChange={(e) =>
                        setEvalForm((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                      rows={2}
                      placeholder="Teacher remarks"
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[12px] outline-none focus:border-cnhs-green"
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={requestStatusSave}
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-60"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      Save evaluation
                    </button>
                    <p className="text-[10px] text-slate-400">
                      Teacher sets the final status. Scores do not auto-complete the
                      intervention.
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] text-slate-600">
                    {evalRecord?.progress_evaluation || "—"} ·{" "}
                    {evalRecord?.next_action || "—"}
                    {evalRecord?.evaluated_at
                      ? ` · ${new Date(evalRecord.evaluated_at).toLocaleDateString("en-PH")}`
                      : ""}
                  </p>
                )}
              </Section>

              <Section title="G. History">
                <p className="text-[11px] text-slate-500">
                  {records.length} saved monitoring row
                  {records.length === 1 ? "" : "s"} for this class enrollment.
                  Older rows stay; new evaluation updates the latest row.
                </p>
              </Section>
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
