"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";

const PASS_COLOR = "#246f54";
const FAIL_COLOR = "#e76f51";

function MiniStat({ label, value, tone }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-slate-100",
          tone
        )}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

/**
 * Lean Summary for Teacher Reports — KPIs live above; this answers next steps.
 * Compact band: donut | legend | intervention (no highest/lowest).
 */
export default function ReportClassPerformanceSummary({
  summary = null,
  gradedShare = null,
}) {
  const passingCount = Number(gradedShare?.passingCount ?? 0);
  const failingCount = Number(gradedShare?.failingCount ?? 0);
  const gradedCount = Number(gradedShare?.gradedCount ?? 0);

  const aral = Number(summary?.aralScreeningCount ?? 0);
  const remedial = Number(summary?.classroomRemedialCount ?? 0);
  const underMonitoring = Number(summary?.learnersUnderMonitoring ?? 0);
  const monitoringCompletion =
    summary?.monitoringCompletionRate == null
      ? null
      : Number(summary.monitoringCompletionRate);
  const interventionEmpty =
    aral === 0 && remedial === 0 && underMonitoring === 0;

  const data = useMemo(() => {
    const rows = [];
    if (passingCount > 0) {
      rows.push({
        name: `Passing (≥${PASSING_GRADE})`,
        value: passingCount,
        color: PASS_COLOR,
      });
    }
    if (failingCount > 0) {
      rows.push({
        name: `Below ${PASSING_GRADE}`,
        value: failingCount,
        color: FAIL_COLOR,
      });
    }
    return rows;
  }, [passingCount, failingCount]);

  const passPct = gradedCount
    ? Math.round((passingCount / gradedCount) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[120px_minmax(0,11rem)_1fr] sm:gap-4">
      {/* Donut */}
      <div className="min-w-0">
        {!gradedCount ? (
          <p className="py-4 text-center text-[11px] text-slate-500 sm:text-left">
            No graded entries yet.
          </p>
        ) : (
          <div className="relative mx-auto h-[120px] w-[120px] sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={52}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {data.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 11,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[15px] font-semibold tabular-nums tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                {passPct}%
              </p>
              <p className="text-[8px] font-medium text-slate-400">
                {gradedCount} graded
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="min-w-0">
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Grades
        </p>
        {!gradedCount ? (
          <p className="text-[11px] text-slate-500">—</p>
        ) : (
          <ul className="space-y-1.5">
            {data.map((item) => (
              <li key={item.name} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="min-w-0 text-[11px] leading-snug">
                  <span className="text-slate-500">{item.name}</span>
                  <span
                    className="ml-1.5 font-semibold tabular-nums"
                    style={{ color: item.color }}
                  >
                    {item.value}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Intervention — fills remaining width */}
      <div className="min-w-0 border-t border-slate-100 pt-3 dark:border-white/5 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Intervention
        </p>
        {interventionEmpty ? (
          <p className="text-[11px] leading-snug text-slate-500">
            No ARAL or classroom remedial this term
            {monitoringCompletion != null
              ? ` · Monitoring ${monitoringCompletion}%`
              : ""}
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4">
            <MiniStat
              label="ARAL"
              value={aral}
              tone={aral > 0 ? "text-cnhs-orange" : undefined}
            />
            <MiniStat
              label="Remedial"
              value={remedial}
              tone={remedial > 0 ? "text-cnhs-orange" : undefined}
            />
            <MiniStat
              label="Monitoring"
              value={
                monitoringCompletion == null
                  ? "—"
                  : `${monitoringCompletion}%`
              }
            />
            <MiniStat
              label="Under watch"
              value={underMonitoring}
              tone={underMonitoring > 0 ? "text-cnhs-orange" : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
