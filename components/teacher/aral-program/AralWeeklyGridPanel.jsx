"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Save, Upload } from "lucide-react";
import ConfirmModal from "@/components/shared/ConfirmModal";
import {
  ARAL_FOCUS_OPTIONS,
  ARAL_PROGRESS_OPTIONS,
  ARAL_REMARKS_MAX,
  ARAL_SESSION_LABELS,
  ARAL_SESSION_OPTIONS,
  ARAL_WEEKDAY_KEYS,
  ARAL_WEEKDAY_LABELS,
  ARAL_WEEKLY_INTERVENTION,
  ARAL_WEEK_OPTIONS,
  aralObservationDateToday,
  clipAralRemarks,
  compactAralSessionDays,
  emptyAralSessionDays,
  formatAralRosterName,
  formatAralWeeklyRemarks,
  hasAralSessionDayMark,
  parseAralProgress,
  sessionDaysFromRecord,
  stripAralWeekPrefix,
  summarizeAralSessionStatus,
} from "@/lib/monitoring/aralProgress";
import {
  buildWeekFileRows,
  groupMonitoringRecordsByLearner,
} from "@/lib/monitoring/aralSectionFiles";
import {
  downloadAralWeeklyTemplateExcel,
  parseAralWeeklyWorkbook,
} from "@/lib/reports/aralWeeklyProgressExport";
import { MONITORING_STATUS } from "@/lib/monitoring/recommendations";
import {
  createMonitoringRecord,
  listMonitoringRecordsForStudents,
  updateMonitoringRecord,
} from "@/lib/supabase/queries/monitoring";
import { confirmDestructive } from "@/lib/ui/confirmAction";
import { cn } from "@/lib/utils";
import { useAppToast } from "@/components/shared/AppToast";

const th =
  "sticky top-0 z-20 border border-slate-200 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600 whitespace-nowrap dark:border-white/10 dark:bg-[#222] dark:text-slate-300";
const td =
  "border border-slate-200 bg-transparent px-2 py-1 text-[12px] leading-snug text-slate-800 whitespace-nowrap dark:border-white/10 dark:text-slate-200";
const cellControl =
  "h-[28px] w-full appearance-none border-0 bg-transparent px-1 text-[12px] text-slate-800 shadow-none outline-none ring-0 focus:bg-cnhs-green-soft focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-slate-200 dark:focus:bg-white/6 dark:[color-scheme:dark]";
const lrnSticky = "sticky left-0 z-10 w-[132px] min-w-[132px] max-w-[132px]";
const nameSticky =
  "sticky left-[132px] z-10 min-w-[180px] shadow-[4px_0_8px_-4px_rgba(15,23,42,0.18)]";
const stickyFill = "bg-white";

function emptyDraft() {
  return {
    recordId: null,
    observationDate: "",
    sessionDays: emptyAralSessionDays(),
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
      sessionDays: sessionDaysFromRecord(rec || {}),
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
    hasAralSessionDayMark(cells?.sessionDays) ||
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
 * Excel-style Weekly grid for one week. Facilitator write; others view.
 * Mon–Fri starts blank — do not auto-mark Present. Not SF2.
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
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();
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
  }

  function setDay(learnerId, day, value) {
    if (!canWrite) return;
    setDraft((prev) => {
      const current = { ...emptyDraft(), ...(prev[learnerId] || {}) };
      return {
        ...prev,
        [learnerId]: {
          ...current,
          sessionDays: {
            ...emptyAralSessionDays(),
            ...(current.sessionDays || {}),
            [day]: value,
          },
        },
      };
    });
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
      const sessionDays = compactAralSessionDays(cells.sessionDays);
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
        session_days: sessionDays,
        session_status: summarizeAralSessionStatus(sessionDays),
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
        "Mark Mon–Fri, topic, activity, skill, progress, or remarks for at least one learner. Empty rows are not saved. Blank is not Absent."
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
    showToast(`Saved Week ${weekNumber} for ${toSave.length} learner(s).`);
    await refresh();
  }

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      await downloadAralWeeklyTemplateExcel({
        learners,
        records,
        gradeSection,
        schoolYear,
        weekNumber,
        generatedBy: "Facilitator",
      });
    } catch (err) {
      setError(err?.message || "Unable to download the weekly Excel.");
    } finally {
      setDownloading(false);
    }
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
            sessionDays: item.sessionDays || emptyAralSessionDays(),
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
      showToast(
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <span className="mr-1 text-[11px] font-medium text-slate-500">
            Week
          </span>
          {ARAL_WEEK_OPTIONS.map((week) => (
            <button
              key={week}
              type="button"
              onClick={() => requestWeek(week)}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[11px] font-semibold ring-1",
                week === weekNumber
                  ? "bg-cnhs-green-dark text-white ring-cnhs-green-dark"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 dark:bg-transparent dark:text-slate-300 dark:ring-white/10 dark:hover:bg-white/6"
              )}
            >
              Week {week}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={downloading || !learners.length}
            onClick={handleDownload}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/6"
          >
            {downloading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Download Excel
          </button>
          {canWrite ? (
            <button
              type="button"
              disabled={uploading}
              onClick={handleUploadClick}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/6"
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

      <p className="text-[10px] text-slate-400">
        {filledCount} of {learners.length} saved
        {canWrite ? " · You can save this week." : " · View only."}
      </p>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Mark who came each day this week. Leave a day empty if there was no
        session.
      </p>

      <div className="aral-week-scroll overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10 dark:bg-[#1c1c1c]">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr>
              <th className={cn(th, lrnSticky, "z-30 text-center")}>LRN</th>
              <th className={cn(th, nameSticky, "z-30")}>Learner</th>
              {ARAL_WEEKDAY_KEYS.map((day) => (
                <th key={day} className={cn(th, "w-[76px] text-center")}>
                  {ARAL_WEEKDAY_LABELS[day]}
                </th>
              ))}
              <th className={cn(th, "min-w-[140px]")}>Topic</th>
              <th className={cn(th, "min-w-[140px]")}>Activity</th>
              <th className={cn(th, "min-w-[120px]")}>Skill</th>
              <th className={cn(th, "min-w-[150px]")}>Progress</th>
              <th className={cn(th, "min-w-[180px]")}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => {
              const cells = draft[learner.id] || emptyDraft();
              const days = {
                ...emptyAralSessionDays(),
                ...(cells.sessionDays || {}),
              };
              const name = formatAralRosterName(learner);
              const locked = !canWrite || !learner.sourceClassId;
              return (
                <tr
                  key={learner.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-white/4"
                >
                  <td
                    className={cn(
                      td,
                      lrnSticky,
                      stickyFill,
                      "text-center tabular-nums text-slate-600 dark:text-slate-300"
                    )}
                  >
                    {learner.studentNumber || "—"}
                  </td>
                  <td
                    className={cn(
                      td,
                      nameSticky,
                      stickyFill,
                      "text-left font-medium"
                    )}
                  >
                    {name}
                  </td>
                  {ARAL_WEEKDAY_KEYS.map((day) => (
                    <td key={day} className={cn(td, "p-0 text-center")}>
                      <select
                        aria-label={`${name} ${ARAL_WEEKDAY_LABELS[day]}`}
                        value={days[day] || ""}
                        disabled={locked}
                        onChange={(e) => setDay(learner.id, day, e.target.value)}
                        className={cn(cellControl, "text-center")}
                      >
                        <option value="">—</option>
                        {ARAL_SESSION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {ARAL_SESSION_LABELS[opt]}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className={cn(td, "p-0")}>
                    <input
                      type="text"
                      maxLength={80}
                      value={cells.topic || ""}
                      disabled={locked}
                      onChange={(e) =>
                        setCell(learner.id, "topic", e.target.value.slice(0, 80))
                      }
                      className={cellControl}
                    />
                  </td>
                  <td className={cn(td, "p-0")}>
                    <input
                      type="text"
                      maxLength={80}
                      value={cells.activity || ""}
                      disabled={locked}
                      onChange={(e) =>
                        setCell(
                          learner.id,
                          "activity",
                          e.target.value.slice(0, 80)
                        )
                      }
                      className={cellControl}
                    />
                  </td>
                  <td className={cn(td, "p-0")}>
                    <select
                      aria-label={`${name} skill`}
                      value={cells.skillFocus || ""}
                      disabled={locked}
                      onChange={(e) =>
                        setCell(learner.id, "skillFocus", e.target.value)
                      }
                      className={cellControl}
                    >
                      <option value="">—</option>
                      {ARAL_FOCUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={cn(td, "p-0")}>
                    <select
                      aria-label={`${name} progress`}
                      value={cells.studentProgress || ""}
                      disabled={locked}
                      onChange={(e) =>
                        setCell(learner.id, "studentProgress", e.target.value)
                      }
                      className={cellControl}
                    >
                      <option value="">—</option>
                      {ARAL_PROGRESS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={cn(td, "p-0")}>
                    <input
                      type="text"
                      maxLength={ARAL_REMARKS_MAX}
                      value={cells.teacherRemarks || ""}
                      disabled={locked}
                      onChange={(e) =>
                        setCell(
                          learner.id,
                          "teacherRemarks",
                          e.target.value.slice(0, ARAL_REMARKS_MAX)
                        )
                      }
                      className={cellControl}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {learners.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">
            No assigned ARAL learners in this section.
          </p>
        ) : null}
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
