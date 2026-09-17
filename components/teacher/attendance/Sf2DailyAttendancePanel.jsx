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
import { useAppToast } from "@/components/shared/AppToast";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";
import AttendanceDatePicker from "@/components/attendance/AttendanceDatePicker";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: SF2_STATUS.PRESENT, label: "Present", short: "P" },
  { value: SF2_STATUS.ABSENT, label: "Absent", short: "x" },
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "unsaved", label: "Unsaved" },
];

const SESSION_OPTIONS = [
  { value: SF2_SESSION.MORNING, label: "Morning" },
  { value: SF2_SESSION.AFTERNOON, label: "Afternoon" },
];

function statusButtonClass(value, selected) {
  if (!selected) {
    return "border-transparent bg-transparent text-slate-400 hover:bg-white/10 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200";
  }
  if (value === SF2_STATUS.PRESENT) {
    return "border-transparent bg-cnhs-green-dark text-white";
  }
  return "border-transparent bg-red-700/85 text-white";
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
  sectionIsAdviser = false,
}) {
  const [sf2Session, setSf2Session] = useState(suggestedSessionFromClock);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [roster, setRoster] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [isAdviser, setIsAdviser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const { showToast } = useAppToast();

  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;

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

  const markedDates = useMemo(() => {
    const dates = new Set();
    for (const row of roster) {
      for (const mark of row.monthMarks ?? []) {
        const date = String(mark.attendance_date || "").slice(0, 10);
        if (date) dates.add(date);
      }
    }
    return dates;
  }, [roster]);

  useEffect(() => {
    dirtyCallbackRef.current?.(isDirty);
  }, [isDirty]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "unsaved") {
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

  useEffect(() => {
    setPage(1);
  }, [search, filter, sectionId, attendanceDate, sf2Session]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageRows = useMemo(
    () =>
      visibleRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibleRows, safePage]
  );

  const pageGroups = useMemo(() => groupRowsBySex(pageRows), [pageRows]);

  function applySessionChange(next) {
    setSf2Session(next);
  }

  function applyDateChange(next) {
    onAttendanceDateChange?.(next);
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
  }

  function applyVisiblePresent(targets) {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of targets) {
        next[row.studentId] = SF2_STATUS.PRESENT;
      }
      return next;
    });
  }

  function markVisiblePresent() {
    if (!isAdviser || !pageRows.length) return;
    const targets = pageRows;
    const overwriting = targets.filter(
      (row) => row.status === SF2_STATUS.ABSENT
    );
    const scope =
      `This marks ${targets.length} learner(s) on the current page as Present. ` +
      "Other pages are unchanged until you open them or Save.";
    setConfirm({
      title: "Mark this page as Present",
      message: overwriting.length
        ? `${overwriting.length} learner(s) on this page are marked Absent. ${scope}`
        : scope,
      confirmLabel: "Mark Present",
      action: () => applyVisiblePresent(targets),
    });
  }

  async function handleSave() {
    if (!isAdviser) return;
    setSaving(true);
    setError("");
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
      showToast(
        `Saved ${result.data?.saved ?? 0} ${sessionLabel} mark(s). Save the other session too if needed.`,
        {
          action: {
            href: "/teacher/monitoring",
            label: "Next: Academic Monitoring →",
          },
        }
      );
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
  const adviser = Boolean(isAdviser || sectionIsAdviser);

  const th =
    "border border-slate-200 bg-slate-100 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap dark:border-white/10 dark:bg-[#222] dark:text-slate-300";
  const td =
    "border border-slate-200 px-2 py-1 text-center text-[12px] text-slate-800 dark:border-white/10 dark:text-slate-200";
  const stickyLrn =
    "sticky left-0 z-10 w-[14.2857%] bg-white dark:bg-[#1c1c1c]";
  const stickyName =
    "sticky left-[14.2857%] z-10 w-[14.2857%] bg-white shadow-[4px_0_8px_-4px_rgba(15,23,42,0.18)] dark:bg-[#1c1c1c]";

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-800">
            Attendance Monitoring
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {adviser
              ? "Class adviser · Save Morning and Afternoon after roll call."
              : "Daily attendance is marked by the class adviser."}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <div className="text-[11px] font-medium text-slate-500">
            School year
            <AppSelect
              label="School year"
              value={schoolYear}
              onChange={(next) => requestSchoolYearLeave(next)}
              options={schoolYears.length ? schoolYears : ["SY 2026-2027"]}
              className="mt-1 min-w-[8.5rem]"
              triggerClassName="h-8 rounded-lg px-2.5 text-[12px] font-semibold"
            />
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Section
            <AppSelect
              label="Section"
              value={sectionId || ""}
              onChange={(next) => requestSectionLeave(next)}
              placeholder="Select section"
              options={[
                { value: "", label: "Select section" },
                ...sections.map((section) => ({
                  value: section.id,
                  label: `Grade ${section.grade_level} · ${section.section_name}`,
                })),
              ]}
              className="mt-1 min-w-[11rem]"
              triggerClassName="h-8 rounded-lg px-2.5 text-[12px] font-semibold"
            />
          </div>
          <AttendanceDatePicker
            value={attendanceDate}
            onChange={requestDateChange}
            markedDates={markedDates}
            className="min-w-[9.5rem]"
          />
          <div className="text-[11px] font-medium text-slate-500">
            Session
            <div className="mt-1 flex h-8 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
              {SESSION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => requestSessionChange(option.value)}
                  className={cn(
                    "h-full cursor-pointer px-3 text-[12px] font-semibold",
                    sf2Session === option.value
                      ? "bg-cnhs-green-dark text-white"
                      : "bg-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/6"
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
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
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
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1 sm:max-w-xs">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or LRN"
            className="h-8 w-full rounded-lg border border-slate-200 bg-transparent pl-8 pr-3 text-[12px] text-slate-800 dark:border-white/10 dark:text-slate-200"
          />
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                "h-8 cursor-pointer rounded-md px-2.5 text-[11px] font-semibold",
                filter === item.value
                  ? "bg-cnhs-green-dark text-white"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/6"
              )}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            disabled={!isAdviser || !pageRows.length}
            onClick={markVisiblePresent}
            title="Applies to this page only (20 learners). Does not mark the rest of the section."
            className="h-8 cursor-pointer rounded-md px-2.5 text-[11px] font-semibold text-cnhs-green-dark hover:bg-cnhs-green-soft disabled:opacity-50"
          >
            Mark page Present
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading roster…
        </div>
      ) : !sectionId ? (
        <p className="py-8 text-[13px] text-slate-500">
          Choose a section to load enrolled learners.
        </p>
      ) : !roster.length ? (
        <p className="py-8 text-[13px] font-medium text-slate-700">
          No learners enrolled in this section yet.
        </p>
      ) : (
        <div>
          <div className="attendance-roll-scroll overflow-x-auto border border-slate-200 dark:border-white/10">
            <table className="w-full table-fixed border-collapse text-left text-[12px]">
              <colgroup>
                <col className="w-[14.2857%]" />
                <col className="w-[14.2857%]" />
                <col className="w-[14.2857%]" />
                <col className="w-[14.2857%]" />
                <col className="w-[14.2857%]" />
                <col className="w-[14.2857%]" />
                <col className="w-[14.2857%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={cn(th, stickyLrn, "z-20")}>LRN</th>
                  <th className={cn(th, stickyName, "z-20")}>Learner</th>
                  <th className={th}>Sex</th>
                  <th className={th}>{sessionLabel}</th>
                  <th className={th}>{otherLabel}</th>
                  <th className={th}>Month sessions</th>
                  <th className={th}>State</th>
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((group) => (
                  <Fragment key={group.key}>
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-200 bg-slate-50 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-[#222]"
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
                          className="hover:bg-slate-50/80 dark:hover:bg-white/4"
                        >
                          <td
                            className={cn(
                              td,
                              stickyLrn,
                              "font-mono text-[11px] tabular-nums text-slate-500"
                            )}
                          >
                            {row.studentNumber || "—"}
                          </td>
                          <td
                            className={cn(
                              td,
                              stickyName,
                              "truncate font-medium"
                            )}
                          >
                            {row.name}
                          </td>
                          <td className={cn(td, "text-slate-600")}>
                            {row.sex}
                          </td>
                          <td className={cn(td, "p-0")}>
                            <div className="flex h-7 w-full items-stretch">
                              {STATUS_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  disabled={!isAdviser}
                                  onClick={() =>
                                    setStatus(row.studentId, option.value)
                                  }
                                  className={cn(
                                    "inline-flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-60",
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
                                <span className="inline-flex h-7 items-center px-2 text-[10px] font-semibold text-slate-500">
                                  {statusShort(row.status)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className={cn(td, "text-slate-500")}>
                            {row.otherStatus
                              ? statusShort(row.otherStatus)
                              : "—"}
                          </td>
                          <td className={cn(td, "tabular-nums text-slate-600")}>
                            {row.sessionTotals.present}P ·{" "}
                            {row.sessionTotals.absent}A
                          </td>
                          <td className={td}>
                            {row.saved && !row.changed ? (
                              <span className="text-[11px] font-medium text-cnhs-green-dark">
                                Saved
                              </span>
                            ) : row.changed ? (
                              <span className="text-[11px] font-medium text-amber-700">
                                Unsaved
                              </span>
                            ) : (
                              <span
                                className="text-[11px] font-medium text-slate-500"
                                title="On screen only — not stored until you Save this session."
                              >
                                On screen
                              </span>
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
          <MonitoringTablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={visibleRows.length}
            onPageChange={setPage}
          />
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
