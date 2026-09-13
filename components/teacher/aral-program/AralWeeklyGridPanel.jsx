"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Upload } from "lucide-react";
import ConfirmModal from "@/components/shared/ConfirmModal";
import {
  ARAL_FOCUS_OPTIONS,
  ARAL_PROGRESS_OPTIONS,
  ARAL_REMARKS_MAX,
  ARAL_REMARKS_PLACEHOLDER,
  ARAL_SESSION_LABELS,
  ARAL_SESSION_OPTIONS,
  ARAL_WEEKLY_INTERVENTION,
  ARAL_WEEK_OPTIONS,
  aralObservationDateToday,
  clipAralRemarks,
  formatAralRosterName,
  formatAralWeeklyRemarks,
  parseAralProgress,
  stripAralWeekPrefix,
} from "@/lib/monitoring/aralProgress";
import {
  buildWeekFileRows,
  groupMonitoringRecordsByLearner,
} from "@/lib/monitoring/aralSectionFiles";
import { parseAralWeeklyWorkbook } from "@/lib/reports/aralWeeklyProgressExport";
import { MONITORING_STATUS } from "@/lib/monitoring/recommendations";
import {
  createMonitoringRecord,
  listMonitoringRecordsForStudents,
  updateMonitoringRecord,
} from "@/lib/supabase/queries/monitoring";
import { confirmDestructive } from "@/lib/ui/confirmAction";
import { cn } from "@/lib/utils";

function emptyDraft() {
  return {
    recordId: null,
    observationDate: "",
    sessionStatus: "",
    skillFocus: "",
    topic: "",
    activity: "",
    studentProgress: "",
    teacherRemarks: "",
    monitoringStatus: "",
    followUpNeeded: false,
  };
}

function draftsFromRows(rows) {
  const next = {};
  for (const row of rows) {
    const rec = row.record;
    next[row.learner.id] = {
      recordId: rec?.id || null,
      observationDate: rec?.observationDate || "",
      sessionStatus: rec?.sessionStatus || "",
      skillFocus: rec?.skillFocus || "",
      topic: rec?.topic || rec?.raw?.topic || "",
      activity: rec?.activity || rec?.raw?.activity || "",
      studentProgress: rec?.studentProgress || "",
      teacherRemarks: stripAralWeekPrefix(rec?.teacherRemarks).slice(
        0,
        ARAL_REMARKS_MAX
      ),
      monitoringStatus: rec?.monitoringStatus || "",
      followUpNeeded: Boolean(rec?.followUpNeeded),
    };
  }
  return next;
}

function rowHasWeeklyInput(cells) {
  return Boolean(
    String(cells?.sessionStatus ?? "").trim() ||
      String(cells?.skillFocus ?? "").trim() ||
      String(cells?.topic ?? "").trim() ||
      String(cells?.activity ?? "").trim() ||
      parseAralProgress(cells?.studentProgress) ||
      String(cells?.teacherRemarks ?? "").trim()
  );
}

function draftsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * In-app Weekly grid for one week. Facilitator write; others view.
 * Session starts blank — do not auto-mark Present.
 */
export default function AralWeeklyGridPanel({
  group,
  teacherId = null,
  canWrite = false,
  onDirtyChange,
}) {
  const learners = group?.learners ?? [];
  const schoolYear = group?.schoolYear || learners[0]?.schoolYear || "";
  const gradeSection = group?.gradeSection ?? "";

  const learnerKey = useMemo(
    () => learners.map((l) => `${l.studentId}:${l.sourceClassId}`).join("|"),
    [learners]
  );

  const [weekNumber, setWeekNumber] = useState(1);
  const [pendingWeek, setPendingWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState({});
  const [savedDraft, setSavedDraft] = useState({});
  const fileInputRef = useRef(null);

  const dirty = useMemo(
    () => !draftsEqual(draft, savedDraft),
    [draft, savedDraft]
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const refresh = useCallback(async () => {
    const studentIds = learners.map((l) => l.studentId).filter(Boolean);
    const classIds = learners.map((l) => l.sourceClassId).filter(Boolean);
    if (!studentIds.length) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await listMonitoringRecordsForStudents({
      studentIds,
      classIds,
    });
    if (result.error) {
      setError(result.error.message);
      setRecords([]);
    } else {
      const pairKeys = new Set(
        learners
          .filter((l) => l.studentId && l.sourceClassId)
          .map((l) => `${l.studentId}::${l.sourceClassId}`)
      );
      setRecords(
        (result.data ?? []).filter((row) =>
          pairKeys.has(`${row.student_id}::${row.class_id}`)
        )
      );
    }
    setLoading(false);
  }, [learners, learnerKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const weekRows = useMemo(() => {
    const byLearner = groupMonitoringRecordsByLearner(learners, records);
    return buildWeekFileRows(learners, byLearner, weekNumber);
  }, [learners, records, weekNumber]);

  useEffect(() => {
    const next = draftsFromRows(weekRows);
    setDraft(next);
    setSavedDraft(next);
    setError("");
    setToast("");
  }, [weekNumber, records, learnerKey]);

  function setCell(learnerId, field, value) {
    if (!canWrite) return;
    setDraft((prev) => ({
      ...prev,
      [learnerId]: {
        ...emptyDraft(),
        ...(prev[learnerId] || {}),
        [field]: value,
      },
    }));
    setToast("");
  }

  function requestWeek(nextWeek) {
    if (nextWeek === weekNumber) return;
    if (dirty) {
      setPendingWeek(nextWeek);
      return;
    }
    setWeekNumber(nextWeek);
  }

  async function persistRows(items, targetWeek) {
    for (const item of items) {
      const learner = item.learner;
      const cells = item.cells;
      const remarks = clipAralRemarks(cells.teacherRemarks);
      const progress = parseAralProgress(cells.studentProgress);
      const payload = {
        observation_date:
          String(cells.observationDate || "").trim() || aralObservationDateToday(),
        intervention_given: item.interventionGiven || ARAL_WEEKLY_INTERVENTION,
        teacher_remarks: formatAralWeeklyRemarks(targetWeek, remarks),
        student_progress: progress,
        follow_up_needed: Boolean(cells.followUpNeeded),
        monitoring_status:
          cells.monitoringStatus || MONITORING_STATUS.ONGOING,
        week_number: targetWeek,
        session_status: cells.sessionStatus || null,
        skill_focus: cells.skillFocus || null,
        topic: String(cells.topic || "").trim() || null,
        activity: String(cells.activity || "").trim() || null,
      };

      if (cells.recordId) {
        const result = await updateMonitoringRecord(cells.recordId, payload);
        if (result.error) return result;
      } else {
        const result = await createMonitoringRecord({
          student_id: learner.studentId,
          class_id: learner.sourceClassId,
          teacher_id: teacherId,
          school_year: learner.schoolYear || schoolYear,
          quarter: Number(learner.quarter) || 4,
          ...payload,
        });
        if (result.error) return result;
      }
    }
    return { error: null };
  }

  async function handleSave() {
    if (!canWrite || !teacherId) {
      setError("Sign in as the assigned facilitator to save weekly progress.");
      return;
    }

    setError("");
    setToast("");

    const toSave = [];
    for (const row of weekRows) {
      const learner = row.learner;
      if (!learner?.studentId || !learner.sourceClassId) continue;
      const cells = draft[learner.id] || emptyDraft();
      if (!rowHasWeeklyInput(cells)) continue;
      toSave.push({
        learner,
        cells: {
          ...cells,
          teacherRemarks: clipAralRemarks(cells.teacherRemarks),
        },
      });
    }

    if (!toSave.length) {
      setError(
        "Mark session, topic, activity, skill, progress, or remarks for at least one learner. Empty rows are not saved. Session is not auto-marked Present."
      );
      return;
    }

    setSaving(true);
    const result = await persistRows(toSave, weekNumber);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setToast(`Saved Week ${weekNumber} for ${toSave.length} learner(s).`);
    await refresh();
  }

  function handleUploadClick() {
    if (!canWrite || !teacherId) {
      setError("Sign in as the assigned facilitator to upload a weekly Excel.");
      return;
    }
    const filled = weekRows.some((row) => row.record);
    if (
      filled &&
      !confirmDestructive(
        `Replace the existing Week ${weekNumber} Excel data for ${gradeSection}?\n\nSaved rows for this week will be overwritten.`
      )
    ) {
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleFileChange(event) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;

    setUploading(true);
    setError("");
    setToast("");
    try {
      const buffer = await picked.arrayBuffer();
      const parsed = parseAralWeeklyWorkbook(buffer, {
        learners,
        weekNumber,
      });
      if (parsed.errors.length) {
        setError(parsed.errors.slice(0, 8).join(" "));
        return;
      }
      const weekRowsParsed = parsed.rows.filter(
        (row) => (row.weekNumber || weekNumber) === weekNumber
      );
      if (!weekRowsParsed.length) {
        setError(
          `No matching weekly rows for Week ${weekNumber}. Check Student Number values against this section roster.`
        );
        return;
      }

      const byLearner = groupMonitoringRecordsByLearner(learners, records);
      const items = [];
      for (const item of weekRowsParsed) {
        const learner = item.learner;
        if (!learner?.studentId || !learner.sourceClassId) continue;
        const weeks =
          byLearner.get(`${learner.studentId}::${learner.sourceClassId}`) ?? [];
        const existing = weeks.find((row) => row.weekNumber === weekNumber);
        items.push({
          learner,
          interventionGiven: item.interventionGiven,
          cells: {
            recordId: existing?.id || null,
            observationDate: item.observationDate,
            sessionStatus: item.sessionStatus || "",
            skillFocus: item.skillFocus || "",
            topic: item.topic || "",
            activity: item.activity || "",
            studentProgress: item.studentProgress,
            teacherRemarks: item.teacherRemarks,
            monitoringStatus: item.monitoringStatus,
            followUpNeeded: Boolean(item.followUpNeeded),
          },
        });
      }

      const result = await persistRows(items, weekNumber);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      setToast(
        `Uploaded Week ${weekNumber} for ${items.length} learner(s) from Excel.`
      );
      await refresh();
    } catch (err) {
      setError(err?.message ?? "Unable to read that Excel file.");
    } finally {
      setUploading(false);
    }
  }

  const filledCount = weekRows.filter((row) => row.record).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Loading Week {weekNumber}…
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-slate-500">Week</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {ARAL_WEEK_OPTIONS.map((week) => (
              <button
                key={week}
                type="button"
                onClick={() => requestWeek(week)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[11px] font-semibold ring-1",
                  week === weekNumber
                    ? "bg-cnhs-green-dark text-white ring-cnhs-green-dark"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                )}
              >
                Week {week}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {filledCount} of {learners.length} saved · Session starts blank (not
            Present). {canWrite ? "Facilitator can save." : "View only."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <button
              type="button"
              disabled={uploading}
              onClick={handleUploadClick}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              Upload Excel
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canWrite || saving || !teacherId || !learners.length}
            onClick={handleSave}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Save week
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        Same assigned ARAL roster only. Excel upload is optional — you can enter
        this week in the grid. ARAL session is not official SF2 and is not an
        Academic Prediction input.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-[1180px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Learner",
                "LRN",
                "Session",
                "Topic",
                "Activity",
                "Skill",
                "Progress",
                "Remarks",
              ].map((column) => (
                <th
                  key={column}
                  className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => {
              const cells = draft[learner.id] || emptyDraft();
              const name = formatAralRosterName(learner);
              const fieldClass =
                "h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-cnhs-green disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";
              return (
                <tr
                  key={learner.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-3 py-2">
                    <p className="text-[12px] font-semibold text-slate-800">
                      {name}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-[12px] tabular-nums text-slate-600">
                    {learner.studentNumber || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={cells.sessionStatus || ""}
                      disabled={!canWrite || !learner.sourceClassId}
                      onChange={(e) =>
                        setCell(learner.id, "sessionStatus", e.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="">—</option>
                      {ARAL_SESSION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {ARAL_SESSION_LABELS[opt]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      maxLength={80}
                      value={cells.topic || ""}
                      disabled={!canWrite || !learner.sourceClassId}
                      onChange={(e) =>
                        setCell(learner.id, "topic", e.target.value.slice(0, 80))
                      }
                      placeholder="Session topic"
                      className={cn(fieldClass, "min-w-[140px]")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      maxLength={80}
                      value={cells.activity || ""}
                      disabled={!canWrite || !learner.sourceClassId}
                      onChange={(e) =>
                        setCell(
                          learner.id,
                          "activity",
                          e.target.value.slice(0, 80)
                        )
                      }
                      placeholder="Activity"
                      className={cn(fieldClass, "min-w-[140px]")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={cells.skillFocus || ""}
                      disabled={!canWrite || !learner.sourceClassId}
                      onChange={(e) =>
                        setCell(learner.id, "skillFocus", e.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="">—</option>
                      {ARAL_FOCUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={cells.studentProgress || ""}
                      disabled={!canWrite || !learner.sourceClassId}
                      onChange={(e) =>
                        setCell(learner.id, "studentProgress", e.target.value)
                      }
                      className={cn(fieldClass, "min-w-[160px]")}
                    >
                      <option value="">—</option>
                      {ARAL_PROGRESS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      maxLength={ARAL_REMARKS_MAX}
                      value={cells.teacherRemarks || ""}
                      disabled={!canWrite || !learner.sourceClassId}
                      onChange={(e) =>
                        setCell(
                          learner.id,
                          "teacherRemarks",
                          e.target.value.slice(0, ARAL_REMARKS_MAX)
                        )
                      }
                      placeholder={ARAL_REMARKS_PLACEHOLDER}
                      className={cn(fieldClass, "min-w-[180px]")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmModal
        open={pendingWeek != null}
        title="Leave this week?"
        message={`Week ${weekNumber} has unsaved changes. Switch to Week ${pendingWeek} without saving?`}
        confirmLabel="Switch week"
        cancelLabel="Stay"
        onCancel={() => setPendingWeek(null)}
        onConfirm={() => {
          const next = pendingWeek;
          setPendingWeek(null);
          if (next != null) setWeekNumber(next);
        }}
      />
    </div>
  );
}
