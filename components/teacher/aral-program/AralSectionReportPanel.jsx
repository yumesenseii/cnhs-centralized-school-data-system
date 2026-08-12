"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import {
  ARAL_ASSESSMENT_RESULT,
  buildAralSectionReport,
  uniqueAralLearners,
} from "@/lib/monitoring/aralAssessments";
import {
  groupMonitoringRecordsByLearner,
  maxWeekAcrossSection,
} from "@/lib/monitoring/aralSectionFiles";
import { downloadAralSectionReportExcel } from "@/lib/reports/aralAssessmentExcel";
import { listAralAssessmentScoresForSection } from "@/lib/supabase/queries/aralProgram";
import { listMonitoringRecordsForStudents } from "@/lib/supabase/queries/monitoring";
import { cn } from "@/lib/utils";

function formatAvg(pct) {
  if (pct == null) return "—";
  return `${pct.toFixed(1)}%`;
}

function formatScore(score, max) {
  if (score == null) return "—";
  if (max == null) return String(score);
  return `${score}/${max}`;
}

function ResultChip({ value }) {
  if (!value) return <span className="text-[11px] text-slate-400">—</span>;
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

/**
 * Facilitator Report tab: class + individual Pre/Mid/Post summary.
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

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
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

  const weeklySummary = useMemo(() => {
    const roster = uniqueAralLearners(learners);
    const byLearner = groupMonitoringRecordsByLearner(learners, records);
    const maxWeek = maxWeekAcrossSection(byLearner);
    const withEntries = new Set(
      records.map((row) => row.student_id).filter(Boolean)
    );
    const filled = roster.filter((l) => withEntries.has(l.studentId)).length;
    return {
      maxWeek,
      filled,
      total: roster.length,
    };
  }, [learners, records]);

  async function handleDownload() {
    setExporting(true);
    setError("");
    setToast("");
    try {
      const result = await downloadAralSectionReportExcel({
        report,
        gradeSection,
        schoolYear,
        generatedBy: teacherName,
        facilitatorName: teacherName,
        weeklySummary,
      });
      setToast(`Downloaded ${result.filename} (${result.count} learners).`);
    } catch (err) {
      setError(err?.message ?? "Unable to download section report.");
    } finally {
      setExporting(false);
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
      {toast ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-slate-500">
          Summary from saved Pre / Mid / Post scores and weekly progress in this
          section.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Print / PDF coming soon"
            className="inline-flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-400"
          >
            <Printer size={12} />
            Print / PDF
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

      <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <p className="text-[12px] font-semibold text-slate-800">
          Weekly progress
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {weeklySummary.maxWeek
            ? `Week 1–${weeklySummary.maxWeek} · ${weeklySummary.filled} of ${weeklySummary.total} learners with entries`
            : `No weekly files saved yet · ${weeklySummary.total} learners`}
        </p>
      </div>

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
            <p className="mt-2 text-[11px] text-slate-500">
              Scored {phase.scored}/{phase.total}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Passed {phase.passed} · For ARAL {phase.forAral}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-700">
              Avg {formatAvg(phase.avgPercent)}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-[920px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Learner",
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
                  <p className="text-[10px] text-slate-400">
                    {row.studentNumber}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <p className="text-[12px] tabular-nums text-slate-700">
                    {formatScore(row.preScore, row.preMax)}
                  </p>
                  <div className="mt-0.5">
                    <ResultChip value={row.preResult} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <p className="text-[12px] tabular-nums text-slate-700">
                    {formatScore(row.midScore, row.midMax)}
                  </p>
                  <div className="mt-0.5">
                    <ResultChip value={row.midResult} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <p className="text-[12px] tabular-nums text-slate-700">
                    {formatScore(row.postScore, row.postMax)}
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
  );
}
