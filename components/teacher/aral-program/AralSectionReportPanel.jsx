"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ARAL_ASSESSMENT_RESULT,
  buildAralSectionReport,
  uniqueAralLearners,
} from "@/lib/monitoring/aralAssessments";
import { ARAL_WEEK_OPTIONS } from "@/lib/monitoring/aralProgress";
import {
  aralPhaseChartMax,
  buildAralBandChartRows,
  buildAralPhaseChartRows,
  buildAralWeeklyCoverSummary,
  buildAralWeeklyDetailRows,
  countAralTrendGroups,
  formatAralAvgPercent,
  formatAralGeneratedAt,
  formatAralProgramLabel,
  formatAralReportSubject,
  formatAralScore,
  visibleAralTrendGroups,
} from "@/lib/monitoring/aralSectionReport";
import { downloadAralSectionReportExcel } from "@/lib/reports/aralAssessmentExcel";
import { printAralSectionReport } from "@/lib/reports/aralSectionReportPrint";
import { listAralAssessmentScoresForSection } from "@/lib/supabase/queries/aralProgram";
import { listMonitoringRecordsForStudents } from "@/lib/supabase/queries/monitoring";
import { cn } from "@/lib/utils";
import { useAppToast } from "@/components/shared/AppToast";

function ResultChip({ value }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
        value === ARAL_ASSESSMENT_RESULT.PASSED
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-amber-50 text-amber-800 ring-amber-100"
      )}
    >
      {value}
    </span>
  );
}

function TrendChip({ value }) {
  const tone =
    value === "Improved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : value === "Still For ARAL"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : value === "Same"
          ? "bg-slate-100 text-slate-600 ring-slate-200"
          : "bg-slate-50 text-slate-500 ring-slate-100";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
        tone
      )}
    >
      {value || "—"}
    </span>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-[12px] text-slate-400">
      {label}
    </div>
  );
}

function ReportHeader({
  gradeSection,
  schoolYear,
  subject,
  programName,
  teacherName,
  learnerCount,
  generatedAt,
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cnhs-green-dark">
        Cambaog National High School
      </p>
      <p className="mt-0.5 text-[13px] font-semibold text-slate-800">
        {programName} · {schoolYear || "—"} · {gradeSection}
        {subject ? ` · ${subject}` : ""}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Facilitator: {teacherName} · {learnerCount} assigned learner
        {learnerCount === 1 ? "" : "s"} · Generated {generatedAt}
      </p>
    </div>
  );
}

/**
 * Facilitator Report tab: Summary Cover + Detailed (view / download / print).
 */
export default function AralSectionReportPanel({
  group,
  teacherName = "Facilitator",
}) {
  const learners = group?.learners ?? [];
  const batchId = learners[0]?.batchId ?? null;
  const gradeSection = group?.gradeSection ?? "";
  const schoolYear = group?.schoolYear || learners[0]?.schoolYear || "";

  const learnerKey = useMemo(
    () => learners.map((l) => l.studentId).join("|"),
    [learners]
  );

  const [view, setView] = useState("cover");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();
  const [scores, setScores] = useState([]);
  const [records, setRecords] = useState([]);

  const refresh = useCallback(async () => {
    if (!batchId || !gradeSection) {
      setScores([]);
      setRecords([]);
      setLoading(false);
      return;
    }
    const studentIds = learners.map((l) => l.studentId).filter(Boolean);
    const classIds = learners.map((l) => l.sourceClassId).filter(Boolean);
    setLoading(true);
    setError("");
    const [scoreResult, monitoringResult] = await Promise.all([
      listAralAssessmentScoresForSection({
        batchId,
        gradeSection,
        phase: null,
      }),
      studentIds.length
        ? listMonitoringRecordsForStudents({ studentIds, classIds })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (scoreResult.error) {
      setError(scoreResult.error.message);
      setScores([]);
    } else {
      setScores(scoreResult.data ?? []);
    }
    if (monitoringResult.error) {
      setError((prev) => prev || monitoringResult.error.message);
      setRecords([]);
    } else {
      const pairKeys = new Set(
        learners
          .filter((l) => l.studentId && l.sourceClassId)
          .map((l) => `${l.studentId}::${l.sourceClassId}`)
      );
      setRecords(
        (monitoringResult.data ?? []).filter((row) =>
          pairKeys.has(`${row.student_id}::${row.class_id}`)
        )
      );
    }
    setLoading(false);
  }, [batchId, gradeSection, learnerKey, learners]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const report = useMemo(
    () => buildAralSectionReport({ learners, scores }),
    [learners, scores]
  );

  const weeklySummary = useMemo(
    () => buildAralWeeklyCoverSummary(learners, records),
    [learners, records]
  );

  const weeklyRows = useMemo(
    () => buildAralWeeklyDetailRows(learners, records),
    [learners, records]
  );

  const trends = useMemo(
    () => countAralTrendGroups(report.individuals),
    [report.individuals]
  );

  const phaseChart = useMemo(
    () => buildAralPhaseChartRows(report.phases),
    [report.phases]
  );

  const bandChart = useMemo(
    () => buildAralBandChartRows(weeklySummary.bands),
    [weeklySummary.bands]
  );

  const generatedAt = useMemo(() => formatAralGeneratedAt(), [scores, records]);
  const learnerCount = uniqueAralLearners(learners).length;
  const subject = useMemo(() => formatAralReportSubject(learners), [learners]);
  const programName = useMemo(
    () =>
      formatAralProgramLabel({
        batchName: group?.batchName || learners[0]?.batchName,
      }),
    [group, learners]
  );
  const coverTrends = useMemo(() => visibleAralTrendGroups(trends), [trends]);
  const phaseChartMax = useMemo(() => aralPhaseChartMax(phaseChart), [phaseChart]);

  const exportPayload = {
    report,
    gradeSection,
    schoolYear,
    subject,
    programName,
    generatedBy: teacherName,
    facilitatorName: teacherName,
    weeklySummary,
    trends,
    weeklyRows,
  };

  async function handleDownload() {
    setExporting(true);
    setError("");
    try {
      const result = await downloadAralSectionReportExcel(exportPayload);
      showToast(`Downloaded ${result.filename} (Cover + Detailed).`);
    } catch (err) {
      setError(err?.message ?? "Unable to download section report.");
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    setPrinting(true);
    setError("");
    try {
      printAralSectionReport({
        gradeSection,
        schoolYear,
        subject,
        programName,
        facilitatorName: teacherName,
        generatedAt,
        learnerCount,
        phases: report.phases,
        weeklySummary,
        trends,
        individuals: report.individuals,
        weeklyRows,
      });
      showToast("Report downloaded (Cover + Detailed).");
    } catch (err) {
      setError(err?.message ?? "Unable to download report.");
    } finally {
      setPrinting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Building section report…
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
        <div
          role="tablist"
          aria-label="ARAL report view"
          className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-white/10"
        >
          {[
            { id: "cover", label: "Summary Cover" },
            { id: "detailed", label: "Detailed Report" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "relative -mb-px inline-flex h-9 cursor-pointer items-center px-3 text-[12px] font-semibold",
                view === item.id
                  ? "border-b-2 border-cnhs-green-dark text-cnhs-green-dark dark:border-cnhs-green dark:text-cnhs-green"
                  : "border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={printing || !learners.length}
            onClick={handlePrint}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {printing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Download report
          </button>
          <button
            type="button"
            disabled={exporting || !learners.length}
            onClick={handleDownload}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Download Excel
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">View and download only.</p>

      <ReportHeader
        gradeSection={gradeSection}
        schoolYear={schoolYear}
        subject={subject}
        programName={programName}
        teacherName={teacherName}
        learnerCount={learnerCount}
        generatedAt={generatedAt}
      />

      {view === "cover" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {report.phases.map((phase) => (
              <div
                key={phase.phase}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-slate-800">
                    {phase.label}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      phase.status === "Complete"
                        ? "bg-emerald-50 text-emerald-700"
                        : phase.status === "In progress"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {phase.status}
                  </span>
                </div>
                {phase.scored ? (
                  <>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Scored {phase.scored}/{phase.total}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Passed {phase.passed} · For ARAL {phase.forAral}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-slate-700">
                      Avg {formatAralAvgPercent(phase.avgPercent)} ({phase.scored}{" "}
                      scored)
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-400">
                    No saved scores yet
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-[12px] font-semibold text-slate-800">Weekly</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {weeklySummary.hasWeekly
                  ? `Latest Week ${weeklySummary.maxWeek} · ${weeklySummary.filled} of ${weeklySummary.total} learners with a weekly row`
                  : `No weekly entries saved · ${weeklySummary.total} learners`}
              </p>
              {weeklySummary.bands?.some((band) => band.count > 0) ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {weeklySummary.bands.map((band) => (
                    <span
                      key={band.label}
                      className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
                    >
                      {band.label} · {band.count}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-[12px] font-semibold text-slate-800">Trend</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                From saved Pre → Mid → Post only. Incomplete ≠ failed.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {coverTrends.map((row) => (
                  <span
                    key={row.label}
                    className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    {row.label} · {row.count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-100 bg-white p-3">
              <h3 className="text-[12px] font-semibold text-slate-800">
                Pre / Mid / Post — Passed vs For ARAL
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Missing Mid/Post = not started, not zero. Phases without scores
                are not drawn as zero.
              </p>
              {!phaseChart.some((row) => row.Passed != null || row["For ARAL"] != null) ? (
                <EmptyChart label="No saved assessment scores yet" />
              ) : (
                <div className="mt-3 h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={phaseChart}
                      margin={{ top: 8, right: 8, left: -12, bottom: 8 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        domain={[0, Math.max(phaseChartMax, 1)]}
                        ticks={
                          phaseChartMax <= 1
                            ? [0, 1]
                            : Array.from(
                                { length: phaseChartMax + 1 },
                                (_, i) => i
                              )
                        }
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        width={28}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(36, 111, 84, 0.06)" }}
                        contentStyle={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                        formatter={(value, name) => [
                          value == null ? "Not started" : value,
                          name,
                        ]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: "#64748b" }}
                      />
                      <Bar
                        dataKey="Passed"
                        fill="#246F54"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="For ARAL"
                        fill="#C2410C"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3">
              <h3 className="text-[12px] font-semibold text-slate-800">
                Weekly progress bands
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Latest saved week per learner
              </p>
              {!bandChart.length ? (
                <EmptyChart label="No weekly progress bands saved yet" />
              ) : (
                <div className="mt-3 h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={bandChart}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        width={28}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(36, 111, 84, 0.06)" }}
                        contentStyle={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="#246F54"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 rounded-xl border border-dashed border-slate-200 px-3 py-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Prepared by
              </p>
              <p className="mt-2 text-[12px] font-semibold text-slate-800">
                {teacherName}
              </p>
              <p className="text-[11px] text-slate-500">ARAL Facilitator</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Noted by
              </p>
              <p className="mt-2 text-[12px] font-semibold text-slate-800">
                ________________________
              </p>
              <p className="text-[11px] text-slate-500">Head Teacher</p>
            </div>
          </div>

        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[12px] font-semibold text-slate-800">
              A. Assessment
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-[920px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    {[
                      "Learner",
                      "LRN",
                      "Pre",
                      "Mid",
                      "Post",
                      "Trend",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.individuals.map((row) => (
                    <tr
                      key={row.studentId}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-2">
                        <p className="text-[12px] font-semibold text-slate-800">
                          {row.studentName}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-[12px] tabular-nums text-slate-600">
                        {row.studentNumber || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[12px] tabular-nums text-slate-700">
                          {formatAralScore(row.preScore, row.preMax)}
                        </p>
                        <div className="mt-0.5">
                          <ResultChip value={row.preResult} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[12px] tabular-nums text-slate-700">
                          {formatAralScore(row.midScore, row.midMax)}
                        </p>
                        <div className="mt-0.5">
                          <ResultChip value={row.midResult} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-[12px] tabular-nums text-slate-700">
                          {formatAralScore(row.postScore, row.postMax)}
                        </p>
                        <div className="mt-0.5">
                          <ResultChip value={row.postResult} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <TrendChip value={row.trend} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-1 text-[12px] font-semibold text-slate-800">
              B. Weekly
            </p>
            <p className="mb-2 text-[11px] text-slate-500">
              {weeklySummary.hasWeekly
                ? "Blank week = not saved. Not marked Absent."
                : "No weekly sessions saved yet. Leave a week blank if there was no session."}
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-[1080px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    {["Learner", "LRN", ...ARAL_WEEK_OPTIONS.map((w) => `Week ${w}`), "Remarks"].map(
                      (column) => (
                        <th
                          key={column}
                          className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                        >
                          {column}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {weeklyRows.map((row) => (
                    <tr
                      key={row.studentId}
                      className="border-t border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-3 py-2">
                        <p className="text-[12px] font-semibold text-slate-800">
                          {row.studentName}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-[12px] tabular-nums text-slate-600">
                        {row.studentNumber}
                      </td>
                      {ARAL_WEEK_OPTIONS.map((week) => {
                        const cell = row.weeks[week];
                        return (
                          <td
                            key={week}
                            className="px-3 py-2 text-[11px] text-slate-600"
                          >
                            {cell?.label || (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-[11px] text-slate-500">
                        {row.remarks
                          ? row.remarks.length > 80
                            ? `${row.remarks.slice(0, 80)}…`
                            : row.remarks
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
