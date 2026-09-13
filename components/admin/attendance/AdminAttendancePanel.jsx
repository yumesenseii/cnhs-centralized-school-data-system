"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  getSectionAttendanceAnalytics,
  importSf2CompAttendance,
  invalidateAttendanceAnalyticsCache,
  listAttendanceUploads,
} from "@/lib/supabase/queries/attendance";
import { getSchoolDailyMonth } from "@/lib/supabase/queries/attendanceDaily";
import { createClient } from "@/lib/supabase/client";
import { MONTH_LABELS } from "@/lib/attendance/constants";
import { todayIsoDateManila } from "@/lib/attendance/sf2Daily";
import {
  formatSessionRate,
  sessionRatePercent,
} from "@/lib/attendance/dailyAnalytics";
import Sf2ExportPreviewModal from "@/components/teacher/attendance/Sf2ExportPreviewModal";
import {
  exportSchoolDailyExcel,
  exportSchoolDailyPdf,
} from "@/lib/attendance/exportDailyReport";
import {
  exportSchoolSf2Excel,
  exportSchoolSf2Pdf,
} from "@/lib/attendance/exportSf2Report";
import { cn } from "@/lib/utils";
import {
  AttendanceFlags,
  AttendanceKpi,
  AttendanceMfTable,
  fmtAttendance,
  runSf2CompImport,
  sectionStatus,
} from "@/components/attendance/attendanceUiShared";

export default function AdminAttendancePanel({
  refreshToken = 0,
  onRefreshingChange,
}) {
  const currentMonth = String(Number(todayIsoDateManila().slice(5, 7)));
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState(["SY 2026-2027"]);
  const [filters, setFilters] = useState({
    schoolYear: "SY 2026-2027",
    month: currentMonth,
    grade: "",
  });
  const [daily, setDaily] = useState(null);
  const [archive, setArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("pdf");
  const [preview, setPreview] = useState(null);
  const [pendingExport, setPendingExport] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [form, setForm] = useState({
    schoolYear: "SY 2026-2027",
    sectionId: "",
    file: null,
  });

  const reload = useCallback(
    async (override = null) => {
      const active = override ?? filters;
      setRefreshing(true);
      onRefreshingChange?.(true);
      setError("");

      const schoolYear = active.schoolYear || null;
      const month = active.month || currentMonth;

      const [dailyResult, archiveResult, uploadsResult] = await Promise.all([
        getSchoolDailyMonth({
          schoolYear,
          month: Number(month),
        }),
        getSectionAttendanceAnalytics({
          schoolYear,
          month: Number(month),
        }),
        listAttendanceUploads(8),
      ]);

      if (dailyResult.error) {
        setError(dailyResult.error.message);
        setDaily(null);
      } else {
        setDaily(dailyResult.data);
        setSelectedId((current) => {
          const rows = dailyResult.data?.rows ?? [];
          if (current && rows.some((r) => r.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      }

      if (!archiveResult.error) setArchive(archiveResult.data);
      if (!uploadsResult.error) setUploads(uploadsResult.data ?? []);

      setLoading(false);
      setRefreshing(false);
      onRefreshingChange?.(false);
    },
    [filters, onRefreshingChange, currentMonth]
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const supabase = createClient();
      const { data: sectionRows } = await supabase
        .from("sections")
        .select("id, section_name, grade_level, school_year")
        .order("grade_level");
      if (!cancelled && sectionRows?.length) {
        setSections(sectionRows);
        const years = [
          ...new Set(sectionRows.map((r) => r.school_year).filter(Boolean)),
        ].sort((a, b) => String(b).localeCompare(String(a)));
        if (years.length) {
          setSchoolYears(years);
          setFilters((prev) => ({ ...prev, schoolYear: years[0] }));
          setForm((prev) => ({ ...prev, schoolYear: years[0] }));
          await reload({
            schoolYear: years[0],
            month: currentMonth,
            grade: "",
          });
          return;
        }
      }
      if (!cancelled) await reload();
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshToken > 0) {
      invalidateAttendanceAnalyticsCache();
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const tableRows = useMemo(() => {
    const rows = daily?.rows ?? [];
    if (!filters.grade) return rows;
    return rows.filter(
      (r) => String(r.gradeLevel) === String(filters.grade)
    );
  }, [daily, filters.grade]);

  const detail = useMemo(() => {
    if (!tableRows.length) return null;
    return tableRows.find((r) => r.id === selectedId) || tableRows[0];
  }, [tableRows, selectedId]);

  const grades = useMemo(() => {
    const set = new Set(
      sections.map((s) => s.grade_level).filter((g) => g != null)
    );
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [sections]);

  const archiveRows = useMemo(() => {
    const rows = archive?.rows ?? [];
    if (!filters.grade) return rows;
    return rows.filter(
      (r) => String(r.gradeLevel) === String(filters.grade)
    );
  }, [archive, filters.grade]);

  async function handleImport(e) {
    e?.preventDefault?.();
    setError("");
    setToast("");
    if (!form.file) {
      setError("Choose an SF2 Excel file first.");
      return;
    }
    setImporting(true);
    try {
      const result = await runSf2CompImport({
        file: form.file,
        schoolYear: form.schoolYear,
        sectionId: form.sectionId || null,
        importSf2CompAttendance,
        createClient,
      });
      if (result.error) setError(result.error.message);
      else {
        setToast(
          `Archived ${result.data.importedMonths} month(s) for ${
            result.data.sectionHint || "section"
          }`
        );
        setForm((prev) => ({ ...prev, file: null }));
        invalidateAttendanceAnalyticsCache();
        await reload({
          ...filters,
          schoolYear: form.schoolYear,
        });
      }
    } catch (err) {
      setError(err?.message || "Unable to import.");
    } finally {
      setImporting(false);
    }
  }

  function clearFilters() {
    const sy = schoolYears[0] || filters.schoolYear;
    const next = { schoolYear: sy, month: currentMonth, grade: "" };
    setFilters(next);
    reload(next);
  }

  function closePreview() {
    if (exporting) return;
    setPreviewOpen(false);
    setPreview(null);
    setPendingExport(null);
  }

  function openDailyPreview(kind) {
    if (!daily || !tableRows.length) return;
    setError("");
    const present = tableRows.reduce((sum, row) => sum + (row.present || 0), 0);
    const absent = tableRows.reduce((sum, row) => sum + (row.absent || 0), 0);
    const enrolled = tableRows.reduce(
      (sum, row) => sum + (row.learnersMarked || 0),
      0
    );
    setPendingExport({ kind: "daily", format: kind });
    setPreviewFormat(kind);
    setPreview({
      title: "Attendance working report",
      schoolYear: filters.schoolYear,
      sectionLabel: filters.grade ? `Grade ${filters.grade}` : "All sections",
      monthName: daily.monthName,
      enrolled,
      present,
      absent,
      sessionRate: formatSessionRate(sessionRatePercent({ present, absent })),
      closed: false,
    });
    setPreviewOpen(true);
  }

  function openArchivePreview(kind) {
    if (!archiveRows.length) {
      setError("No archived SF2-COMP rows for this filter.");
      return;
    }
    setError("");
    const monthLabel = filters.month
      ? MONTH_LABELS[Number(filters.month) - 1]
      : "All months";
    setPendingExport({ kind: "archive", format: kind });
    setPreviewFormat(kind);
    setPreview({
      title: "Archived SF2-COMP snapshot",
      schoolYear: filters.schoolYear,
      sectionLabel: filters.grade ? `Grade ${filters.grade}` : "All sections",
      monthName: monthLabel,
      enrolled: archiveRows.length,
      present: null,
      absent: archive?.totalAbsences,
      sessionRate: "—",
      closed: true,
      ada: archive?.avgAda,
      attendancePercent: archive?.avgPa,
      note: "From uploaded SF2-COMP. Not daily AM/PM records. Working report, not official DepEd SF2.",
    });
    setPreviewOpen(true);
  }

  async function handlePreviewConfirm() {
    if (!pendingExport) return;
    setExporting(true);
    setError("");
    try {
      if (pendingExport.kind === "daily") {
        if (!daily) return;
        const payload = {
          schoolYear: filters.schoolYear,
          monthName: daily.monthName,
          summary: { ...daily, rows: tableRows },
        };
        if (pendingExport.format === "pdf") exportSchoolDailyPdf(payload);
        else await exportSchoolDailyExcel(payload);
        setToast(
          pendingExport.format === "pdf"
            ? "Print dialog opened — save as PDF."
            : "Excel downloaded."
        );
      } else {
        const monthLabel = filters.month
          ? MONTH_LABELS[Number(filters.month) - 1]
          : "All months";
        const snapshot = {
          avgAda: archive?.avgAda,
          avgPa: archive?.avgPa,
          totalAbsences: archive?.totalAbsences,
          flaggedCount: archive?.flaggedSections?.length ?? 0,
        };
        if (pendingExport.format === "pdf") {
          exportSchoolSf2Pdf({
            schoolYear: filters.schoolYear,
            monthLabel,
            snapshot,
            rows: archiveRows,
          });
        } else {
          await exportSchoolSf2Excel({
            schoolYear: filters.schoolYear,
            monthLabel,
            snapshot,
            rows: archiveRows,
          });
        }
        setToast(
          pendingExport.format === "pdf"
            ? "Archive print dialog opened."
            : "Archive Excel downloaded."
        );
      }
      setPreviewOpen(false);
      setPreview(null);
      setPendingExport(null);
    } catch (err) {
      setError(err?.message || "Unable to export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filters.schoolYear}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  schoolYear: e.target.value,
                }))
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
              aria-label="School year"
            >
              {schoolYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={filters.month}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, month: e.target.value }))
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
              aria-label="Month"
            >
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={String(i + 1)}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filters.grade}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, grade: e.target.value }))
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
              aria-label="Grade"
            >
              <option value="">All grades</option>
              {grades.map((g) => (
                <option key={g} value={String(g)}>
                  Grade {g}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => reload()}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={12}
                className={refreshing ? "animate-spin" : ""}
              />
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              From daily records
            </span>
            <button
              type="button"
              disabled={exporting || !tableRows.length}
              onClick={() => openDailyPreview("pdf")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText size={13} />
              PDF
            </button>
            <button
              type="button"
              disabled={exporting || !tableRows.length}
              onClick={() => openDailyPreview("excel")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/30 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-green-50 disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              Excel
            </button>
          </div>
        </div>
      </section>

      {loading && !daily ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading school attendance…
        </div>
      ) : (
        <>
          <section>
            <p className="mb-2 text-[11px] text-slate-500">
              Live totals from saved Morning / Afternoon records. Not official
              ADA, PA, First Friday, or End of month.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AttendanceKpi
                label="Session rate"
                value={formatSessionRate(daily?.sessionRate)}
                hint="Present ÷ (present + absent)"
                tone="bg-sky-50"
              />
              <AttendanceKpi
                label="Present sessions"
                value={fmtAttendance(daily?.presentSessions)}
                tone="bg-green-50"
              />
              <AttendanceKpi
                label="Absent sessions"
                value={fmtAttendance(daily?.absentSessions)}
                tone="bg-orange-50"
              />
              <AttendanceKpi
                label="Sections with data"
                value={`${daily?.sectionsWithData ?? 0} / ${daily?.sectionCount ?? 0}`}
                tone="bg-slate-100"
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Sections · {daily?.monthName || "month"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Sorted comparison from daily attendance records.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    {[
                      "Section",
                      "Present sessions",
                      "Absent sessions",
                      "Session rate",
                      "Learners marked",
                    ].map((col) => (
                      <th
                        key={col}
                        className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "cursor-pointer border-t border-slate-100 text-[12px] hover:bg-slate-50/80",
                        selectedId === row.id && "bg-green-50/50"
                      )}
                    >
                      <td className="px-2 py-1.5 font-semibold text-slate-800">
                        G{row.gradeLevel} · {row.sectionName}
                      </td>
                      <td className="px-2 py-1.5">{fmtAttendance(row.present)}</td>
                      <td className="px-2 py-1.5">{fmtAttendance(row.absent)}</td>
                      <td className="px-2 py-1.5 font-semibold">
                        {formatSessionRate(row.sessionRate)}
                      </td>
                      <td className="px-2 py-1.5">
                        {fmtAttendance(row.learnersMarked)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!tableRows.length ? (
                <p className="px-3 py-8 text-center text-[12px] text-slate-500">
                  No daily attendance saved for this month yet.
                </p>
              ) : null}
            </div>
          </section>

          {detail ? (
            <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Section detail · daily records
              </p>
              <h3 className="mt-0.5 text-base font-semibold text-slate-900">
                Grade {detail.gradeLevel} · {detail.sectionName} ·{" "}
                {detail.monthName}
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <AttendanceKpi
                  label="Present sessions"
                  value={fmtAttendance(detail.present)}
                  tone="bg-green-50"
                />
                <AttendanceKpi
                  label="Absent sessions"
                  value={fmtAttendance(detail.absent)}
                  tone="bg-orange-50"
                />
                <AttendanceKpi
                  label="Session rate"
                  value={formatSessionRate(detail.sessionRate)}
                  tone="bg-sky-50"
                />
                <AttendanceKpi
                  label="Learners marked"
                  value={fmtAttendance(detail.learnersMarked)}
                  tone="bg-slate-100"
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <h3 className="text-[12px] font-semibold text-slate-800">
              Month trend · school-wide saved sessions
            </h3>
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {(daily?.trend ?? []).length ? (
                daily.trend.map((row) => (
                  <div
                    key={row.month}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px]",
                      row.month === daily.month
                        ? "border-cnhs-green-dark/30 bg-green-50"
                        : "border-slate-100 bg-slate-50/70"
                    )}
                  >
                    <span className="font-medium">{row.monthName}</span>
                    <span className="text-slate-500">
                      {row.present}P · {row.absent}A ·{" "}
                      {formatSessionRate(row.sessionRate)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-[12px] text-slate-500">
                  No saved daily sessions this school year yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
        <button
          type="button"
          onClick={() => setArchiveOpen((open) => !open)}
          className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Archive
            </p>
            <h2 className="text-sm font-semibold text-slate-700">
              Previous SF2-COMP upload history
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              ADA, PA, First Friday, and End of month below are from uploaded
              Yakal files. They are not from daily AM/PM records.
            </p>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-slate-400 transition-transform",
              archiveOpen && "rotate-180"
            )}
          />
        </button>
        {archiveOpen ? (
          <div className="border-t border-slate-200/80 bg-white px-3 pb-3 pt-2">
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={exporting || !archiveRows.length}
                onClick={() => openArchivePreview("pdf")}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <FileText size={13} />
                Archive PDF
              </button>
              <button
                type="button"
                disabled={exporting || !archiveRows.length}
                onClick={() => openArchivePreview("excel")}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <FileSpreadsheet size={13} />
                Archive Excel
              </button>
            </div>

            {!archive?.hasData ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <CalendarDays size={22} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No archived SF2-COMP yet
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[880px] w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/80">
                      {["Section", "Month", "ADA", "PA", "Absences", "Status"].map(
                        (col) => (
                          <th
                            key={col}
                            className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {archiveRows.map((row) => {
                      const status = sectionStatus(row);
                      return (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 text-[12px]"
                        >
                          <td className="px-2 py-1.5 font-semibold text-slate-800">
                            G{row.gradeLevel} · {row.sectionName}
                          </td>
                          <td className="px-2 py-1.5">{row.monthName}</td>
                          <td className="px-2 py-1.5">
                            {fmtAttendance(row.ada)}
                          </td>
                          <td className="px-2 py-1.5">
                            {fmtAttendance(row.pa, "%")}
                          </td>
                          <td className="px-2 py-1.5">
                            {fmtAttendance(row.absences)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={cn(
                                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                status.tone
                              )}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {archiveRows[0] ? (
                  <div className="mt-3">
                    <AttendanceFlags row={archiveRows[0]} />
                    <AttendanceMfTable breakdown={archiveRows[0].breakdown} />
                  </div>
                ) : null}
              </div>
            )}

            <form
              onSubmit={handleImport}
              className="mt-4 flex flex-wrap items-end gap-2"
            >
              <label className="text-[11px] font-medium text-slate-500">
                School year
                <select
                  value={form.schoolYear}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      schoolYear: e.target.value,
                    }))
                  }
                  className="mt-1 block h-9 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold"
                >
                  {schoolYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-medium text-slate-500">
                Section
                <select
                  value={form.sectionId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      sectionId: e.target.value,
                    }))
                  }
                  className="mt-1 block h-9 min-w-[140px] rounded-lg border border-slate-200 px-2 text-[11px] font-semibold"
                >
                  <option value="">Auto from filename</option>
                  {sections
                    .filter(
                      (s) =>
                        !form.schoolYear || s.school_year === form.schoolYear
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        G{s.grade_level} · {s.section_name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-[11px] font-medium text-slate-500">
                File
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      file: e.target.files?.[0] || null,
                    }))
                  }
                  className="mt-1 block h-9 w-full min-w-[12rem] cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-slate-700"
                />
              </label>
              <button
                type="submit"
                disabled={importing}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {importing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                Import to archive
              </button>
            </form>
            {uploads.length ? (
              <ul className="mt-3 space-y-1 text-[11px] text-slate-500">
                {uploads.slice(0, 5).map((u) => (
                  <li key={u.id}>
                    {u.file_name} · {u.section?.section_name || "—"} ·{" "}
                    {u.row_count} month(s)
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>
      <Sf2ExportPreviewModal
        open={previewOpen}
        preview={preview}
        format={previewFormat}
        exporting={exporting}
        onClose={closePreview}
        onDownload={handlePreviewConfirm}
      />
    </div>
  );
}
