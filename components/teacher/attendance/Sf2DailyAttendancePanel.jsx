"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Search } from "lucide-react";
import {
  otherSessionKey,
  otherSessionStatus,
  sessionTotalsFromMarks,
  statusShort,
} from "@/lib/attendance/dailyAnalytics";
import {
  SF2_SESSION,
  SF2_STATUS,
  suggestedSessionFromClock,
  withDraftDayMark,
} from "@/lib/attendance/sf2Daily";
import {
  getSectionDailyRoster,
  saveSectionDailyAttendance,
} from "@/lib/supabase/queries/attendanceDaily";
import ConfirmModal from "@/components/shared/ConfirmModal";
import SaveToast from "@/components/teacher/attendance/SaveToast";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: SF2_STATUS.PRESENT, label: "Present", short: "P" },
  { value: SF2_STATUS.ABSENT, label: "Absent", short: "x" },
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "unsaved", label: "Unsaved" },
  { value: "M", label: "M" },
  { value: "F", label: "F" },
];

const SESSION_OPTIONS = [
  { value: SF2_SESSION.MORNING, label: "Morning" },
  { value: SF2_SESSION.AFTERNOON, label: "Afternoon" },
];

function statusButtonClass(value, selected) {
  if (!selected) {
    return "border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
  }
  if (value === SF2_STATUS.PRESENT) {
    return "border-cnhs-green-dark/30 bg-green-50 text-cnhs-green-dark";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

function groupRowsBySex(rows = []) {
  return [
    { key: "M", label: "Male", rows: rows.filter((row) => row.sex === "M") },
    { key: "F", label: "Female", rows: rows.filter((row) => row.sex === "F") },
    {
      key: "other",
      label: "Unspecified",
      rows: rows.filter((row) => row.sex !== "M" && row.sex !== "F"),
    },
  ].filter((group) => group.rows.length);
}

export default function Sf2DailyAttendancePanel({
  sectionId,
  schoolYear,
  schoolYears = [],
  sections = [],
  attendanceDate,
  onSchoolYearChange,
  onSectionChange,
  onAttendanceDateChange,
  onDirtyChange,
  onSaved,
}) {
  const [sf2Session, setSf2Session] = useState(suggestedSessionFromClock);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [roster, setRoster] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [isAdviser, setIsAdviser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  const toastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showSaveToast(message) {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    setToastOpen(true);
    toastTimerRef.current = window.setTimeout(() => {
      setToastOpen(false);
      toastTimerRef.current = null;
    }, 5000);
  }

  const reload = useCallback(async () => {
    if (!sectionId || !schoolYear || !attendanceDate || !sf2Session) {
      setRoster([]);
      setDrafts({});
      setIsAdviser(false);
      dirtyCallbackRef.current?.(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await getSectionDailyRoster({
      sectionId,
      schoolYear,
      attendanceDate,
      session: sf2Session,
    });
    if (result.error) {
      setError(result.error.message);
      setRoster([]);
      setDrafts({});
      setIsAdviser(false);
      dirtyCallbackRef.current?.(false);
      setLoading(false);
      return;
    }

    const nextRoster = result.data?.roster ?? [];
    const nextDrafts = {};
    for (const row of nextRoster) {
      nextDrafts[row.studentId] = row.saved
        ? row.savedStatus
        : SF2_STATUS.PRESENT;
    }
    setRoster(nextRoster);
    setDrafts(nextDrafts);
    setIsAdviser(Boolean(result.data?.isAdviser));
    dirtyCallbackRef.current?.(false);
    setLoading(false);
  }, [sectionId, schoolYear, attendanceDate, sf2Session]);

  useEffect(() => {
    reload();
  }, [reload]);

  const rows = useMemo(
    () =>
      roster.map((row) => {
        const status = drafts[row.studentId] || SF2_STATUS.PRESENT;
        const dirty = row.saved ? status !== row.savedStatus : true;
        const changed = row.saved
          ? status !== row.savedStatus
          : status !== SF2_STATUS.PRESENT;
        const other = otherSessionStatus(
          row.monthMarks,
          attendanceDate,
          sf2Session
        );
        const sessionTotals = sessionTotalsFromMarks(row.monthMarks ?? []);
        return {
          ...row,
          status,
          dirty,
          changed,
          otherStatus: other,
          sessionTotals,
        };
      }),
    [roster, drafts, attendanceDate, sf2Session]
  );

  const isDirty = useMemo(() => rows.some((row) => row.dirty), [rows]);

  useEffect(() => {
    dirtyCallbackRef.current?.(isDirty);
  }, [isDirty]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "M" || filter === "F") {
        if (row.sex !== filter) return false;
      } else if (filter === "unsaved") {
        if (row.saved && !row.dirty) return false;
      } else if (filter !== "all" && row.status !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        String(row.studentNumber).toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const visibleGroups = useMemo(
    () => groupRowsBySex(visibleRows),
    [visibleRows]
  );

  function applySessionChange(next) {
    setSf2Session(next);
    setToast("");
    setToastOpen(false);
  }

  function applyDateChange(next) {
    onAttendanceDateChange?.(next);
    setToast("");
    setToastOpen(false);
  }

  function requestSessionChange(next) {
    if (next === sf2Session) return;
    if (isDirty) {
      setConfirm({
        title: "Unsaved attendance",
        message:
          "You have unsaved attendance marks. Discard them and continue?",
        confirmLabel: "Discard",
        action: () => applySessionChange(next),
      });
      return;
    }
    applySessionChange(next);
  }

  function requestSchoolYearLeave(next) {
    if (next === schoolYear) return;
    if (isDirty) {
      setConfirm({
        title: "Unsaved attendance",
        message:
          "You have unsaved attendance marks. Discard them and continue?",
        confirmLabel: "Discard",
        action: () => onSchoolYearChange?.(next),
      });
      return;
    }
    onSchoolYearChange?.(next);
  }

  function requestSectionLeave(next) {
    if (next === sectionId) return;
    if (isDirty) {
      setConfirm({
        title: "Unsaved attendance",
        message:
          "You have unsaved attendance marks. Discard them and continue?",
        confirmLabel: "Discard",
        action: () => onSectionChange?.(next),
      });
      return;
    }
    onSectionChange?.(next);
  }

  function requestDateChange(next) {
    if (next === attendanceDate) return;
    if (isDirty) {
      setConfirm({
        title: "Unsaved attendance",
        message:
          "You have unsaved attendance marks. Discard them and continue?",
        confirmLabel: "Discard",
        action: () => applyDateChange(next),
      });
      return;
    }
    applyDateChange(next);
  }

  function setStatus(studentId, status) {
    if (!isAdviser) return;
    setDrafts((prev) => ({ ...prev, [studentId]: status }));
    setToast("");
    setToastOpen(false);
  }

  function applyVisiblePresent() {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of visibleRows) {
        next[row.studentId] = SF2_STATUS.PRESENT;
      }
      return next;
    });
  }

  function markVisiblePresent() {
    if (!isAdviser || !visibleRows.length) return;
    const overwriting = visibleRows.filter(
      (row) => row.status === SF2_STATUS.ABSENT
    );
    if (overwriting.length) {
      setConfirm({
        title: "Mark as Present",
        message: `${overwriting.length} learner(s) are marked Absent. Mark the visible list as Present?`,
        confirmLabel: "Mark Present",
        action: applyVisiblePresent,
      });
      return;
    }
    applyVisiblePresent();
  }

  async function handleSave() {
    if (!isAdviser) return;
    setSaving(true);
    setError("");
    setToast("");
    setToastOpen(false);
    const result = await saveSectionDailyAttendance({
      sectionId,
      schoolYear,
      attendanceDate,
      session: sf2Session,
      marks: rows.map((row) => ({
        studentId: row.studentId,
        status: row.status,
        savedStatus: row.savedStatus,
      })),
    });
    if (result.error) {
      setError(result.error.message);
    } else {
      showSaveToast(`Saved ${result.data?.saved ?? 0} learner mark(s).`);
      setRoster((prev) =>
        prev.map((row) => {
          const status = drafts[row.studentId] || SF2_STATUS.PRESENT;
          const unchangedLegacy =
            (row.savedStatus === SF2_STATUS.LATE ||
              row.savedStatus === SF2_STATUS.CUTTING) &&
            status === row.savedStatus;
          if (unchangedLegacy) return row;
          if (status !== SF2_STATUS.PRESENT && status !== SF2_STATUS.ABSENT) {
            return row;
          }
          return {
            ...row,
            status,
            saved: true,
            savedStatus: status,
            monthMarks: withDraftDayMark(
              row.monthMarks,
              attendanceDate,
              sf2Session,
              status
            ),
          };
        })
      );
      onSaved?.();
    }
    setSaving(false);
  }

  const sessionLabel =
    sf2Session === SF2_SESSION.AFTERNOON ? "PM" : "AM";
  const otherLabel =
    otherSessionKey(sf2Session) === SF2_SESSION.AFTERNOON ? "PM" : "AM";

  return (
    <section className="rounded-2xl border border-cnhs-green-dark/20 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <SaveToast message={toast} open={toastOpen} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cnhs-green-dark">
            Daily attendance
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">
            Morning and Afternoon roll call
          </h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Present or Absent until you save.
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <label className="text-[11px] font-medium text-slate-500">
            School year
            <select
              value={schoolYear}
              onChange={(e) => requestSchoolYearLeave(e.target.value)}
              className="mt-1 block h-9 min-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-800"
            >
              {(schoolYears.length ? schoolYears : ["SY 2026-2027"]).map(
                (year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            Section
            <select
              value={sectionId || ""}
              onChange={(e) => requestSectionLeave(e.target.value)}
              className="mt-1 block h-9 min-w-[11rem] rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-800"
            >
              <option value="">Select section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  Grade {section.grade_level} · {section.section_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            Date
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => requestDateChange(e.target.value)}
              className="mt-1 block h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-800"
            />
          </label>
          <div className="text-[11px] font-medium text-slate-500">
            Session
            <div className="mt-1 flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {SESSION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => requestSessionChange(option.value)}
                  className={cn(
                    "h-full cursor-pointer px-3 text-[12px] font-semibold",
                    sf2Session === option.value
                      ? "bg-cnhs-green-dark text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!isAdviser || saving || !roster.length || !isDirty}
            onClick={handleSave}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/30 bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            Save
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or LRN"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12px] text-slate-800"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "h-8 cursor-pointer rounded-full border px-2.5 text-[11px] font-semibold",
                filter === item.value
                  ? "border-cnhs-green-dark/30 bg-green-50 text-cnhs-green-dark"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            disabled={!isAdviser || !visibleRows.length}
            onClick={markVisiblePresent}
            className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Mark visible as Present
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading roster…
        </div>
      ) : !sectionId ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          Choose a section to load enrolled learners.
        </p>
      ) : !roster.length ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-medium text-slate-700">
          No learners enrolled in this section yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-semibold">Learner</th>
                <th className="py-2 pr-3 font-semibold">LRN</th>
                <th className="py-2 pr-3 font-semibold">Sex</th>
                <th className="py-2 pr-3 font-semibold">{sessionLabel}</th>
                <th className="py-2 pr-3 font-semibold">{otherLabel}</th>
                <th className="py-2 pr-3 font-semibold">Month sessions</th>
                <th className="py-2 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => (
                <Fragment key={group.key}>
                  <tr className="bg-slate-50">
                    <td
                      colSpan={7}
                      className="py-1.5 pr-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.rows.map((row) => {
                    const legacy =
                      row.status === SF2_STATUS.LATE ||
                      row.status === SF2_STATUS.CUTTING;
                    return (
                      <tr
                        key={row.studentId}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="py-2 pr-3 font-semibold text-slate-800">
                          {row.name}
                        </td>
                        <td className="py-2 pr-3 text-slate-500">
                          {row.studentNumber || "—"}
                        </td>
                        <td className="py-2 pr-3 text-slate-600">{row.sex}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                disabled={!isAdviser}
                                onClick={() =>
                                  setStatus(row.studentId, option.value)
                                }
                                className={cn(
                                  "h-7 cursor-pointer rounded-md border px-2 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                                  statusButtonClass(
                                    option.value,
                                    row.status === option.value
                                  )
                                )}
                                title={option.label}
                              >
                                {option.short}
                              </button>
                            ))}
                            {legacy ? (
                              <span className="inline-flex h-7 items-center rounded-md bg-slate-100 px-2 text-[10px] font-semibold text-slate-500">
                                Saved {statusShort(row.status)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-3 text-slate-600">
                          {row.otherStatus
                            ? statusShort(row.otherStatus)
                            : `${otherLabel} not saved`}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">
                          {row.sessionTotals.present}P ·{" "}
                          {row.sessionTotals.absent}A
                        </td>
                        <td className="py-2">
                          {row.saved && !row.changed ? (
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-cnhs-green-dark">
                              Saved
                            </span>
                          ) : row.changed ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Unsaved
                            </span>
                          ) : (
                            <span className="text-slate-300">On screen</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!visibleRows.length ? (
            <p className="py-6 text-center text-[12px] text-slate-500">
              No learners match this search or filter.
            </p>
          ) : null}
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title || "Confirm"}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.action;
          setConfirm(null);
          action?.();
        }}
      />
    </section>
  );
}
