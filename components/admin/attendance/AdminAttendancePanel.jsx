"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  invalidateAttendanceAnalyticsCache,
} from "@/lib/supabase/queries/attendance";
import {
  getSchoolDailyMonth,
  getSectionDailyMonth,
} from "@/lib/supabase/queries/attendanceDaily";
import { createClient } from "@/lib/supabase/client";
import { MONTH_LABELS, monthLabel } from "@/lib/attendance/constants";
import { todayIsoDateManila } from "@/lib/attendance/sf2Daily";
import { useAppToast } from "@/components/shared/AppToast";
import {
  formatSessionRate,
  sessionRatePercent,
} from "@/lib/attendance/dailyAnalytics";
import Sf2ExportPreviewModal from "@/components/teacher/attendance/Sf2ExportPreviewModal";
import {
  exportSchoolDailyExcel,
  exportSchoolDailyPdf,
} from "@/lib/attendance/exportDailyReport";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";
import {
  AttendanceKpi,
  fmtAttendance,
} from "@/components/attendance/attendanceUiShared";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SCHOOL_YEAR_MONTHS = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

function hasDailyRecords(row = {}) {
  const present = Number(row.present || 0);
  const absent = Number(row.absent || 0);
  const marked = Number(row.learnersMarked || 0);
  if (present > 0 || absent > 0 || marked > 0) return true;
  return row.sessionRate != null && Number.isFinite(Number(row.sessionRate));
}

function pickFirstRecordedSection(rows = []) {
  return rows.find((row) => hasDailyRecords(row)) ?? rows[0] ?? null;
}

function padSchoolYearTrend(trend = []) {
  const byMonth = new Map(
    (trend ?? []).map((row) => [Number(row.month), row])
  );
  return SCHOOL_YEAR_MONTHS.map((month) => {
    const existing = byMonth.get(month);
    const name = monthLabel(month);
    const hasRecords =
      existing != null &&
      existing.sessionRate != null &&
      Number.isFinite(Number(existing.sessionRate));
    return {
      month,
      monthName: name,
      shortName: String(name).slice(0, 3),
      present: existing?.present ?? 0,
      absent: existing?.absent ?? 0,
      sessionRate: hasRecords ? Number(existing.sessionRate) : null,
      rate: hasRecords ? Number(existing.sessionRate) : null,
      hasRecords,
    };
  });
}

function MonthAttendanceTrend({ trend = [], activeMonth }) {
  const data = padSchoolYearTrend(trend);
  const hasAny = data.some((row) => row.hasRecords);

  if (!hasAny) {
    return (
      <p className="py-8 text-center text-[12px] text-slate-500">
        No daily records this school year yet.
      </p>
    );
  }

  return (
    <div className="h-[180px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="shortName"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            dy={4}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            width={36}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            cursor={{
              stroke: "#40916c",
              strokeWidth: 1,
              strokeOpacity: 0.45,
              fill: "transparent",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const row = payload[0].payload;
              return (
                <div
                  className="rounded-lg px-2.5 py-1.5 text-[11px] shadow-sm"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--card-foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {row.hasRecords
                    ? `${row.monthName} · ${formatSessionRate(row.sessionRate)} · ${fmtAttendance(row.present)} present marks · ${fmtAttendance(row.absent)} absent marks`
                    : `${row.monthName} · No daily marks`}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#40916c"
            strokeWidth={2.25}
            connectNulls={false}
            dot={(props) => {
              const { cx, cy, payload, key } = props;
              if (!payload?.hasRecords || cx == null || cy == null) {
                return <g key={key} />;
              }
              const selected =
                Number(payload.month) === Number(activeMonth);
              return (
                <circle
                  key={key}
                  cx={cx}
                  cy={cy}
                  r={selected ? 5 : 3.5}
                  fill={selected ? "#1b4332" : "#40916c"}
                  stroke="var(--card)"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{
              r: 6,
              fill: "#40916c",
              stroke: "#1b4332",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();
  const [selectedId, setSelectedId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("pdf");
  const [preview, setPreview] = useState(null);
  const [pendingExport, setPendingExport] = useState(null);

  const reload = useCallback(
    async (override = null) => {
      const active = override ?? filters;
      setRefreshing(true);
      onRefreshingChange?.(true);
      setError("");

      const schoolYear = active.schoolYear || null;
      const month = active.month || currentMonth;

      const dailyResult = await getSchoolDailyMonth({
        schoolYear,
        month: Number(month),
      });

      if (dailyResult.error) {
        setError(dailyResult.error.message);
        setDaily(null);
      } else {
        setDaily(dailyResult.data);
        setSelectedId((current) => {
          const rows = dailyResult.data?.rows ?? [];
          const currentRow = rows.find((r) => r.id === current);
          if (currentRow && hasDailyRecords(currentRow)) return current;
          return pickFirstRecordedSection(rows)?.id ?? null;
        });
      }

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

  const learnersWithRecords = useMemo(
    () =>
      tableRows.reduce(
        (sum, row) =>
          sum + (hasDailyRecords(row) ? Number(row.learnersMarked) || 0 : 0),
        0
      ),
    [tableRows]
  );

  const sectionsWaiting = tableRows.filter((row) => !hasDailyRecords(row)).length;
  const sectionsTotal = tableRows.length;

  const detail = useMemo(() => {
    if (!tableRows.length) return null;
    return (
      tableRows.find((r) => r.id === selectedId) ||
      pickFirstRecordedSection(tableRows)
    );
  }, [tableRows, selectedId]);

  const grades = useMemo(() => {
    const set = new Set(
      sections.map((s) => s.grade_level).filter((g) => g != null)
    );
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [sections]);

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

  async function openDailyPreview(kind) {
    if (!daily || !tableRows.length || previewBusy || exporting) return;
    setError("");
    setPreviewBusy(true);
    try {
      const present = tableRows.reduce((sum, row) => sum + (row.present || 0), 0);
      const absent = tableRows.reduce((sum, row) => sum + (row.absent || 0), 0);
      const scopeLabel = filters.grade
        ? `Grade ${filters.grade}`
        : "All sections";
      const sectionsWithData = tableRows.filter((row) => hasDailyRecords(row));
      const results = await Promise.all(
        sectionsWithData.map((row) =>
          getSectionDailyMonth({
            sectionId: row.sectionId,
            schoolYear: filters.schoolYear,
            month: daily.month || filters.month,
          })
        )
      );
      const learners = [];
      const fetchErrors = [];
      results.forEach((result, index) => {
        if (result.error) {
          fetchErrors.push(result.error);
          return;
        }
        const sectionRow = sectionsWithData[index];
        const sectionLabel = `G${sectionRow.gradeLevel} · ${sectionRow.sectionName}`;
        for (const row of result.data?.learners ?? []) {
          const presentSessions = row.presentSessions ?? 0;
          const absentSessions = row.absentSessions ?? 0;
          const otherSessions = row.otherSessions ?? 0;
          if (presentSessions + absentSessions + otherSessions <= 0) continue;
          learners.push({
            sectionLabel,
            name: row.name,
            studentNumber: row.studentNumber || "—",
            presentSessions,
            absentSessions,
            sessionRate: row.sessionRate,
          });
        }
      });
      learners.sort((a, b) => {
        const absCmp = (b.absentSessions || 0) - (a.absentSessions || 0);
        if (absCmp !== 0) return absCmp;
        return String(a.name).localeCompare(String(b.name), "en");
      });
      if (fetchErrors.length) {
        setError(
          fetchErrors[0]?.message ||
            "Some learner names could not be loaded for this report."
        );
      }
      setPendingExport({ kind: "daily", format: kind });
      setPreviewFormat(kind);
      setPreview({
        kind: "school",
        title: "Attendance working report",
        schoolYear: filters.schoolYear,
        sectionLabel: scopeLabel,
        monthName: daily.monthName,
        present,
        absent,
        sessionRate: formatSessionRate(sessionRatePercent({ present, absent })),
        sessionRateValue: sessionRatePercent({ present, absent }),
        sectionCount: tableRows.length,
        sectionsWithData: sectionsWithData.length,
        rows: tableRows,
        learners,
      });
      setPreviewOpen(true);
    } catch (err) {
      setError(err?.message || "Unable to load the attendance preview.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handlePreviewConfirm() {
    if (!pendingExport || pendingExport.kind !== "daily") return;
    setExporting(true);
    setError("");
    try {
      if (!daily) return;
      const present =
        preview?.present ??
        tableRows.reduce((sum, row) => sum + (row.present || 0), 0);
      const absent =
        preview?.absent ??
        tableRows.reduce((sum, row) => sum + (row.absent || 0), 0);
      const payload = {
        schoolYear: filters.schoolYear,
        monthName: daily.monthName,
        summary: {
          ...daily,
          rows: preview?.rows ?? tableRows,
          learners: preview?.learners ?? [],
          scopeLabel:
            preview?.sectionLabel ||
            (filters.grade ? `Grade ${filters.grade}` : "All sections"),
          sectionCount: preview?.sectionCount ?? tableRows.length,
          sectionsWithData:
            preview?.sectionsWithData ??
            tableRows.filter((row) => hasDailyRecords(row)).length,
          presentSessions: present,
          absentSessions: absent,
          sessionRate:
            preview?.sessionRateValue ??
            sessionRatePercent({ present, absent }),
        },
      };
      if (pendingExport.format === "pdf") exportSchoolDailyPdf(payload);
      else await exportSchoolDailyExcel(payload);
      showToast(
        pendingExport.format === "pdf"
          ? "Report downloaded."
          : "Excel downloaded."
      );
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

      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              label="School year"
              value={filters.schoolYear}
              onChange={(next) =>
                setFilters((prev) => ({
                  ...prev,
                  schoolYear: next,
                }))
              }
              options={schoolYears}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-[11px] font-semibold"
            />
            <AppSelect
              label="Month"
              value={filters.month}
              onChange={(next) =>
                setFilters((prev) => ({ ...prev, month: next }))
              }
              options={MONTH_LABELS.map((label, i) => ({
                value: String(i + 1),
                label,
              }))}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-[11px] font-semibold"
            />
            <AppSelect
              label="Grade"
              value={filters.grade}
              onChange={(next) =>
                setFilters((prev) => ({ ...prev, grade: next }))
              }
              options={[
                { value: "", label: "All grades" },
                ...grades.map((g) => ({
                  value: String(g),
                  label: `Grade ${g}`,
                })),
              ]}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-[11px] font-semibold"
            />
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
              Download this month
            </span>
            <button
              type="button"
              disabled={exporting || previewBusy || !tableRows.length}
              onClick={() => openDailyPreview("pdf")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FileText size={13} />
              {previewBusy ? <Loader2 size={12} className="animate-spin" /> : null}
              PDF
            </button>
            <button
              type="button"
              disabled={exporting || previewBusy || !tableRows.length}
              onClick={() => openDailyPreview("excel")}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/30 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-green-50 disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              {previewBusy ? <Loader2 size={12} className="animate-spin" /> : null}
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
              From teachers’ daily Morning and Afternoon marks. Not the official
              SF2.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AttendanceKpi
                label="Attendance"
                value={formatSessionRate(daily?.sessionRate)}
                hint="This month"
                tone="bg-sky-50"
              />
              <AttendanceKpi
                label="Pending"
                value={fmtAttendance(sectionsWaiting)}
                hint={
                  sectionsWaiting > 0
                    ? `${sectionsWaiting} of ${sectionsTotal} sections this month`
                    : "All sections submitted"
                }
                tone="bg-slate-100"
              />
              <AttendanceKpi
                label="Absent marks"
                value={fmtAttendance(daily?.absentSessions)}
                hint="Morning and afternoon, not unique learners"
                tone="bg-orange-50"
              />
              <AttendanceKpi
                label="Learners with records"
                value={fmtAttendance(learnersWithRecords)}
                hint="Unique learners"
                tone="bg-green-50"
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Sections · {daily?.monthName || "month"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Compare sections for this month. Click a row to select it.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    {[
                      "Section",
                      "Present (AM + PM)",
                      "Absent (AM + PM)",
                      "Attendance",
                      "Learners with records",
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
                    const recorded = hasDailyRecords(row);
                    return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "cursor-pointer border-t border-slate-100 text-[12px] text-slate-800",
                        selectedId === row.id
                          ? "bg-green-50/50 dark:bg-cnhs-green-dark/25 dark:text-slate-100"
                          : "hover:bg-slate-50/80 dark:hover:bg-white/5 dark:text-slate-200"
                      )}
                    >
                      <td className="px-2 py-1.5 font-semibold">
                        G{row.gradeLevel} · {row.sectionName}
                      </td>
                      <td className="px-2 py-1.5">
                        {recorded ? fmtAttendance(row.present) : "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {recorded ? fmtAttendance(row.absent) : "—"}
                      </td>
                      <td className="px-2 py-1.5 font-semibold">
                        {recorded
                          ? formatSessionRate(row.sessionRate)
                          : "Not submitted"}
                      </td>
                      <td className="px-2 py-1.5">
                        {recorded
                          ? fmtAttendance(row.learnersMarked)
                          : "Not submitted"}
                      </td>
                    </tr>
                    );
                  })}
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
              <h3 className="text-base font-semibold text-slate-900">
                Grade {detail.gradeLevel} · {detail.sectionName} ·{" "}
                {detail.monthName}
              </h3>
              <p className="mt-1 text-[12px] text-slate-600">
                {hasDailyRecords(detail)
                  ? `${fmtAttendance(detail.present)} present (AM + PM) · ${fmtAttendance(detail.absent)} absent · ${formatSessionRate(detail.sessionRate)} attendance · ${fmtAttendance(detail.learnersMarked)} learners with records`
                  : "This section has not been submitted this month."}
              </p>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <h3 className="text-[12px] font-semibold text-slate-800">
              Attendance by month
            </h3>
            <p className="text-[11px] text-slate-500">
              Attendance % from saved morning and afternoon marks. Months
              without records are gaps, not 0%.
            </p>
            <MonthAttendanceTrend
              trend={daily?.trend ?? []}
              activeMonth={daily?.month}
            />
          </section>
        </>
      )}

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
