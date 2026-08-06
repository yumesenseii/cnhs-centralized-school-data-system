"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import {
  Pill,
  RiskPill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import { useStudentMonitoringDetail } from "@/hooks/teacher/useMonitoring";
import {
  ARAL_PROGRESS_OPTIONS,
  ARAL_WEEKLY_INTERVENTION,
  canSubmitAralWeeklyProgress,
  formatAralWeeklyRemarks,
  isAralRecommended,
  nextAralWeekNumber,
} from "@/lib/monitoring/aralProgress";
import {
  ARAL_APPROVAL_STATUS,
  aralApprovalStyles,
} from "@/lib/monitoring/aralApproval";
import {
  MONITORING_STATUS,
} from "@/lib/monitoring/recommendations";
import { cn } from "@/lib/utils";

const PROGRESS_OPTIONS = ARAL_PROGRESS_OPTIONS;

const STATUS_OPTIONS = [
  MONITORING_STATUS.ONGOING,
  MONITORING_STATUS.IMPROVED,
  MONITORING_STATUS.NEEDS_FOLLOW_UP,
  MONITORING_STATUS.COMPLETED,
];

const INTERVENTION_OPTIONS = [
  ARAL_WEEKLY_INTERVENTION,
  "Classroom Remediation",
  "One-on-one Support",
  "Peer Tutoring",
  "Parent Conference",
  "ARAL Referral Follow-up",
  "Other",
];

function formatGrade(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n : "—";
}

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
      {children}
    </p>
  );
}

/**
 * OneData-style View / Edit modal for a monitored learner.
 * Grades (Term 1–3 TERM GRADE + FINAL) are always read-only.
 * Edit mode saves a monitoring record via existing createMonitoringRecord API.
 */
export default function LearnerMonitoringModal({
  learner,
  mode = "view",
  onModeChange,
  onClose,
  onSaved,
}) {
  const { detail, loading, error, saving, saveRecord } =
    useStudentMonitoringDetail(learner?.classId, learner?.studentId);

  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const editing = mode === "edit";

  const isAral = detail ? canSubmitAralWeeklyProgress(detail) : false;
  const nextWeek = detail ? nextAralWeekNumber(detail.records ?? []) : 1;

  const [form, setForm] = useState({
    observationDate: new Date().toISOString().slice(0, 10),
    interventionGiven: INTERVENTION_OPTIONS[0],
    teacherRemarks: "",
    studentProgress: PROGRESS_OPTIONS[2],
    followUpNeeded: false,
    monitoringStatus: MONITORING_STATUS.ONGOING,
  });

  useEffect(() => {
    if (!detail) return;
    setForm((prev) => ({
      ...prev,
      interventionGiven: canSubmitAralWeeklyProgress(detail)
        ? ARAL_WEEKLY_INTERVENTION
        : prev.interventionGiven === ARAL_WEEKLY_INTERVENTION
          ? "Classroom Remediation"
          : prev.interventionGiven,
      monitoringStatus:
        detail.monitoringStatus &&
        detail.monitoringStatus !== MONITORING_STATUS.NOT_STARTED
          ? detail.monitoringStatus
          : MONITORING_STATUS.ONGOING,
    }));
  }, [detail]);

  const termGrades = useMemo(() => {
    const fromDetail = detail?.termGrades;
    const fromLearner = learner?.termGrades;
    return {
      1: fromDetail?.[1] ?? fromLearner?.[1] ?? null,
      2: fromDetail?.[2] ?? fromLearner?.[2] ?? null,
      3: fromDetail?.[3] ?? fromLearner?.[3] ?? null,
      4: fromDetail?.[4] ?? fromLearner?.[4] ?? null,
    };
  }, [detail, learner]);

  const display = detail || learner;
  const approvalStatus =
    learner?.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED;

  async function handleSave(e) {
    e?.preventDefault?.();
    setFormError("");
    setToast("");

    if (!form.observationDate) {
      setFormError("Observation date is required.");
      return;
    }

    const remarks = isAral
      ? formatAralWeeklyRemarks(nextWeek, form.teacherRemarks)
      : form.teacherRemarks;

    const result = await saveRecord({
      ...form,
      teacherRemarks: remarks,
    });

    if (!result.ok) {
      setFormError(result.error?.message || "Unable to save changes.");
      return;
    }

    setToast("Changes saved.");
    onSaved?.();
    onModeChange?.("view");
  }

  if (!learner) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="learner-monitoring-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="learner-monitoring-modal-title"
                className="truncate text-base font-semibold text-slate-900 sm:text-lg"
              >
                {display?.name || learner.name}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  editing
                    ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
                    : "bg-sky-50 text-sky-800 ring-1 ring-sky-100"
                )}
              >
                {editing ? "Editing" : "Viewing"}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {editing
                ? "Update monitoring notes, then Save Changes."
                : "Read-only view. Click Edit to make changes."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!editing ? (
              <button
                type="button"
                onClick={() => onModeChange?.("edit")}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
              >
                <Pencil size={13} />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              disabled={saving}
              onClick={onClose}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading && !detail ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading learner details…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Student no.", display?.studentNumber],
                  ["Grade Lvl", display?.grade || display?.gradeLevel],
                  ["Section", display?.section],
                  ["Subject", display?.subject],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                  >
                    <FieldLabel>{label}</FieldLabel>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </section>

              <section className="overflow-hidden rounded-xl border border-slate-100">
                <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                    Term & final grades (from E-Class Record)
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {["Term 1", "Term 2", "Term 3", "Final"].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {[1, 2, 3, 4].map((q) => (
                          <td
                            key={q}
                            className="px-3 py-3 text-sm font-semibold text-slate-800"
                          >
                            {formatGrade(termGrades[q])}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
                  Grades are read-only (TERM GRADE / FINAL GRADE). Initial Grade
                  is not shown.
                </p>
              </section>

              <section className="flex flex-wrap items-center gap-2">
                <RiskPill value={display?.riskLevel} />
                {display?.recommendationDisplay ? (
                  <Pill
                    value={display.recommendationDisplay}
                    styles={interventionStyles}
                  />
                ) : null}
                {isAralRecommended(learner) ? (
                  <Pill value={approvalStatus} styles={aralApprovalStyles} />
                ) : null}
                <Pill
                  value={display?.monitoringStatus}
                  styles={monitoringStatusStyles}
                />
              </section>

              {editing ? (
                <form
                  id="learner-monitoring-edit-form"
                  onSubmit={handleSave}
                  className="space-y-3 rounded-xl border border-slate-100 bg-white p-3 sm:p-4"
                >
                  <p className="text-[12px] font-semibold text-slate-800">
                    Monitoring update
                    {isAral ? ` · Week ${nextWeek}` : ""}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <FieldLabel>Observation date</FieldLabel>
                      <input
                        type="date"
                        required
                        value={form.observationDate}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            observationDate: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>

                    <label className="block space-y-1">
                      <FieldLabel>Monitoring status</FieldLabel>
                      <select
                        value={form.monitoringStatus}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            monitoringStatus: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <FieldLabel>Intervention given</FieldLabel>
                      <select
                        value={form.interventionGiven}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            interventionGiven: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      >
                        {INTERVENTION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <FieldLabel>Student progress</FieldLabel>
                      <select
                        value={form.studentProgress}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            studentProgress: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                      >
                        {PROGRESS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <FieldLabel>Teacher remarks</FieldLabel>
                    <textarea
                      rows={3}
                      value={form.teacherRemarks}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          teacherRemarks: e.target.value,
                        }))
                      }
                      placeholder="Notes for this monitoring update…"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.followUpNeeded}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          followUpNeeded: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300"
                    />
                    Follow-up needed
                  </label>

                  {formError ? (
                    <p className="text-[12px] font-medium text-red-600">
                      {formError}
                    </p>
                  ) : null}
                </form>
              ) : (
                <section className="rounded-xl border border-slate-100 px-3 py-3">
                  <FieldLabel>Latest progress</FieldLabel>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {display?.latestProgress || "No monitoring updates yet."}
                  </p>
                  {display?.recommendationReason ? (
                    <div className="mt-3">
                      <FieldLabel>Recommendation reason</FieldLabel>
                      <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                        {display.recommendationReason}
                      </p>
                    </div>
                  ) : null}
                  {learner?.aralApprovalNote &&
                  approvalStatus === ARAL_APPROVAL_STATUS.RETURNED ? (
                    <p className="mt-2 rounded-lg bg-orange-50 px-2.5 py-2 text-[12px] text-orange-800">
                      HT note: {learner.aralApprovalNote}
                    </p>
                  ) : null}
                </section>
              )}

              {toast ? (
                <p className="text-[12px] font-medium text-emerald-700">
                  {toast}
                </p>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
          {editing ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => onModeChange?.("view")}
                className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="learner-monitoring-edit-form"
                disabled={saving || loading}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-[12px] font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Save Changes
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
