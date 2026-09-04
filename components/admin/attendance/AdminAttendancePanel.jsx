"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
import { createClient } from "@/lib/supabase/client";
import { MONTH_LABELS } from "@/lib/attendance/constants";
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

/**
 * Head Teacher Attendance — view-first school overview.
 * Flow: filters + export → snapshot → sections table → detail → backup import.
 */
export default function AdminAttendancePanel({
  refreshToken = 0,
  onRefreshingChange,
}) {
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState(["SY 2026-2027"]);
  const [filters, setFilters] = useState({
    schoolYear: "SY 2026-2027",
    month: "",
    grade: "",
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
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

      let schoolYear = active.schoolYear || null;
      let month = active.month || null;

      let result = await getSectionAttendanceAnalytics({
        schoolYear,
        month,
      });

      if (
        !result.error &&
        !month &&
        result.data?.rows?.length
      ) {
        const latest = result.data.rows.reduce((best, row) => {
          if (!best) return row;
          const syCmp = String(row.school_year).localeCompare(
            String(best.school_year)
          );
          if (syCmp > 0) return row;
          if (syCmp < 0) return best;
          return row.month >= best.month ? row : best;
        }, null);
        if (latest) {
          month = String(latest.month);
          schoolYear = latest.school_year;
          setFilters((prev) => ({
            ...prev,
            schoolYear,
            month,
          }));
          result = await getSectionAttendanceAnalytics({
            schoolYear,
            month: Number(month),
          });
        }
      }

      if (result.error) {
        setError(result.error.message);
        setAnalytics(null);
      } else {
        setAnalytics(result.data);
        setSelectedId((current) => {
          const rows = result.data?.rows ?? [];
          if (current && rows.some((r) => r.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      }

      const uploadsResult = await listAttendanceUploads(8);
      if (!uploadsResult.error) setUploads(uploadsResult.data ?? []);

      setLoading(false);
      setRefreshing(false);
      onRefreshingChange?.(false);
    },
    [filters, onRefreshingChange]
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
            month: "",
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
    const rows = analytics?.rows ?? [];
    if (!filters.grade) return rows;
    return rows.filter(
      (r) => String(r.gradeLevel) === String(filters.grade)
    );
  }, [analytics, filters.grade]);

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
          `Imported ${result.data.importedMonths} month(s) for ${
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
    setFilters({ schoolYear: sy, month: "", grade: "" });
    reload({ schoolYear: sy, month: "", grade: "" });
  }

  async function handleExport(kind) {
    if (!tableRows.length) {
      setError("No section rows to export for this filter.");
      return;
    }
    setExporting(true);
    setError("");
    try {
      const monthLabel = filters.month
        ? MONTH_LABELS[Number(filters.month) - 1]
        : "All months";
      const snapshot = {
        avgAda: analytics?.avgAda,
        avgPa: analytics?.avgPa,
        totalAbsences: analytics?.totalAbsences,
        flaggedCount: analytics?.flaggedSections?.length ?? 0,
      };
      if (kind === "pdf") {
        exportSchoolSf2Pdf({
          schoolYear: filters.schoolYear,
          monthLabel,
          snapshot,
          rows: tableRows,
        });
      } else {
        await exportSchoolSf2Excel({
          schoolYear: filters.schoolYear,
          monthLabel,
          snapshot,
          rows: tableRows,
        });
      }
      setToast(
        kind === "pdf"
          ? "Print dialog opened — save as PDF."
          : "Excel overview downloaded."
      );
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

      {/* 1) Filters + Export */}
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3">
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
                <option value="">Latest with data</option>
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
                onClick={() => {
                  invalidateAttendanceAnalyticsCache();
                  reload();
                }}
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
                Export
              </span>
              <button
                type="button"
                disabled={exporting || !tableRows.length}
                onClick={() => handleExport("pdf")}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <FileText size={13} />
                PDF
              </button>
              <button
                type="button"
                disabled={exporting || !tableRows.length}
                onClick={() => handleExport("excel")}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/30 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-green-50 disabled:opacity-50"
              >
                <FileSpreadsheet size={13} />
                Excel
              </button>
            </div>
          </div>
        </div>
      </section>

      {loading && !analytics ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading school attendance…
        </div>
      ) : !analytics?.hasData ? (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
          <CalendarDays size={22} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            No SF2 summaries yet
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            When teachers submit SF2 from their Attendance page, sections appear
            here. Backup import is below if needed.
          </p>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Upload size={13} />
            Open backup import
          </button>
        </section>
      ) : (
        <>
          {/* 2) Snapshot KPIs */}
          <section>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AttendanceKpi
                label="Avg ADA"
                value={fmtAttendance(analytics.avgAda)}
                hint="Across sections"
                tone="bg-green-50"
              />
              <AttendanceKpi
                label="Avg PA"
                value={fmtAttendance(analytics.avgPa, "%")}
                tone="bg-sky-50"
              />
              <AttendanceKpi
                label="Total absences"
                value={fmtAttendance(analytics.totalAbsences)}
                tone="bg-orange-50"
              />
              <AttendanceKpi
                label="Flagged sections"
                value={analytics.flaggedSections.length}
                hint="Low PA / NLS / 5c / TO"
                tone="bg-red-50"
              />
            </div>
          </section>

          {analytics.flaggedSections.length ? (
            <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle size={14} />
                <h3 className="text-sm font-semibold">Needs attention</h3>
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-amber-950/80">
                {analytics.flaggedSections.slice(0, 10).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="cursor-pointer text-left hover:underline"
                    >
                      {row.sectionName} · {row.monthName}
                      {row.pa != null && row.pa < 90
                        ? ` · PA ${fmtAttendance(row.pa, "%")}`
                        : ""}
                      {row.nls ? ` · NLS ${row.nls}` : ""}
                      {row.fiveConsecutive
                        ? ` · 5c ${row.fiveConsecutive}`
                        : ""}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 3) All sections table */}
          <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-900">
                All sections
                {filters.month
                  ? ` · ${MONTH_LABELS[Number(filters.month) - 1] || ""}`
                  : ""}
              </h3>
              <p className="text-[11px] text-slate-500">
                Click a row to open section detail below.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    {[
                      "Section",
                      "Month",
                      "Days",
                      "ADA",
                      "PA",
                      "Absences",
                      "Late",
                      "FF",
                      "EOM",
                      "5c",
                      "NLS",
                      "TO",
                      "TI",
                      "Status",
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
                  {tableRows.map((row) => {
                    const status = sectionStatus(row);
                    return (
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
                        <td className="px-2 py-1.5 text-slate-600">
                          {row.monthName}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">
                          {fmtAttendance(row.schoolDays)}
                        </td>
                        <td className="px-2 py-1.5 font-semibold">
                          {fmtAttendance(row.ada)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.pa, "%")}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.absences)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.late)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.firstFriday)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.endOfMonth)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.fiveConsecutive)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.nls)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.transferredOut)}
                        </td>
                        <td className="px-2 py-1.5">
                          {fmtAttendance(row.transferredIn)}
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
            </div>
          </section>

          {/* 4) Section detail (below table) */}
          {detail ? (
            <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Section detail
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold text-slate-900">
                    Grade {detail.gradeLevel} · {detail.sectionName} ·{" "}
                    {detail.monthName}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    {detail.schoolDays} school days · read-only from submitted
                    SF2
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-1 text-[10px] font-semibold",
                    sectionStatus(detail).tone
                  )}
                >
                  {sectionStatus(detail).label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <AttendanceKpi
                  label="ADA"
                  value={fmtAttendance(detail.ada)}
                  tone="bg-green-50"
                />
                <AttendanceKpi
                  label="PA"
                  value={fmtAttendance(detail.pa, "%")}
                  tone="bg-sky-50"
                />
                <AttendanceKpi
                  label="Absences"
                  value={fmtAttendance(detail.absences)}
                  tone="bg-orange-50"
                />
                <AttendanceKpi
                  label="Late"
                  value={fmtAttendance(detail.late)}
                  tone="bg-amber-50"
                />
                <AttendanceKpi
                  label="First Friday"
                  value={fmtAttendance(detail.firstFriday)}
                  tone="bg-violet-50"
                />
                <AttendanceKpi
                  label="End of month"
                  value={fmtAttendance(detail.endOfMonth)}
                  tone="bg-slate-100"
                />
              </div>

              <div className="mt-3">
                <AttendanceFlags row={detail} />
              </div>

              <div className="mt-3 max-w-xl">
                <AttendanceMfTable breakdown={detail.breakdown} />
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* 5) Backup import — collapsed / secondary */}
      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40">
        <button
          type="button"
          onClick={() => setImportOpen((o) => !o)}
          className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left"
        >
          <div>
            <span className="text-sm font-semibold text-slate-700">
              Backup import
            </span>
            <p className="text-[11px] text-slate-500">
              Optional · teachers normally submit from their Attendance page
            </p>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-slate-400 transition-transform",
              importOpen && "rotate-180"
            )}
          />
        </button>
        {importOpen ? (
          <div className="border-t border-slate-200/80 bg-white px-3 pb-3 pt-2">
            <form
              onSubmit={handleImport}
              className="flex flex-wrap items-end gap-2"
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
                  className="mt-1 block text-[11px]"
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
                Import SF2
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
    </div>
  );
}
