"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  FileUp,
  History,
  Loader2,
  RefreshCw,
  Upload,
  UserX,
  X,
} from "lucide-react";
import AttendanceGradeBrowse from "@/components/attendance/AttendanceGradeBrowse";
import {
  buildDisplayAnalytics,
  uploadStatusTone,
} from "@/lib/attendance/displayAnalytics";
import {
  getAttendanceAnalytics,
  importSf2Attendance,
  invalidateAttendanceAnalyticsCache,
  listAttendanceUploads,
} from "@/lib/supabase/queries/attendance";
import { createClient } from "@/lib/supabase/client";
import { MONTH_LABELS } from "@/lib/attendance/constants";
import { cn } from "@/lib/utils";

const PANEL_TABS = [
  { id: "atRisk", label: "Learners by Grade", icon: AlertTriangle },
  { id: "upload", label: "Upload SF2", icon: Upload },
  { id: "history", label: "Recent uploads", icon: History },
];

function StatCard({ label, value, icon: Icon, tone, alert = false }) {
  return (
    <div className="relative flex min-w-0 items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      {alert ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
      ) : null}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          tone
        )}
      >
        <Icon size={13} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-none tracking-[-0.03em] text-slate-900 sm:text-lg">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-600">
          {label}
        </p>
      </div>
    </div>
  );
}

/**
 * Shared Attendance Monitoring panel for teacher + admin dashboards/pages.
 * Completely separate from Academic Prediction.
 */
export default function AttendanceMonitoringPanel({
  showUpload = true,
  compact = false,
  refreshToken = 0,
  onRefreshingChange,
}) {
  const [analytics, setAnalytics] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [sections, setSections] = useState([]);
  const [schoolYears, setSchoolYears] = useState(["SY 2026-2027"]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState("atRisk");
  const [filters, setFilters] = useState({
    schoolYear: "SY 2026-2027",
    month: "",
    sectionId: "",
  });
  const [form, setForm] = useState({
    schoolYear: "SY 2026-2027",
    month: String(new Date().getMonth() + 1),
    sectionId: "",
    file: null,
  });

  const reload = useCallback(
    async (overrideFilters = null) => {
      const activeFilters = overrideFilters ?? filters;
      if (!analytics) setLoading(true);
      else setRefreshing(true);
      onRefreshingChange?.(true);
      setError("");

      const analyticsResult = await getAttendanceAnalytics({
        schoolYear: activeFilters.schoolYear || null,
        month: activeFilters.month || null,
      });

      if (analyticsResult.error) {
        setError(analyticsResult.error.message);
        setAnalytics(null);
      } else {
        setAnalytics(analyticsResult.data);
      }

      if (showUpload) {
        const uploadsResult = await listAttendanceUploads(10);
        if (!uploadsResult.error) setUploads(uploadsResult.data ?? []);
      }

      setLoading(false);
      setRefreshing(false);
      onRefreshingChange?.(false);
    },
    [analytics, filters, onRefreshingChange, showUpload]
  );

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (showUpload) {
        const supabase = createClient();
        const { data: sectionRows } = await supabase
          .from("sections")
          .select("id, section_name, grade_level, school_year")
          .order("grade_level");
        if (!cancelled && sectionRows?.length) {
          setSections(sectionRows);
          const years = [
            ...new Set(sectionRows.map((row) => row.school_year).filter(Boolean)),
          ].sort((a, b) => String(b).localeCompare(String(a)));
          if (years.length) setSchoolYears(years);
        }
      }
      if (!cancelled) await reload();
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpload]);

  useEffect(() => {
    if (refreshToken > 0) {
      invalidateAttendanceAnalyticsCache();
      reload();
    }
  }, [refreshToken, reload]);

  const displayAnalytics = useMemo(
    () =>
      buildDisplayAnalytics(analytics?.records ?? [], {
        month: filters.month,
        sectionId: filters.sectionId,
      }),
    [analytics?.records, filters.month, filters.sectionId]
  );

  const visibleTabs = useMemo(
    () =>
      showUpload
        ? PANEL_TABS
        : PANEL_TABS.filter((tab) => tab.id === "atRisk"),
    [showUpload]
  );

  function clearFilters() {
    const cleared = {
      schoolYear: schoolYears[0] || "SY 2026-2027",
      month: "",
      sectionId: "",
    };
    setFilters(cleared);
    invalidateAttendanceAnalyticsCache();
    reload(cleared);
  }

  async function handleImport(e) {
    e.preventDefault();
    setToast("");
    setError("");
    if (!form.file) {
      setError("Choose an SF2 Excel/CSV file first.");
      return;
    }
    setImporting(true);
    try {
      const buffer = await form.file.arrayBuffer();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let profileId = null;
      let teacherId = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        profileId = profile?.id ?? null;
        if (profile?.role === "teacher") {
          const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          teacherId = teacher?.id ?? null;
        }
      }

      const result = await importSf2Attendance({
        fileBuffer: buffer,
        fileName: form.file.name,
        sectionId: form.sectionId || null,
        schoolYear: form.schoolYear,
        month: form.month,
        teacherId,
        profileId,
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        setToast(
          `Imported ${result.data.imported} attendance row(s)${
            result.data.unmatched?.length
              ? ` · ${result.data.unmatched.length} unmatched LRN(s)`
              : ""
          }.`
        );
        setForm((prev) => ({ ...prev, file: null }));
        invalidateAttendanceAnalyticsCache();
        await reload();
        setActiveTab("history");
      }
    } catch (err) {
      setError(err?.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const monthFilterLabel = filters.month
    ? MONTH_LABELS[Number(filters.month) - 1]
    : "All Months";

  return (
    <div className={cn("space-y-3", compact ? "" : "pb-2")}>
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

      {!compact ? (
        <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.schoolYear}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    schoolYear: e.target.value,
                  }))
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
              >
                {schoolYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <select
                value={filters.month}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, month: e.target.value }))
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
              >
                <option value="">All Months</option>
                {MONTH_LABELS.map((label, index) => (
                  <option key={label} value={String(index + 1)}>
                    {label}
                  </option>
                ))}
              </select>
              {showUpload ? (
                <select
                  value={filters.sectionId}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      sectionId: e.target.value,
                    }))
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
                >
                  <option value="">All Sections</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      Grade {section.grade_level} · {section.section_name}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  invalidateAttendanceAnalyticsCache();
                  reload();
                }}
                disabled={loading || refreshing}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
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
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
              >
                <X size={12} />
                Clear
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-400 lg:ml-auto">
              {filters.schoolYear} · {monthFilterLabel}
            </p>
          </div>
        </section>
      ) : null}

      {loading && !analytics ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading attendance analytics…
        </div>
      ) : analytics ? (
        <>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Monthly Attendance Rate"
                value={
                  displayAnalytics.monthlyAttendanceRate != null
                    ? `${displayAnalytics.monthlyAttendanceRate}%`
                    : "—"
                }
                icon={CalendarDays}
                tone="bg-sky-50 text-sky-600"
              />
              <StatCard
                label="Near 20% Absence"
                value={displayAnalytics.nearThresholdCount}
                icon={AlertTriangle}
                tone="bg-red-50 text-red-500"
                alert={displayAnalytics.nearThresholdCount > 0}
              />
              <StatCard
                label="Present Days"
                value={displayAnalytics.presentTotal}
                icon={CheckCircle2}
                tone="bg-emerald-50 text-emerald-600"
              />
              <StatCard
                label="Absent Days"
                value={displayAnalytics.absentTotal}
                icon={UserX}
                tone="bg-orange-50 text-cnhs-orange"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark">
                  <CheckCircle2 size={15} />
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  Present vs Absent
                </h3>
              </div>
              <div className="mt-4 space-y-3">
                {displayAnalytics.presentVsAbsent.map((row) => {
                  const total =
                    (displayAnalytics.presentTotal +
                      displayAnalytics.absentTotal) || 1;
                  const pct = Math.round((row.value / total) * 100);
                  const barColor =
                    row.name === "Present" ? "bg-cnhs-green" : "bg-cnhs-orange";
                  return (
                    <div key={row.name}>
                      <div className="mb-1.5 flex justify-between text-[11px] font-medium text-slate-600">
                        <span>{row.name}</span>
                        <span>
                          {row.value}{" "}
                          <span className="text-slate-400">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn("h-full rounded-full", barColor)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                  <CalendarDays size={15} />
                </span>
                <h3 className="text-sm font-semibold text-slate-900">
                  Attendance Trends
                </h3>
              </div>
              <div className="mt-4 space-y-2">
                {displayAnalytics.trends.length ? (
                  displayAnalytics.trends.map((row) => (
                    <div
                      key={`${row.schoolYear}-${row.month}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[12px]"
                    >
                      <span className="font-medium text-slate-700">
                        {row.monthName} · {row.schoolYear}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          row.rate != null && row.rate < 80
                            ? "bg-amber-50 text-amber-700"
                            : "bg-green-50 text-cnhs-green-dark"
                        )}
                      >
                        {row.rate != null ? `${row.rate}%` : "—"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                    <CalendarDays
                      size={20}
                      className="mx-auto text-slate-300"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      No attendance trends yet.
                    </p>
                    {showUpload ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("upload")}
                        className="mt-2 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                      >
                        Upload an SF2 file to begin
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
          </div>

          {!compact ? (
            <>
              <div
                className="flex items-end gap-4 overflow-x-auto border-b border-slate-200"
                role="tablist"
                aria-label="Attendance monitoring panels"
              >
                {visibleTabs.map((tab) => {
                  const selected = activeTab === tab.id;
                  const Icon = tab.icon;
                  const count =
                    tab.id === "atRisk"
                      ? displayAnalytics.nearThresholdCount
                      : tab.id === "history"
                        ? uploads.length
                        : null;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-[13px] transition-colors",
                        selected
                          ? "border-cnhs-green-dark font-semibold text-cnhs-green-dark"
                          : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                      )}
                    >
                      <Icon size={14} />
                      {tab.label}
                      {count != null ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                            selected
                              ? "bg-cnhs-green-soft text-cnhs-green-dark"
                              : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {activeTab === "atRisk" ? (
                <AttendanceGradeBrowse
                  records={displayAnalytics.records}
                  sectionId={filters.sectionId}
                />
              ) : null}

              {activeTab === "upload" && showUpload ? (
                <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark">
                      <FileUp size={15} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Import SF2 Attendance
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Upload DepEd SF2 Excel or CSV for monthly attendance
                        records.
                      </p>
                    </div>
                  </div>
                  <form
                    onSubmit={handleImport}
                    className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <label className="block text-[11px]">
                      <span className="font-medium text-slate-500">
                        School Year
                      </span>
                      <input
                        value={form.schoolYear}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            schoolYear: e.target.value,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
                      />
                    </label>
                    <label className="block text-[11px]">
                      <span className="font-medium text-slate-500">Month</span>
                      <select
                        value={form.month}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            month: e.target.value,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
                      >
                        {MONTH_LABELS.map((label, index) => (
                          <option key={label} value={String(index + 1)}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px]">
                      <span className="font-medium text-slate-500">
                        Section
                      </span>
                      <select
                        value={form.sectionId}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            sectionId: e.target.value,
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
                      >
                        <option value="">All / unspecified</option>
                        {sections.map((section) => (
                          <option key={section.id} value={section.id}>
                            Grade {section.grade_level} · {section.section_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[11px] sm:col-span-2 lg:col-span-1">
                      <span className="font-medium text-slate-500">SF2 file</span>
                      <div className="mt-1 flex h-10 items-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              file: e.target.files?.[0] ?? null,
                            }))
                          }
                          className="w-full text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-cnhs-green-dark"
                        />
                      </div>
                    </label>
                    <button
                      type="submit"
                      disabled={importing}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors hover:bg-cnhs-green disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 lg:col-span-4"
                    >
                      {importing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FileUp size={14} />
                      )}
                      Import SF2
                    </button>
                  </form>
                </section>
              ) : null}

              {activeTab === "history" && showUpload ? (
                <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                      <History size={15} />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Recent SF2 Uploads
                    </h3>
                  </div>
                  {uploads.length ? (
                    <ul className="mt-3 space-y-2">
                      {uploads.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[11px] text-slate-600"
                        >
                          <CalendarDays
                            size={13}
                            className="shrink-0 text-slate-400"
                          />
                          <span className="font-semibold text-slate-800">
                            {row.file_name || "SF2"}
                          </span>
                          <span>
                            {row.monthName} · {row.school_year} · {row.row_count}{" "}
                            rows
                          </span>
                          <span
                            className={cn(
                              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                              uploadStatusTone(row.status) === "success"
                                ? "bg-green-50 text-cnhs-green-dark"
                                : uploadStatusTone(row.status) === "warning"
                                  ? "bg-amber-50 text-amber-700"
                                  : uploadStatusTone(row.status) === "error"
                                    ? "bg-red-50 text-red-600"
                                    : "bg-slate-100 text-slate-500"
                            )}
                          >
                            {row.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">
                      No SF2 uploads yet. Use the Upload SF2 tab to import a
                      file.
                    </div>
                  )}
                </section>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
