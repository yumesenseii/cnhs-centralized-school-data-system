"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildClassEarlyForecast } from "@/lib/monitoring/gradeTrajectoryForecaster";

export default function ClassRiskTrajectoryCard({
  classItem = {},
  students = [],
  currentTerm = 1,
  activeFilter = "all", // "all" | "critical" | "watchlist" | "safe"
  onFilterChange,
}) {
  const forecast = useMemo(() => {
    return buildClassEarlyForecast(classItem, students, currentTerm);
  }, [classItem, students, currentTerm]);

  const isLanguage = forecast.isLanguageSubject;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
              isLanguage
                ? "bg-cnhs-green-soft text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
            )}
          >
            {isLanguage ? <ShieldCheck size={18} /> : <TrendingUp size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {forecast.categoryTitle}
              </h3>
              <span className="hidden sm:inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {isLanguage ? "Phil-IRI Prevention" : "Academic Recovery"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {forecast.categorySubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Trajectory Metric Cards */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Ligtas / Recovered */}
        <button
          type="button"
          onClick={() => onFilterChange?.(activeFilter === "safe" ? "all" : "safe")}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer",
            activeFilter === "safe"
              ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:bg-emerald-950/30"
              : "border-slate-100 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-white/5 dark:bg-white/[0.02]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              {isLanguage ? "Ligtas sa Phil-IRI / ARAL" : "Nakabawi sa Grado (Safe)"}
            </span>
            <CheckCircle2 size={13} className="text-emerald-600" />
          </div>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {forecast.safeCount}
            <span className="ml-1 text-[11px] font-normal text-slate-500">
              ({Math.round((forecast.safeCount / (forecast.totalStudents || 1)) * 100)}%)
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            {forecast.recoveredCount > 0
              ? `${forecast.recoveredCount} nakabawi mula sa huling term`
              : "Markang 75 pataas"}
          </p>
        </button>

        {/* 2. Watchlist (75-76) */}
        <button
          type="button"
          onClick={() => onFilterChange?.(activeFilter === "watchlist" ? "all" : "watchlist")}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer",
            activeFilter === "watchlist"
              ? "border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 dark:bg-amber-950/30"
              : "border-slate-100 bg-slate-50/50 hover:border-amber-300 hover:bg-amber-50/30 dark:border-white/5 dark:bg-white/[0.02]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {isLanguage ? "Watchlist (Borderline Reading)" : "Watchlist (Borderline 75–76)"}
            </span>
            <Info size={13} className="text-amber-600" />
          </div>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {forecast.watchlistCount}
            <span className="ml-1 text-[11px] font-normal text-slate-500">
              mag-aaral
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            Muntik nang bumagsak (alagaan sa klase)
          </p>
        </button>

        {/* 3. Critical / Needs Support */}
        <button
          type="button"
          onClick={() => onFilterChange?.(activeFilter === "critical" ? "all" : "critical")}
          className={cn(
            "flex flex-col items-start p-3 rounded-xl border text-left transition cursor-pointer",
            activeFilter === "critical"
              ? "border-red-500 bg-red-50/80 ring-2 ring-red-500/20 dark:bg-red-950/30"
              : "border-slate-100 bg-slate-50/50 hover:border-red-300 hover:bg-red-50/30 dark:border-white/5 dark:bg-white/[0.02]"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] font-semibold text-red-800 dark:text-red-300">
              {isLanguage ? "Agapan bago maging ARAL" : "Kailangan ng Remedial (< 75)"}
            </span>
            <AlertTriangle size={13} className="text-red-600" />
          </div>
          <p className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
            {forecast.criticalCount}
            <span className="ml-1 text-[11px] font-normal text-slate-500">
              mag-aaral
            </span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            I-remedial sa klase ngayon
          </p>
        </button>
      </div>

      {/* Net Trajectory Forecast Banner ("Mababawasan ba o Dadami?") */}
      <div
        className={cn(
          "mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed",
          forecast.trendOutlook === "DECREASING_RISK"
            ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
            : forecast.trendOutlook === "INCREASING_RISK"
            ? "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200"
            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        )}
      >
        <div className="mt-0.5 shrink-0">
          {forecast.trendOutlook === "DECREASING_RISK" ? (
            <Sparkles size={15} className="text-emerald-600" />
          ) : forecast.trendOutlook === "INCREASING_RISK" ? (
            <AlertTriangle size={15} className="text-amber-600" />
          ) : (
            <Info size={15} className="text-slate-500" />
          )}
        </div>
        <div>
          <p className="font-bold text-[11.5px]">{forecast.headline}</p>
          <p className="mt-0.5 text-[11px] opacity-90">{forecast.detail}</p>
        </div>
      </div>
    </section>
  );
}
