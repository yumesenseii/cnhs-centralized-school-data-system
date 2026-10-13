"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { demographicsAreConsistent, gradeEntriesFrom } from "@/components/ui/dashboard-1";

const MALE_COLOR = "#0b6b3f"; // CNHS deep green primary series
const FEMALE_COLOR = "#52b788"; // Softer complementary green series
const NOT_AVAILABLE = "Not available";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      role="tooltip"
      aria-live="polite"
      className="rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xs min-w-[170px] pointer-events-none transition-opacity duration-150"
    >
      <div className="border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between gap-3">
        <p className="text-[14px] font-bold tracking-tight text-[#123d2c]">
          {item.grade}
        </p>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Current SY
        </span>
      </div>
      <div className="space-y-1.5 text-[12px]">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: MALE_COLOR }}
              aria-hidden="true"
            />
            Male:
          </span>
          <span className="font-bold text-slate-900">
            {item.male != null ? item.male.toLocaleString() : NOT_AVAILABLE}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span
              className="inline-block h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: FEMALE_COLOR }}
              aria-hidden="true"
            />
            Female:
          </span>
          <span className="font-bold text-slate-900">
            {item.female != null ? item.female.toLocaleString() : NOT_AVAILABLE}
          </span>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-slate-100 pt-1.5 text-[13px]">
          <span className="font-semibold text-slate-700">Total:</span>
          <span className="font-bold text-[#123d2c]">
            {item.total != null ? item.total.toLocaleString() : NOT_AVAILABLE}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function EnrollmentByGradeChart({ data }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeGradeIndex, setActiveGradeIndex] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const consistent = demographicsAreConsistent(data);
  const entries = consistent ? gradeEntriesFrom(data) : [];
  const chartData = entries.map((entry) => ({
    grade: `Grade ${entry.grade}`,
    gradeNumber: entry.grade,
    male: entry.male,
    female: entry.female,
    total: entry.total,
  }));

  if (!consistent || !chartData.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
        <p className="text-sm font-medium text-slate-500">
          Enrollment by Grade Level
        </p>
        <p className="mt-1 text-xs text-slate-400">{NOT_AVAILABLE}</p>
      </div>
    );
  }

  // Custom label renderer placed on the first bar (male), centered above the grouped pair
  const renderGradeTotalLabel = (props) => {
    const { x, y, width, height, index } = props;
    if (!chartData || !chartData[index]) return null;
    const entry = chartData[index];
    if (entry.total == null) return null;

    // Male bar spans [x, x + width]. Female bar spans [x + width, x + 2 * width].
    // Center point of the pair is x + width.
    const centerX = x + width;

    // Y-axis is inverted (0 is top). Taller bar has the smaller y.
    const baselineY = y + height;
    const pixelsPerUnit = entry.male > 0 ? height / entry.male : 0;
    const femaleHeight = (entry.female || 0) * pixelsPerUnit;
    const femaleY = baselineY - femaleHeight;
    const peakY = Math.min(y, femaleY);

    return (
      <text
        x={centerX}
        y={Math.max(16, peakY - 8)}
        textAnchor="middle"
        fill="#1e293b"
        fontSize={12}
        fontWeight={700}
        className="font-bold select-none"
      >
        {entry.total.toLocaleString()}
      </text>
    );
  };

  const handleChartClick = (state) => {
    if (state && typeof state.activeTooltipIndex === "number") {
      setActiveGradeIndex((prev) =>
        prev === state.activeTooltipIndex ? null : state.activeTooltipIndex
      );
    }
  };

  return (
    <div
      role="region"
      aria-label="Enrollment by Grade Level grouped bar chart"
      tabIndex={0}
      className="w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 rounded-xl"
      onKeyDown={(e) => {
        if (e.key === "Escape") setActiveGradeIndex(null);
      }}
    >
      <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-[#123d2c] sm:text-lg">
            Enrollment by Grade Level
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500 sm:text-[13px]">
            Male and female learner distribution for the current school year.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600 sm:text-[12px]">
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: MALE_COLOR }}
              aria-hidden="true"
            />
            <span>Male</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-xs"
              style={{ backgroundColor: FEMALE_COLOR }}
              aria-hidden="true"
            />
            <span>Female</span>
          </div>
          <span className="hidden text-[11px] text-slate-400 md:inline">
            · Total shown above bars
          </span>
        </div>
      </div>

      <div className="mt-5 h-[270px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 32, right: 12, left: -16, bottom: 4 }}
            barGap={4}
            barCategoryGap="28%"
            onClick={handleChartClick}
          >
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="grade"
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              width={34}
              domain={[0, (dataMax) => Math.ceil((dataMax + 30) / 20) * 20]}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(11, 107, 63, 0.04)" }}
              active={activeGradeIndex !== null ? true : undefined}
              defaultIndex={activeGradeIndex !== null ? activeGradeIndex : undefined}
            />
            <Bar
              dataKey="male"
              name="Male"
              fill={MALE_COLOR}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={380}
              animationEasing="ease-out"
              className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
            >
              <LabelList dataKey="total" content={renderGradeTotalLabel} />
            </Bar>
            <Bar
              dataKey="female"
              name="Female"
              fill={FEMALE_COLOR}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={380}
              animationEasing="ease-out"
              className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {activeGradeIndex !== null && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 sm:hidden">
          <span>
            Selected: <strong className="text-slate-800">{chartData[activeGradeIndex]?.grade}</strong>
          </span>
          <button
            type="button"
            onClick={() => setActiveGradeIndex(null)}
            className="text-xs text-emerald-700 underline font-medium"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
