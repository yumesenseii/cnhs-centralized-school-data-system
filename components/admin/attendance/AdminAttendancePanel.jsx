"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  invalidateAttendanceAnalyticsCache,
} from "@/lib/supabase/queries/attendance";
import {
  getSchoolDailyMonth,
  getSectionDailyMonth,
} from "@/lib/supabase/queries/attendanceDaily";
import { createClient } from "@/lib/supabase/client";
import { MONTH_LABELS } from "@/lib/attendance/constants";
import { todayIsoDateManila, hasFiveConsecutiveAbsences } from "@/lib/attendance/sf2Daily";
import {
  formatSessionRate,
} from "@/lib/attendance/dailyAnalytics";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";
import { fmtAttendance } from "@/components/attendance/attendanceUiShared";

const ITEMS_PER_PAGE = 10;

function hasDailyRecords(row = {}) {
  const present = Number(row.present || 0);
  const absent = Number(row.absent || 0);
  const marked = Number(row.learnersMarked || 0);
  if (present > 0 || absent > 0 || marked > 0) return true;
  return row.sessionRate != null && Number.isFinite(Number(row.sessionRate));
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
  });
  const [selectedGrade, setSelectedGrade] = useState(""); // "" = All Sections, "7", "8", "9", "10"
  const [currentPage, setCurrentPage] = useState(1);

  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Section detail state
  const [selectedSection, setSelectedSection] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailFilter, setDetailFilter] = useState("follow_up"); // 'follow_up' | 'all'
  const detailPanelRef = useRef(null);

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
          const initialFilters = {
            schoolYear: years[0],
            month: currentMonth,
          };
          setFilters(initialFilters);
          await reload(initialFilters);
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
      if (selectedSection) {
        loadSectionDetail(selectedSection, filters);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  // All school rows from query
  const allRows = useMemo(() => daily?.rows ?? [], [daily]);

  // Dynamic grade options & section counts
  const grades = useMemo(() => {
    const set = new Set(
      sections.map((s) => s.grade_level).filter((g) => g != null)
    );
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [sections]);

  const gradeCounts = useMemo(() => {
    const counts = {};
    for (const r of allRows) {
      const g = String(r.gradeLevel);
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [allRows]);

  const allSectionsCount = allRows.length;

  // Filtered rows based on selected grade
  const filteredRows = useMemo(() => {
    if (!selectedGrade) return allRows;
    return allRows.filter(
      (r) => String(r.gradeLevel) === String(selectedGrade)
    );
  }, [allRows, selectedGrade]);

  // Pagination calculation
  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalFiltered);

  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  // Filter handlers with auto-reset safeguards
  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setCurrentPage(1);
    setSelectedSection(null);
    setDetailData(null);
    reload(nextFilters);
  };

  const handleGradeChange = (gradeValue) => {
    setSelectedGrade(gradeValue);
    setCurrentPage(1);
    setSelectedSection(null);
    setDetailData(null);
  };

  const handleResetFilters = () => {
    const sy = schoolYears[0] || filters.schoolYear;
    const resetFilters = { schoolYear: sy, month: currentMonth };
    setFilters(resetFilters);
    setSelectedGrade("");
    setCurrentPage(1);
    setSelectedSection(null);
    setDetailData(null);
    reload(resetFilters);
  };

  // Section detail loader
  const loadSectionDetail = async (sectionRow, activeFilters = filters) => {
    setSelectedSection(sectionRow);
    setDetailLoading(true);
    setDetailFilter("follow_up");
    try {
      const res = await getSectionDailyMonth({
        sectionId: sectionRow.sectionId,
        schoolYear: activeFilters.schoolYear,
        month: activeFilters.month || currentMonth,
      });
      if (res.error) {
        setError(res.error.message);
        setDetailData(null);
      } else {
        setDetailData(res.data);
      }
    } catch (err) {
      setError(err?.message || "Failed to load section attendance details.");
      setDetailData(null);
    } finally {
      setDetailLoading(false);
      setTimeout(() => {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  };

  // KPI Computations
  const totalSections = allRows.length;
  const sectionsSubmitted = allRows.filter((row) => hasDailyRecords(row)).length;
  const sectionsPending = Math.max(0, totalSections - sectionsSubmitted);

  const sectionsNeedingFollowUp = allRows.filter(
    (row) => (Number(row.learnersNeedingFollowUp) || 0) > 0
  ).length;

  const learnersNeedingFollowUp = daily?.learnersNeedingFollowUp;

  // Detail panel calculations
  const learnersInDetail = useMemo(() => {
    if (!detailData?.learners) return [];
    return detailData.learners.map((learner) => {
      const needsFollowUp = hasFiveConsecutiveAbsences(learner.monthMarks ?? []);
      return {
        ...learner,
        needsFollowUp,
        statusText: needsFollowUp ? "Needs Follow-up" : "Regular Attendance",
      };
    });
  }, [detailData]);

  const followUpLearnersCount = useMemo(() => {
    return learnersInDetail.filter((l) => l.needsFollowUp).length;
  }, [learnersInDetail]);

  const displayedDetailLearners = useMemo(() => {
    if (detailFilter === "follow_up") {
      return learnersInDetail.filter((l) => l.needsFollowUp);
    }
    return learnersInDetail;
  }, [learnersInDetail, detailFilter]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {/* Top Controls: School Year, Month, Reset */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <AppSelect
              label="School year"
              value={filters.schoolYear}
              onChange={(next) => handleFilterChange("schoolYear", next)}
              options={schoolYears}
              className="w-[144px]"
              triggerClassName="h-9 rounded-lg text-[11px] font-semibold"
            />
            <AppSelect
              label="Month"
              value={filters.month}
              onChange={(next) => handleFilterChange("month", next)}
              options={MONTH_LABELS.map((label, i) => ({
                value: String(i + 1),
                label,
              }))}
              className="w-[144px]"
              triggerClassName="h-9 rounded-lg text-[11px] font-semibold"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Top 3 Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Average Attendance */}
        <div className="flex min-h-[110px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Average Attendance
            </p>
            <p className="mt-1.5 text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
              {formatSessionRate(daily?.sessionRate)}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {daily?.monthName ? `${daily.monthName} attendance rate` : "Monthly attendance rate"}
          </p>
        </div>

        {/* 2. Sections Submitted */}
        <div className="flex min-h-[110px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Sections Submitted
            </p>
            <p className="mt-1.5 text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
              {totalSections > 0 ? `${sectionsSubmitted} of ${totalSections}` : "—"}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {sectionsPending > 0
              ? `${sectionsPending} section${sectionsPending === 1 ? "" : "s"} still pending`
              : "All sections submitted"}
          </p>
        </div>

        {/* 3. Learners Needing Follow-up */}
        <div className="flex min-h-[110px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {learnersNeedingFollowUp != null
                  ? "Learners Needing Follow-up"
                  : "Sections Needing Follow-up"}
              </p>
              {(learnersNeedingFollowUp != null ? learnersNeedingFollowUp : sectionsNeedingFollowUp) > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Attention
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-1.5 text-2xl font-bold leading-none tracking-tight tabular-nums",
                (learnersNeedingFollowUp != null ? learnersNeedingFollowUp : sectionsNeedingFollowUp) > 0
                  ? "text-amber-900"
                  : "text-slate-900"
              )}
            >
              {learnersNeedingFollowUp != null
                ? fmtAttendance(learnersNeedingFollowUp)
                : fmtAttendance(sectionsNeedingFollowUp)}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {learnersNeedingFollowUp != null
              ? learnersNeedingFollowUp > 0
                ? "Unique learners requiring attendance follow-up"
                : "No learners requiring follow-up"
              : "Sections requiring attendance follow-up"}
          </p>
        </div>
      </section>

      {/* Main Sections Area with Visible Grade Filter Tabs */}
      <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        {/* Section Heading */}
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            {selectedGrade
              ? `Sections · Grade ${selectedGrade} · ${daily?.monthName || "Current Month"}`
              : `Sections · ${daily?.monthName || "Current Month"}`}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Review submission status for each section and select View to inspect attendance records.
          </p>
        </div>

        {/* Visible Grade Filter Tabs with Section Counts */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <button
            type="button"
            onClick={() => handleGradeChange("")}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all",
              selectedGrade === ""
                ? "bg-cnhs-green-dark text-white shadow-2xs"
                : "border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <span>All Sections</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px]",
                selectedGrade === ""
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {allSectionsCount}
            </span>
          </button>
          {grades.map((g) => {
            const count = gradeCounts[String(g)] ?? 0;
            const isSelected = selectedGrade === String(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => handleGradeChange(String(g))}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all",
                  isSelected
                    ? "bg-cnhs-green-dark text-white shadow-2xs"
                    : "border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <span>Grade {g}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px]",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Section Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5">Section</th>
                <th className="px-4 py-2.5">Attendance</th>
                <th className="px-4 py-2.5">Learners with Records</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && !daily ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
                      Loading sections…
                    </div>
                  </td>
                </tr>
              ) : totalFiltered === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No sections found for this selection.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const recorded = hasDailyRecords(row);
                  const isSelected = selectedSection?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-slate-100 transition-colors",
                        isSelected
                          ? "bg-green-50/40"
                          : "hover:bg-slate-50/60"
                      )}
                    >
                      {/* Section */}
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        G{row.gradeLevel} · {row.sectionName}
                      </td>

                      {/* Attendance */}
                      <td className="px-4 py-3 font-medium text-slate-700 tabular-nums">
                        {recorded ? formatSessionRate(row.sessionRate) : "—"}
                      </td>

                      {/* Learners with Records */}
                      <td className="px-4 py-3 text-slate-700 tabular-nums">
                        {recorded ? fmtAttendance(row.learnersMarked) : "—"}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {recorded ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200/60">
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200/50">
                            Not Submitted
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        {recorded ? (
                          <button
                            type="button"
                            onClick={() => loadSectionDetail(row)}
                            className={cn(
                              "inline-flex h-8 cursor-pointer items-center justify-center rounded-lg px-3.5 text-[11px] font-semibold transition-all shadow-2xs",
                              isSelected
                                ? "bg-cnhs-green-dark text-white ring-2 ring-cnhs-green-dark/20"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-cnhs-green-dark/40 hover:bg-slate-50"
                            )}
                          >
                            {isSelected ? "Viewing" : "View"}
                          </button>
                        ) : (
                          <span className="inline-flex h-8 select-none items-center justify-center rounded-lg border border-slate-200/60 bg-slate-50 px-3 text-[11px] font-medium text-slate-400 cursor-not-allowed">
                            No Record
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Safeguard: only render when sections exist) */}
        {totalFiltered > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3">
            <p className="text-[11px] text-slate-500">
              Showing <span className="font-semibold text-slate-700">{startIndex + 1}–{endIndex}</span> of{" "}
              <span className="font-semibold text-slate-700">{totalFiltered}</span> sections
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[11px] font-medium text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Section Details Panel (Read-only) */}
      {selectedSection ? (
        <section
          ref={detailPanelRef}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
        >
          {/* Header & Close */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                Section Attendance Details
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Grade {selectedSection.gradeLevel} · {selectedSection.sectionName}
              </h3>
              <p className="text-[11px] text-slate-500">
                {daily?.monthName || "Month"} {detailData?.year || filters.schoolYear} · Read-only Principal View
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSection(null);
                setDetailData(null);
              }}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X size={13} />
              Close Details
            </button>
          </div>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
              Loading section attendance records…
            </div>
          ) : !hasDailyRecords(selectedSection) ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
              <p className="text-sm font-semibold text-slate-700">No Attendance Records</p>
              <p className="mt-1 text-xs">
                This section has not submitted daily attendance records for {daily?.monthName || "this month"} yet.
              </p>
            </div>
          ) : (
            <>
              {/* Section Summary Metrics */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Attendance Rate
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                    {formatSessionRate(detailData?.sessionRate ?? selectedSection.sessionRate)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Learners with Records
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
                    {fmtAttendance(detailData?.learners?.length ?? selectedSection.learnersMarked)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Present Marks
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-800 tabular-nums">
                    {fmtAttendance(detailData?.presentSessions ?? selectedSection.present)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Absent Marks
                  </p>
                  <p className="mt-1 text-xl font-bold text-amber-800 tabular-nums">
                    {fmtAttendance(detailData?.absentSessions ?? selectedSection.absent)}
                  </p>
                </div>
              </div>

              {/* Learners Needing Follow-up Table */}
              <div className="space-y-2.5 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Learners Needing Follow-up
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Learners with 5 consecutive school day absences requiring attendance follow-up.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDetailFilter("follow_up")}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1 font-semibold transition-colors",
                        detailFilter === "follow_up"
                          ? "bg-white text-cnhs-green-dark shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Needing Follow-up ({followUpLearnersCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailFilter("all")}
                      className={cn(
                        "cursor-pointer rounded-md px-2.5 py-1 font-semibold transition-colors",
                        detailFilter === "all"
                          ? "bg-white text-cnhs-green-dark shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      All Learners ({learnersInDetail.length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                  <table className="w-full min-w-[500px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-2">Learner</th>
                        <th className="px-4 py-2">Attendance</th>
                        <th className="px-4 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedDetailLearners.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-500">
                            {detailFilter === "follow_up" ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-700">
                                  No learners require attendance follow-up
                                </p>
                                <p className="text-xs text-slate-400">
                                  All enrolled learners in this section currently maintain Regular Attendance.
                                </p>
                              </div>
                            ) : (
                              "No learners recorded in this section."
                            )}
                          </td>
                        </tr>
                      ) : (
                        displayedDetailLearners.map((learner) => (
                          <tr
                            key={learner.studentId}
                            className="border-t border-slate-100 hover:bg-slate-50/60"
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {learner.name}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-700">
                              {formatSessionRate(learner.sessionRate)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {learner.needsFollowUp ? (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                  Needs Follow-up
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                                  Regular Attendance
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
