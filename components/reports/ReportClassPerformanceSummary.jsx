"use client";

import { cn } from "@/lib/utils";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";

function MetricCard({ label, value, tone, emphasize = false, soft = false }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        emphasize
          ? "border-orange-200 bg-orange-50/60"
          : soft
            ? "border-transparent bg-slate-50/40"
            : "border-slate-100 bg-slate-50/70"
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-[-0.02em]",
          emphasize ? "text-[20px]" : "text-[18px]",
          soft && !emphasize ? "text-slate-600" : null,
          tone || "text-slate-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function GroupLabel({ children }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
      {children}
    </p>
  );
}

function PassShareBar({ passingCount, failingCount, gradedCount }) {
  if (!gradedCount) return null;
  const passPct = Math.round((passingCount / gradedCount) * 100);
  const failPct = 100 - passPct;

  return (
    <div className="space-y-1.5">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        {passingCount > 0 ? (
          <div
            className="h-full bg-cnhs-green-dark"
            style={{ width: `${passPct}%` }}
          />
        ) : null}
        {failingCount > 0 ? (
          <div
            className="h-full bg-cnhs-orange"
            style={{ width: `${failPct}%` }}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cnhs-green-dark" />
          Passing (≥{PASSING_GRADE}) {passingCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cnhs-orange" />
          Below {PASSING_GRADE} {failingCount}
        </span>
      </div>
    </div>
  );
}

/**
 * Grouped class-performance summary for Teacher Reports Summary tab.
 * Numbers stay primary; optional thin pass/fail share bar only.
 */
export default function ReportClassPerformanceSummary({
  summary = null,
  gradedShare = null,
}) {
  const totalClasses = summary?.totalClasses ?? 0;
  const totalLearners = summary?.totalStudents ?? 0;
  const avgGrade =
    summary?.averageClassGrade == null
      ? "—"
      : String(summary.averageClassGrade);
  const passingRate =
    summary?.passingRate == null ? null : Number(summary.passingRate);
  const passingLabel =
    passingRate == null ? "—" : `${passingRate}%`;
  const highest = summary?.highestSubject || null;
  const lowest = summary?.lowestSubject || null;
  const singleSubject =
    Boolean(highest) &&
    (!lowest || String(highest).toLowerCase() === String(lowest).toLowerCase());

  const aral = Number(summary?.aralScreeningCount ?? 0);
  const remedial = Number(summary?.classroomRemedialCount ?? 0);
  const underMonitoring = Number(summary?.learnersUnderMonitoring ?? 0);
  const monitoringCompletion =
    summary?.monitoringCompletionRate == null
      ? null
      : Number(summary.monitoringCompletionRate);
  const interventionEmpty = aral === 0 && remedial === 0 && underMonitoring === 0;

  const passingLow =
    passingRate != null && passingRate < 75 && (gradedShare?.gradedCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div>
        <GroupLabel>Scope</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Total classes" value={totalClasses} soft />
          <MetricCard label="Total learners" value={totalLearners} soft />
        </div>
      </div>

      <div>
        <GroupLabel>Academic</GroupLabel>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="Average class grade" value={avgGrade} soft />
            <MetricCard
              label="Passing rate"
              value={passingLabel}
              tone={
                passingLow
                  ? "text-cnhs-orange"
                  : passingRate != null && passingRate >= 75
                    ? "text-cnhs-green-dark"
                    : undefined
              }
              emphasize={passingLow}
            />
          </div>

          {singleSubject && highest ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                Subject
              </p>
              <p className="mt-1 text-[13px] font-semibold text-slate-700">
                {highest}
              </p>
            </div>
          ) : highest || lowest ? (
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                label="Highest performing"
                value={highest || "—"}
                soft
              />
              <MetricCard
                label="Lowest performing"
                value={lowest || "—"}
                soft
              />
            </div>
          ) : null}

          <PassShareBar
            passingCount={gradedShare?.passingCount ?? 0}
            failingCount={gradedShare?.failingCount ?? 0}
            gradedCount={gradedShare?.gradedCount ?? 0}
          />
        </div>
      </div>

      <div>
        <GroupLabel>Intervention</GroupLabel>
        {interventionEmpty ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4">
            <p className="text-[13px] font-semibold text-slate-700">
              No ARAL or monitoring cases this term
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Classroom remedial and follow-up will appear here when flagged.
            </p>
            {monitoringCompletion != null ? (
              <p className="mt-2 text-[11px] font-medium text-slate-500">
                Monitoring completion: {monitoringCompletion}%
              </p>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard
              label="ARAL learners"
              value={aral}
              tone={aral > 0 ? "text-cnhs-orange" : undefined}
              emphasize={aral > 0}
            />
            <MetricCard
              label="Classroom remedial"
              value={remedial}
              tone={remedial > 0 ? "text-cnhs-orange" : undefined}
              emphasize={remedial > 0}
            />
            <MetricCard
              label="Monitoring completion"
              value={
                monitoringCompletion == null
                  ? "—"
                  : `${monitoringCompletion}%`
              }
              soft
            />
            <MetricCard
              label="Under monitoring"
              value={underMonitoring}
              tone={underMonitoring > 0 ? "text-cnhs-orange" : undefined}
              emphasize={underMonitoring > 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}
