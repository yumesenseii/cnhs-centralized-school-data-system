"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { AttendanceKpi } from "@/components/attendance/attendanceUiShared";
import {
  computeMonthCloseMetrics,
  formatSessionRate,
  monthsWithSavedSessions,
  sessionRatePercent,
  statusShort,
} from "@/lib/attendance/dailyAnalytics";
import {
  exportLearnerDailyExcel,
  exportLearnerDailyPdf,
  exportSectionDailyPdf,
  exportSectionDailyYakalExcel,
} from "@/lib/attendance/exportDailyReport";
import { getSectionDailyMonth } from "@/lib/supabase/queries/attendanceDaily";
import DailyExcelMonthModal from "@/components/teacher/attendance/DailyExcelMonthModal";
import DailyMonthCloseModal from "@/components/teacher/attendance/DailyMonthCloseModal";
import Sf2ExportPreviewModal from "@/components/teacher/attendance/Sf2ExportPreviewModal";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";

function sectionDisplayLabel(section) {
  return `Grade ${section?.grade_level ?? "—"} · ${
    section?.section_name || "Section"
  }`;
}

function closedMetricsFromSummary(summary) {
  if (!summary?.monthClose) return null;
  return computeMonthCloseMetrics({
    presentDays: summary.presentDays?.total || 0,
    schoolDays: summary.monthClose.schoolDays,
    eomM: summary.monthClose.eomM,
    eomF: summary.monthClose.eomF,
  });
}

function previewLearners(summary) {
  return (summary?.learners ?? []).map((row) => ({
    name: row.name,
    studentNumber: row.studentNumber || "—",
    sex: row.sex || "",
    presentSessions: row.presentSessions ?? 0,
    absentSessions: row.absentSessions ?? 0,
    sessionRate: formatSessionRate(row.sessionRate),
    incomplete: row.incompleteDates?.length ?? 0,
  }));
}

function previewSexCounts(summary) {
  const m = { enrolled: 0, present: 0, absent: 0, incomplete: 0 };
  const f = { enrolled: 0, present: 0, absent: 0, incomplete: 0 };
  for (const row of summary?.learners ?? []) {
    const bucket = row.sex === "M" ? m : row.sex === "F" ? f : null;
    if (!bucket) continue;
    bucket.enrolled += 1;
    bucket.present += Number(row.presentSessions) || 0;
    bucket.absent += Number(row.absentSessions) || 0;
    bucket.incomplete += row.incompleteDates?.length ?? 0;
  }
  return {
    m: {
      ...m,
      rate: formatSessionRate(sessionRatePercent(m)),
    },
    f: {
      ...f,
      rate: formatSessionRate(sessionRatePercent(f)),
    },
    total: {
      enrolled: summary?.enrolled ?? m.enrolled + f.enrolled,
      present: summary?.presentSessions ?? m.present + f.present,
      absent: summary?.absentSessions ?? m.absent + f.absent,
      incomplete:
        summary?.incompleteDates?.length ?? m.incomplete + f.incomplete,
      rate: formatSessionRate(summary?.sessionRate),
    },
  };
}

function buildSectionDailyPreview({ schoolYear, summary, months = null }) {
  const multi = (months?.length || 0) > 1;
  const single = months?.length === 1 ? months[0].summary : summary;
  const present = multi
    ? months.reduce((sum, row) => sum + (row.summary?.presentSessions || 0), 0)
    : single.presentSessions;
  const absent = multi
    ? months.reduce((sum, row) => sum + (row.summary?.absentSessions || 0), 0)
    : single.absentSessions;
  const rate = multi
    ? sessionRatePercent({ present, absent })
    : single.sessionRate;
  const metrics = !multi ? closedMetricsFromSummary(single) : null;
  const source = single || summary;
  return {
    kind: "section",
    title: "Attendance working report",
    schoolYear,
    sectionLabel: sectionDisplayLabel(source?.section || summary.section),
    monthName: multi
      ? months.map((row) => row.monthName).join(", ")
      : source?.monthName || summary.monthName,
    enrolled: source?.enrolled ?? summary.enrolled,
    present,
    absent,
    sessionRate: formatSessionRate(rate),
    closed: Boolean(!multi && metrics),
    ada: metrics?.ada,
    attendancePercent: metrics?.attendancePercent,
    learners: previewLearners(source || summary),
    sexCounts: previewSexCounts(source || summary),
    incompleteDates: source?.incompleteDates ?? summary.incompleteDates ?? [],
    note: "From saved Morning and Afternoon marks. Check this copy before signing the official SF2.",
  };
}

function buildLearnerDailyPreview({ schoolYear, summary, learner }) {
  const metrics = closedMetricsFromSummary(summary);
  return {
    kind: "learner",
    title: "Attendance working report",
    schoolYear,
    sectionLabel: sectionDisplayLabel(summary.section),
    learnerName: learner.name,
    studentNumber: learner.studentNumber || "—",
    monthName: summary.monthName,
    present: learner.presentSessions,
    absent: learner.absentSessions,
    sessionRate: formatSessionRate(learner.sessionRate),
    incomplete: learner.incompleteDates?.length ?? 0,
    closed: Boolean(metrics),
    ada: metrics?.ada,
    attendancePercent: metrics?.attendancePercent,
    days: (learner.days ?? []).map((day) => ({
      date: day.date,
      morning: statusShort(day.morning),
      afternoon: statusShort(day.afternoon),
      incomplete: Boolean(day.incomplete),
    })),
    note: "From saved Morning and Afternoon marks. Check this copy before signing the official SF2.",
  };
}

function CompactStat({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900">
        {value ?? "—"}
      </p>
      {hint ? (
        <p className="truncate text-[10px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function DailySectionMonthPanel({
  loading,
  summary,
  schoolYear,
  isAdviser = false,
  onMonthClosed,
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [excelScope, setExcelScope] = useState("this_month");
  const [excelMonth, setExcelMonth] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("pdf");
  const [preview, setPreview] = useState(null);
  const [pendingExcelMonths, setPendingExcelMonths] = useState(null);
  const { showToast } = useAppToast();
  const closedMetrics = closedMetricsFromSummary(summary);

  function openExcelPicker() {
    if (!summary) return;
    setError("");
    setExcelScope("this_month");
    setExcelMonth(summary.month || "");
    setPickerOpen(true);
  }

  async function loadMonthSummary(month) {
    if (Number(month) === Number(summary.month)) return summary;
    const result = await getSectionDailyMonth({
      sectionId: summary.section?.id,
      schoolYear,
      month: Number(month),
    });
    if (result.error) throw result.error;
    if (!result.data) throw new Error("No daily attendance for that month.");
    return result.data;
  }

  function openPdfPreview() {
    if (!summary) return;
    setError("");
    setPendingExcelMonths(null);
    setPreviewFormat("pdf");
    setPreview(buildSectionDailyPreview({ schoolYear, summary }));
    setPreviewOpen(true);
  }

  function closePreview() {
    if (exporting) return;
    setPreviewOpen(false);
    setPreview(null);
    setPendingExcelMonths(null);
  }

  async function handleExcelPickerConfirm() {
    if (!summary) return;
    setExporting(true);
    setError("");
    try {
      const monthsWithData = monthsWithSavedSessions(summary.trend);
      let months = [];

      if (excelScope === "this_month") {
        months = [
          {
            section: summary.section,
            schoolYear,
            month: summary.month,
            monthName: summary.monthName,
            summary,
          },
        ];
      } else if (excelScope === "one_month") {
        const monthSummary = await loadMonthSummary(excelMonth);
        months = [
          {
            section: monthSummary.section || summary.section,
            schoolYear,
            month: monthSummary.month,
            monthName: monthSummary.monthName,
            summary: monthSummary,
          },
        ];
      } else {
        const fetched = await Promise.all(
          monthsWithData.map(async (row) => {
            const monthSummary = await loadMonthSummary(row.month);
            return {
              section: monthSummary.section || summary.section,
              schoolYear,
              month: monthSummary.month,
              monthName: monthSummary.monthName,
              summary: monthSummary,
            };
          })
        );
        months = fetched;
      }

      setPendingExcelMonths(months);
      setPreviewFormat("excel");
      setPreview(
        buildSectionDailyPreview({
          schoolYear,
          summary,
          months,
        })
      );
      setPickerOpen(false);
      setPreviewOpen(true);
    } catch (err) {
      setError(err?.message || "Unable to export.");
    } finally {
      setExporting(false);
    }
  }

  async function handlePreviewConfirm() {
    if (!summary || !preview) return;
    setExporting(true);
    setError("");
    try {
      if (previewFormat === "pdf") {
        exportSectionDailyPdf({
          section: summary.section,
          schoolYear,
          monthName: summary.monthName,
          summary,
        });
      } else {
        await exportSectionDailyYakalExcel({
          section: summary.section,
          schoolYear,
          months: pendingExcelMonths || [],
        });
      }
      setPreviewOpen(false);
      setPreview(null);
      setPendingExcelMonths(null);
    } catch (err) {
      setError(err?.message || "Unable to export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            {summary
              ? `Grade ${summary.section?.grade_level ?? "—"} · ${
                  summary.section?.section_name || "Section"
                } · ${summary.monthName}`
              : "Section attendance"}
          </h2>
          <p className="text-[11px] text-slate-500">
            {summary?.monthClose
              ? "From saved daily marks and month close. Check before signing the official SF2."
              : "From saved Morning and Afternoon marks. Close the month to see official ADA / %."}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {isAdviser ? (
            <button
              type="button"
              disabled={!summary}
              onClick={() => setCloseOpen(true)}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-2.5 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
            >
              {summary?.monthClose
                ? `Review ${summary.monthName}`
                : `Close ${summary?.monthName || "month"}`}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!summary || exporting}
            onClick={openPdfPreview}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-transparent px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/6"
          >
            <FileText size={12} />
            PDF
          </button>
          <button
            type="button"
            disabled={!summary || exporting}
            onClick={openExcelPicker}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-transparent px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/6"
          >
            <FileSpreadsheet size={12} />
            Excel
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] text-red-600">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading section totals…
        </div>
      ) : !summary ? (
        <p className="py-5 text-[12px] text-slate-500">
          Choose a section to see session totals.
        </p>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 border-y border-slate-200 py-2 dark:border-white/10 sm:grid-cols-6">
            <CompactStat label="Enrolled" value={summary.enrolled} />
            <CompactStat
              label="Days AM+PM"
              value={summary.completeDates?.length ?? 0}
              hint="Saved both sessions"
            />
            <CompactStat label="Present" value={summary.presentSessions} />
            <CompactStat label="Absent" value={summary.absentSessions} />
            <CompactStat
              label="Session rate"
              value={formatSessionRate(summary.sessionRate)}
            />
            <CompactStat
              label="Incomplete"
              value={summary.incompleteDates?.length ?? 0}
            />
          </div>
          {closedMetrics ? (
            <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-[12px]">
              <CompactStat
                label="ADA"
                value={closedMetrics.ada ?? "—"}
                hint="After month close"
              />
              <CompactStat
                label="% attendance"
                value={
                  closedMetrics.attendancePercent != null
                    ? `${closedMetrics.attendancePercent}%`
                    : "—"
                }
              />
              <CompactStat
                label="School days"
                value={summary.monthClose.schoolDays}
              />
            </div>
          ) : null}

          {summary.incompleteDates?.length ? (
            <p className="text-[11px] text-amber-800">
              Incomplete: {summary.incompleteDates.join(", ")} — not counted as
              absent.
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="attendance-roll-scroll max-h-64 overflow-auto border border-slate-200 dark:border-white/10">
              <table className="min-w-full border-collapse text-center text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {[
                      "Learner",
                      "P",
                      "A",
                      "Rate",
                      "Inc.",
                    ].map((column) => (
                      <th
                        key={column}
                        className="border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:bg-[#222] dark:text-slate-300"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(summary.learners ?? []).map((row) => (
                    <tr key={row.studentId}>
                      <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800 dark:border-white/10 dark:text-slate-200">
                        {row.name}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 tabular-nums dark:border-white/10">
                        {row.presentSessions}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 tabular-nums dark:border-white/10">
                        {row.absentSessions}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 tabular-nums dark:border-white/10">
                        {formatSessionRate(row.sessionRate)}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 tabular-nums dark:border-white/10">
                        {row.incompleteDates?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!summary.learners?.length ? (
                <p className="px-3 py-4 text-center text-[12px] text-slate-500">
                  No learners enrolled in this section yet.
                </p>
              ) : null}
            </div>

            <div className="border border-slate-200 p-2 dark:border-white/10">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Month trend
              </h3>
              <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto">
                {(summary.trend ?? []).length ? (
                  summary.trend.map((row) => (
                    <div
                      key={row.month}
                      className={cn(
                        "flex items-center justify-between px-2 py-1 text-[11px]",
                        row.month === summary.month
                          ? "bg-cnhs-green-soft text-cnhs-green-dark"
                          : "text-slate-600"
                      )}
                    >
                      <span className="font-medium">{row.monthName}</span>
                      <span className="tabular-nums text-slate-500">
                        {row.present}P · {row.absent}A ·{" "}
                        {formatSessionRate(row.sessionRate)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-center text-[11px] text-slate-500">
                    No saved sessions yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <DailyMonthCloseModal
        open={closeOpen}
        summary={summary}
        schoolYear={schoolYear}
        onCancel={() => setCloseOpen(false)}
        onSaved={() => {
          setCloseOpen(false);
          showToast(
            "Month closed. ADA / % unlocked for this month. Exports remain a working report, not official DepEd SF2."
          );
          onMonthClosed?.();
        }}
      />
      <DailyExcelMonthModal
        open={pickerOpen}
        summary={summary}
        scope={excelScope}
        selectedMonth={excelMonth}
        exporting={exporting}
        onScopeChange={(next) => {
          setExcelScope(next);
          if (next === "one_month") {
            const withData = monthsWithSavedSessions(summary?.trend);
            const currentOk = withData.some(
              (row) => Number(row.month) === Number(excelMonth)
            );
            if (!currentOk) setExcelMonth(withData[0]?.month || "");
          }
        }}
        onSelectedMonthChange={setExcelMonth}
        onCancel={() => {
          if (!exporting) setPickerOpen(false);
        }}
        onConfirm={handleExcelPickerConfirm}
      />
      <Sf2ExportPreviewModal
        open={previewOpen}
        preview={preview}
        format={previewFormat}
        exporting={exporting}
        onClose={closePreview}
        onDownload={handlePreviewConfirm}
      />
    </section>
  );
}

export function DailyLearnerPanel({
  loading,
  summary,
  schoolYear,
  selectedStudentId,
  onSelectLearner,
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("pdf");
  const [preview, setPreview] = useState(null);

  const learner = useMemo(
    () =>
      (summary?.learners ?? []).find(
        (row) => row.studentId === selectedStudentId
      ) ||
      summary?.learners?.[0] ||
      null,
    [summary, selectedStudentId]
  );

  function openLearnerPreview(kind) {
    if (!summary || !learner) return;
    setError("");
    setPreviewFormat(kind);
    setPreview(buildLearnerDailyPreview({ schoolYear, summary, learner }));
    setPreviewOpen(true);
  }

  function closeLearnerPreview() {
    if (exporting) return;
    setPreviewOpen(false);
    setPreview(null);
  }

  async function handleLearnerPreviewConfirm() {
    if (!summary || !learner || !preview) return;
    setExporting(true);
    setError("");
    try {
      const payload = {
        section: summary.section,
        schoolYear,
        monthName: summary.monthName,
        learner,
      };
      if (previewFormat === "pdf") exportLearnerDailyPdf(payload);
      else await exportLearnerDailyExcel(payload);
      setPreviewOpen(false);
      setPreview(null);
    } catch (err) {
      setError(err?.message || "Unable to export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Learner · from daily records
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">
            Learner attendance
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="text-[11px] font-medium text-slate-500">
            Learner
            <AppSelect
              label="Learner"
              value={learner?.studentId || ""}
              onChange={(next) => onSelectLearner?.(next)}
              options={(summary?.learners ?? []).map((row) => ({
                value: row.studentId,
                label: row.name,
              }))}
              className="mt-1 min-w-[14rem]"
              triggerClassName="h-9 rounded-lg text-[12px] font-semibold"
            />
          </div>
          <button
            type="button"
            disabled={!learner || exporting}
            onClick={() => openLearnerPreview("pdf")}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileText size={13} />
            PDF
          </button>
          <button
            type="button"
            disabled={!learner || exporting}
            onClick={() => openLearnerPreview("excel")}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/30 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-green-50 disabled:opacity-50"
          >
            <FileSpreadsheet size={13} />
            Excel
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-[12px] text-red-600">{error}</p>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading learner history…
        </div>
      ) : !learner ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No learners enrolled in this section yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <AttendanceKpi
              label="Present sessions"
              value={learner.presentSessions}
              tone="bg-green-50"
            />
            <AttendanceKpi
              label="Absent sessions"
              value={learner.absentSessions}
              tone="bg-orange-50"
            />
            <AttendanceKpi
              label="Session rate"
              value={formatSessionRate(learner.sessionRate)}
              tone="bg-sky-50"
            />
            <AttendanceKpi
              label="Incomplete days"
              value={learner.incompleteDates?.length ?? 0}
              tone="bg-amber-50"
            />
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-left text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-1.5 font-semibold">Date</th>
                  <th className="px-2 py-1.5 font-semibold">Morning</th>
                  <th className="px-2 py-1.5 font-semibold">Afternoon</th>
                  <th className="px-2 py-1.5 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {(learner.days ?? []).map((day) => (
                  <tr key={day.date} className="border-t border-slate-50">
                    <td className="px-2 py-1.5 font-semibold text-slate-800">
                      {day.date}
                    </td>
                    <td className="px-2 py-1.5">
                      {day.morning ? statusShort(day.morning) : "AM not saved"}
                    </td>
                    <td className="px-2 py-1.5">
                      {day.afternoon
                        ? statusShort(day.afternoon)
                        : "PM not saved"}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500">
                      {day.incomplete ? "Incomplete — not counted as absent" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!learner.days?.length ? (
              <p className="px-3 py-6 text-center text-[12px] text-slate-500">
                No saved sessions for this learner this month.
              </p>
            ) : null}
          </div>
        </div>
      )}
      <Sf2ExportPreviewModal
        open={previewOpen}
        preview={preview}
        format={previewFormat}
        exporting={exporting}
        onClose={closeLearnerPreview}
        onDownload={handleLearnerPreviewConfirm}
      />
    </section>
  );
}
