"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatSessionRate,
  sessionRatePercent,
} from "@/lib/attendance/dailyAnalytics";
import { monthLabel } from "@/lib/attendance/constants";
import { fmtAttendance } from "@/components/attendance/attendanceUiShared";

/** Jun–Mar school year (same order as Attendance Monitoring). */
const SCHOOL_YEAR_MONTHS = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

function hasDailyRecords(row = {}) {
  const present = Number(row.present || 0);
  const absent = Number(row.absent || 0);
  const marked = Number(row.learnersMarked || 0);
  return present > 0 || absent > 0 || marked > 0;
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

function DailyMonthTrend({ trend = [], activeMonth }) {
  const data = padSchoolYearTrend(trend);
  const hasAny = data.some((row) => row.hasRecords);

  if (!hasAny) {
    return (
      <p className="py-4 text-center text-[12px] text-slate-500">
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
                <div className="rounded-lg border border-slate-200 bg-[var(--card)] px-2.5 py-1.5 text-[11px] text-[var(--card-foreground)] shadow-sm dark:border-white/5">
                  {row.hasRecords
                    ? `${row.monthName} · ${formatSessionRate(row.sessionRate)} · ${fmtAttendance(row.present)} present · ${fmtAttendance(row.absent)} absent`
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
              const selected = Number(payload.month) === Number(activeMonth);
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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-[var(--card)] px-2.5 py-1.5 text-[11px] shadow-sm dark:border-white/5">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="tabular-nums text-slate-500 dark:text-slate-400">
        {payload[0].value == null ? "—" : `${payload[0].value}%`}
      </p>
    </div>
  );
}

/**
 * Daily AM/PM snapshot. HT hides uploaded SF2 archive trend (showSf2Archive=false).
 * Teacher Reports may pass showSf2Archive to keep SF2 panel.
 */
export default function ReportAttendancePanel({
  daily = null,
  attendance = null,
  chartData = [],
  monitoringHref = "/attendance",
  showSf2Archive = false,
}) {
  const rows = daily?.rows ?? [];
  const waiting = rows.filter((row) => !hasDailyRecords(row)).length;
  const learnersWithRecords = rows.reduce(
    (sum, row) =>
      sum + (hasDailyRecords(row) ? Number(row.learnersMarked) || 0 : 0),
    0
  );
  const present = Number(daily?.presentSessions || 0);
  const absent = Number(daily?.absentSessions || 0);
  const dailyRate =
    daily?.sessionRate != null
      ? formatSessionRate(daily.sessionRate)
      : formatSessionRate(sessionRatePercent({ present, absent }));
  const hasDaily = Boolean(daily) && rows.some((row) => hasDailyRecords(row));
  const showDaily = daily != null;
  const sf2Chart = Array.isArray(chartData) && chartData.length > 0;

  const dailyMetrics = [
    {
      label: "Attendance",
      value: hasDaily ? dailyRate : "—",
      hint: daily?.monthName
        ? `${daily.monthName} · AM + PM marks`
        : "This month",
    },
    {
      label: "Pending",
      value: fmtAttendance(waiting),
      hint:
        rows.length > 0
          ? `${waiting} of ${rows.length} sections this month`
          : "Sections waiting",
    },
    {
      label: "Absent marks",
      value: hasDaily ? fmtAttendance(absent) : "—",
      hint: "Morning and afternoon, not unique learners",
    },
    {
      label: "Learners with records",
      value: hasDaily ? fmtAttendance(learnersWithRecords) : "—",
      hint: "Unique learners with a saved mark",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {showDaily ? "Daily attendance" : "Attendance"}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {showDaily
              ? "From teachers’ Morning and Afternoon marks. Not unique people per day."
              : "Open Attendance Monitoring for daily marks and uploaded SF2."}
          </p>
        </div>
        <Link
          href={monitoringHref}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
        >
          Open Attendance Monitoring
        </Link>
      </div>

      {showDaily ? (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-slate-200 py-2 dark:border-white/5 sm:grid-cols-4">
            {dailyMetrics.map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  {item.label}
                </p>
                <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {item.value}
                </p>
                {item.hint ? (
                  <p className="truncate text-[10px] text-slate-400">
                    {item.hint}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {hasDaily ? (
            <p className="text-[11px] text-slate-500">
              Learners with records = saved marks this month, not the same as
              Learners above.
            </p>
          ) : (
            <p className="text-[12px] text-slate-500">
              No daily marks for this month yet.{" "}
              <Link
                href={monitoringHref}
                className="font-semibold text-cnhs-green-dark hover:underline"
              >
                Open Attendance Monitoring
              </Link>
            </p>
          )}

          <section className="rounded-xl border border-slate-200 px-3 py-3 dark:border-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Attendance by month
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              From saved Morning and Afternoon marks. Months without records are
              gaps, not 0%.
            </p>
            <div className="mt-2">
              <DailyMonthTrend
                trend={daily?.trend ?? []}
                activeMonth={daily?.month}
              />
            </div>
          </section>
        </>
      ) : null}

      {showSf2Archive ? (
        <section className="rounded-xl border border-dashed border-slate-200 px-3 py-3 dark:border-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Uploaded SF2
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Official figures from uploaded forms. Separate from daily marks and
            from academic risk.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Avg ADA
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {attendance?.avgAda == null ? "—" : String(attendance.avgAda)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Avg PA
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {attendance?.avgPa == null &&
                attendance?.monthlyAttendanceRate == null
                  ? "—"
                  : attendance?.avgPa != null
                    ? `${attendance.avgPa}%`
                    : `${attendance.monthlyAttendanceRate}%`}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Absences
              </p>
              <p className="text-[13px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {fmtAttendance(
                  attendance?.totalAbsences ?? attendance?.absentTotal ?? 0
                )}
              </p>
            </div>
          </div>
          {sf2Chart ? (
            <div className="mt-3 h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#246f54"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="text-[11px] text-slate-500">
          Uploaded SF2 archive is on Attendance Monitoring.
        </p>
      )}
    </div>
  );
}
