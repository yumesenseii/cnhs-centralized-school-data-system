"use client";

import { useMemo, useState } from "react";
import { BarChart3, Layers3 } from "lucide-react";
import ChartCard from "@/components/dashboard/ChartCard";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import PriorityLearnersTable from "@/components/dashboard/PriorityLearnersTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import RiskDistributionChart from "@/components/dashboard/RiskDistributionChart";
import LongitudinalImpactPanel from "@/components/dashboard/LongitudinalImpactPanel";
import StatCard from "@/components/dashboard/StatCard";
import WeakSubjectChart from "@/components/dashboard/WeakSubjectChart";
import DeferredMount from "@/components/shared/DeferredMount";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "charts", label: "Charts" },
  { id: "by-level", label: "By Level" },
  { id: "longitudinal", label: "Longitudinal & AI Insights" },
  { id: "breakdown", label: "Breakdown" },
];

const RISK_FILTERS = [
  { id: "all", label: "All" },
  { id: "high", label: "High Risk" },
  { id: "moderate", label: "Moderate Risk" },
  { id: "low", label: "Low Risk" },
  { id: "aral", label: "ARAL Learners" },
];

const EMPTY_GRADE_PERFORMANCE = [
  { grade: "Grade 7", average: 0 },
  { grade: "Grade 8", average: 0 },
  { grade: "Grade 9", average: 0 },
  { grade: "Grade 10", average: 0 },
];

function matchesRiskFilter(learner, filter) {
  const risk = String(learner.riskLevel ?? "").toLowerCase();
  const intervention = String(learner.suggestedIntervention ?? "").toLowerCase();

  if (filter === "high") return risk.includes("high") || risk === "priority";
  if (filter === "moderate") return risk.includes("moderate");
  if (filter === "low") return risk.includes("low");
  if (filter === "aral") return intervention.includes("aral");
  return true;
}

function formatSchoolYearLabel(schoolYear) {
  const raw = String(schoolYear ?? "").trim();
  if (!raw) return "";
  return /^sy\b/i.test(raw) ? raw : `SY ${raw}`;
}

function learnerCountFromStats(stats = []) {
  for (const stat of stats) {
    const match = String(stat.subtext ?? "").match(/of\s+(\d+)/i);
    if (match) return Number(match[1]);
  }
  const sum = stats
    .filter((s) => ["high-risk", "moderate-risk", "low-risk"].includes(s.id))
    .reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  return sum > 0 ? sum : null;
}

function buildSubtitle({ schoolYear, stats, priorityLearners }) {
  const parts = [];
  const sy = formatSchoolYearLabel(schoolYear);
  if (sy) parts.push(sy);
  const learners = learnerCountFromStats(stats);
  if (learners != null) parts.push(`${learners} learners`);
  if (priorityLearners?.length) {
    parts.push(`${priorityLearners.length} priority`);
  }
  return parts.join(" · ");
}

export default function AdminAcademicAnalytics({
  schoolYear = null,
  stats = [],
  academicPerformance = [],
  riskDistribution = [],
  weakSubjects = [],
  recentActivity = [],
  priorityLearners = [],
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [riskFilter, setRiskFilter] = useState("all");

  const performanceData = academicPerformance.length
    ? academicPerformance
    : EMPTY_GRADE_PERFORMANCE;

  const filteredLearners = useMemo(
    () =>
      priorityLearners.filter((learner) =>
        matchesRiskFilter(learner, riskFilter)
      ),
    [priorityLearners, riskFilter]
  );

  const subtitle = buildSubtitle({
    schoolYear,
    stats,
    priorityLearners,
  });

  function selectRiskFilter(filter) {
    setRiskFilter(filter);
    setActiveTab("breakdown");
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 bg-cnhs-green-soft/30 px-3 py-2.5 sm:px-4">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
              <BarChart3 size={15} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold text-slate-900">
                Academic Analytics
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Academic analytics views"
            className="inline-flex w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm xl:w-auto"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`analytics-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`analytics-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "min-w-max cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
                    active
                      ? "bg-cnhs-green-soft text-cnhs-green-dark"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1 xl:justify-end">
          {RISK_FILTERS.map((filter) => {
            const active = riskFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectRiskFilter(filter.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
                  active
                    ? "border-cnhs-green/25 bg-white text-cnhs-green-dark shadow-sm"
                    : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-700"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    filter.id === "high" && "bg-red-500",
                    filter.id === "moderate" && "bg-cnhs-orange",
                    filter.id === "low" && "bg-cnhs-green",
                    filter.id === "aral" && "bg-sky-500",
                    filter.id === "all" && "bg-slate-400"
                  )}
                  aria-hidden="true"
                />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`analytics-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`analytics-tab-${activeTab}`}
        className="p-3 sm:p-3.5"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>

        <TabSwitchPanel activeKey={activeTab}>
        {activeTab === "summary" ? (
          <DeferredMount
            delayMs={40}
            fallback={
              <p className="mt-3 py-6 text-center text-[12px] text-slate-400">
                Loading charts…
              </p>
            }
          >
            <div className="mt-2.5 grid grid-cols-1 gap-2 xl:grid-cols-2">
              <ChartCard title="Academic Performance by Grade Level">
                <PerformanceChart data={performanceData} />
              </ChartCard>
              <ChartCard title="Risk Distribution">
                <RiskDistributionChart data={riskDistribution} />
              </ChartCard>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
              <ChartCard title="All Subject Weak-Learner Counts">
                <WeakSubjectChart data={weakSubjects} />
              </ChartCard>
              <ChartCard title="Recent Activity">
                <RecentActivity activities={recentActivity} />
              </ChartCard>
            </div>
          </DeferredMount>
        ) : null}

        {activeTab === "charts" ? (
          <>
            <div className="mt-2.5 grid grid-cols-1 gap-2 xl:grid-cols-2">
              <ChartCard title="Academic Performance by Grade Level">
                <PerformanceChart data={performanceData} />
              </ChartCard>
              <ChartCard title="Risk Distribution">
                <RiskDistributionChart data={riskDistribution} />
              </ChartCard>
            </div>
            <div className="mt-2">
              <ChartCard title="All Subject Weak-Learner Counts">
                <WeakSubjectChart data={weakSubjects} />
              </ChartCard>
            </div>
          </>
        ) : null}

        {activeTab === "by-level" ? (
          <div className="mt-2.5 grid grid-cols-1 gap-2 xl:grid-cols-[1.25fr_0.75fr]">
            <ChartCard title="Academic Performance by Grade Level">
              <PerformanceChart data={performanceData} />
            </ChartCard>
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2">
                <Layers3
                  size={14}
                  className="text-cnhs-green-dark"
                  aria-hidden="true"
                />
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Grade-level averages
                </h3>
              </div>
              <div className="mt-2 space-y-1.5">
                {performanceData.map((row) => (
                  <div
                    key={row.grade}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
                  >
                    <span className="text-[11px] font-medium text-slate-600">
                      {row.grade}
                    </span>
                    <span className="text-[12px] font-semibold text-cnhs-green-dark">
                      {row.average}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "longitudinal" ? (
          <LongitudinalImpactPanel schoolYear={schoolYear} />
        ) : null}

        {activeTab === "breakdown" ? (
          <div className="mt-2.5">
            <PriorityLearnersTable learners={filteredLearners} />
          </div>
        ) : null}
        </TabSwitchPanel>
      </div>
    </section>
  );
}
