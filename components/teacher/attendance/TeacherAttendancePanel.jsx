"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import {
  getSectionAttendanceAnalytics,
  importSf2CompAttendance,
  invalidateAttendanceAnalyticsCache,
} from "@/lib/supabase/queries/attendance";
import {
  getCurrentTeacherSession,
  getTeacherClasses,
} from "@/lib/supabase/queries/myClasses";
import { createClient } from "@/lib/supabase/client";
import { MONTH_LABELS } from "@/lib/attendance/constants";
import {
  exportSectionSf2Excel,
  exportSectionSf2Pdf,
} from "@/lib/attendance/exportSf2Report";
import {
  AttendanceFlags,
  AttendanceKpi,
  AttendanceMfTable,
  fmtAttendance,
  runSf2CompImport,
} from "@/components/attendance/attendanceUiShared";
import { cn } from "@/lib/utils";

/**
 * Teacher Attendance — upload SF2 + review my section months.
 */
export default function TeacherAttendancePanel({
  refreshToken = 0,
  onRefreshingChange,
}) {
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [file, setFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const loadSections = useCallback(async () => {
    const session = await getCurrentTeacherSession();
    if (session.error || !session.data?.teacherId) {
      // Fallback: all sections if session missing
      const supabase = createClient();
      const { data } = await supabase
        .from("sections")
        .select("id, section_name, grade_level, school_year")
        .order("grade_level");
      const list = data ?? [];
      setSections(list);
      const years = [
        ...new Set(list.map((s) => s.school_year).filter(Boolean)),
      ].sort((a, b) => String(b).localeCompare(String(a)));
      setSchoolYears(years);
      if (years[0]) setSchoolYear(years[0]);
      if (list[0]) setSectionId(list[0].id);
      return;
    }

    const classesResult = await getTeacherClasses(session.data.teacherId);
    const map = new Map();
    for (const cls of classesResult.data ?? []) {
      const sec = Array.isArray(cls.sections) ? cls.sections[0] : cls.sections;
      if (!sec?.id) continue;
      map.set(sec.id, {
        id: sec.id,
        section_name: sec.section_name,
        grade_level: sec.grade_level,
        school_year: cls.school_year || sec.school_year,
      });
    }
    const list = [...map.values()];
    setSections(list);
    const years = [
      ...new Set(
        [
          ...list.map((s) => s.school_year),
          ...(classesResult.data ?? []).map((c) => c.school_year),
        ].filter(Boolean)
      ),
    ].sort((a, b) => String(b).localeCompare(String(a)));
    setSchoolYears(years.length ? years : ["SY 2026-2027"]);
    const sy = years[0] || "SY 2026-2027";
    setSchoolYear(sy);
    const preferred =
      list.find((s) => s.school_year === sy) || list[0] || null;
    if (preferred) setSectionId(preferred.id);
  }, []);

  const reload = useCallback(async () => {
    if (!sectionId || !schoolYear) {
      setRows([]);
      setLoading(false);
      return;
    }
    onRefreshingChange?.(true);
    setError("");
    // Always load all months for this section so the trend list is complete.
    const result = await getSectionAttendanceAnalytics({
      schoolYear,
      sectionId,
      month: null,
    });
    if (result.error) {
      setError(result.error.message);
      setRows([]);
    } else {
      const nextRows = (result.data?.rows ?? [])
        .slice()
        .sort((a, b) => a.month - b.month);
      setRows(nextRows);
    }
    setLoading(false);
    onRefreshingChange?.(false);
  }, [sectionId, schoolYear, onRefreshingChange]);

  useEffect(() => {
    loadSections().finally(() => setLoading(false));
  }, [loadSections]);

  useEffect(() => {
    if (sectionId && schoolYear) reload();
  }, [sectionId, schoolYear, reload]);

  useEffect(() => {
    if (refreshToken > 0) {
      invalidateAttendanceAnalyticsCache();
      reload();
    }
  }, [refreshToken, reload]);

  const activeRow = useMemo(() => {
    if (!rows.length) return null;
    if (month) {
      return rows.find((r) => Number(r.month) === Number(month)) || rows[0];
    }
    return rows[rows.length - 1] || rows[0];
  }, [rows, month]);

  const monthsWithData = useMemo(() => {
    const set = new Set(rows.map((r) => Number(r.month)));
    return MONTH_LABELS.map((label, i) => ({
      value: String(i + 1),
      label,
      hasData: set.has(i + 1),
    }));
  }, [rows]);

  const sectionOptions = useMemo(
    () =>
      sections.filter(
        (s) => !schoolYear || s.school_year === schoolYear || !s.school_year
      ),
    [sections, schoolYear]
  );

  async function handleImport(e) {
    e?.preventDefault?.();
    setError("");
    setToast("");
    if (!file) {
      setError("Choose an SF2 Excel file first.");
      return;
    }
    setImporting(true);
    try {
      const result = await runSf2CompImport({
        file,
        schoolYear,
        sectionId: sectionId || null,
        importSf2CompAttendance,
        createClient,
      });
      if (result.error) {
        setError(result.error.message);
      } else {
        setToast(
          `Imported ${result.data.importedMonths} month(s): ${
            result.data.months?.join(", ") || ""
          }`
        );
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (result.data.sectionId) setSectionId(result.data.sectionId);
        setMonth("");
        invalidateAttendanceAnalyticsCache();
        await reload();
      }
    } catch (err) {
      setError(err?.message || "Unable to import SF2.");
    } finally {
      setImporting(false);
    }
  }

  async function handleExport(kind) {
    if (!activeRow) return;
    setExporting(true);
    setError("");
    try {
      if (kind === "pdf") exportSectionSf2Pdf(activeRow);
      else await exportSectionSf2Excel(activeRow);
      setToast(
        kind === "pdf"
          ? "Print dialog opened — save as PDF."
          : "Excel report downloaded."
      );
    } catch (err) {
      setError(err?.message || "Unable to export report.");
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

      {/* Primary: Upload */}
      <section className="rounded-2xl border border-cnhs-green-dark/20 bg-gradient-to-br from-white to-cnhs-green-soft/40 p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cnhs-green-dark">
              Step 1 · Encode
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">
              Upload SF2
            </h2>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-cnhs-green-dark ring-1 ring-cnhs-green-dark/20">
            Teacher
          </span>
        </div>

        <form
          onSubmit={handleImport}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="text-[11px] font-medium text-slate-500">
            School year
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800"
            >
              {(schoolYears.length ? schoolYears : ["SY 2026-2027"]).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">
            My section
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800"
            >
              <option value="">Auto from filename</option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  Grade {s.grade_level} · {s.section_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500 sm:col-span-2 lg:col-span-1">
            File
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-[11px] text-slate-600"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={importing}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-60"
            >
              {importing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              Import SF2
            </button>
          </div>
        </form>
      </section>

      {/* Review */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Step 2 · Review
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">
              My section attendance
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
            >
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  G{s.grade_level} · {s.section_name}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
            >
              <option value="">Latest month</option>
              {monthsWithData.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                  {m.hasData ? "" : " (no data)"}
                </option>
              ))}
            </select>
            <span className="hidden items-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline-flex">
              Generate report
            </span>
            <button
              type="button"
              disabled={!activeRow || exporting}
              onClick={() => handleExport("pdf")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText size={13} />
              PDF
            </button>
            <button
              type="button"
              disabled={!activeRow || exporting}
              onClick={() => handleExport("excel")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/30 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-green-50 disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              Excel
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : !activeRow ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
            <CalendarDays size={22} className="mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              No SF2 for this section yet
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Upload your monthly class summary above to see ADA, PA, and
              absences.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-[12px] text-slate-500">
              <span className="font-semibold text-slate-800">
                {activeRow.sectionName}
              </span>{" "}
              · {activeRow.monthName} · {activeRow.schoolDays} school days · First
              Friday {fmtAttendance(activeRow.firstFriday)} · End of month{" "}
              {fmtAttendance(activeRow.endOfMonth)}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <AttendanceKpi
                label="ADA"
                value={fmtAttendance(activeRow.ada)}
                tone="bg-green-50"
              />
              <AttendanceKpi
                label="PA"
                value={fmtAttendance(activeRow.pa, "%")}
                tone="bg-sky-50"
              />
              <AttendanceKpi
                label="Absences"
                value={fmtAttendance(activeRow.absences)}
                tone="bg-orange-50"
              />
              <AttendanceKpi
                label="Late"
                value={fmtAttendance(activeRow.late)}
                tone="bg-amber-50"
              />
              <AttendanceKpi
                label="First Friday"
                value={fmtAttendance(activeRow.firstFriday)}
                tone="bg-violet-50"
              />
              <AttendanceKpi
                label="End of month"
                value={fmtAttendance(activeRow.endOfMonth)}
                tone="bg-slate-100"
              />
            </div>
            <AttendanceFlags row={activeRow} />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <AttendanceMfTable breakdown={activeRow.breakdown} />
              <div className="rounded-lg border border-slate-100 p-3">
                <h3 className="text-[12px] font-semibold text-slate-800">
                  Month trend · this section
                </h3>
                <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {rows.map((r) => {
                    const selected =
                      activeRow && Number(r.month) === Number(activeRow.month);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setMonth(String(r.month))}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[11px]",
                          selected
                            ? "border-cnhs-green-dark/30 bg-green-50 text-slate-800"
                            : "border-slate-100 bg-slate-50/70 text-slate-700 hover:bg-green-50/50"
                        )}
                      >
                        <span className="font-medium">{r.monthName}</span>
                        <span className="text-slate-500">
                          ADA {fmtAttendance(r.ada)} · PA{" "}
                          {fmtAttendance(r.pa, "%")} · Abs{" "}
                          {fmtAttendance(r.absences)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
