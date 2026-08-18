"use client";

import { useMemo, useState } from "react";
import { BarChart3, Layers3 } from "lucide-react";
import ChartCard from "@/components/dashboard/ChartCard";
import EmptyState from "@/components/dashboard/EmptyState";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import PriorityLearnersTable from "@/components/dashboard/PriorityLearnersTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import RiskDistributionChart from "@/components/dashboard/RiskDistributionChart";
import StatCard from "@/components/dashboard/StatCard";
import WeakSubjectChart from "@/components/dashboard/WeakSubjectChart";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "charts", label: "Charts" },
  { id: "by-level", label: "By Level" },
  { id: "breakdown", label: "Breakdown" },
];

const RISK_FILTERS = [
  { id: "all", label: "All" },
  { id: "high", label: "High Risk" },
  { id: "moderate", label: "Moderate Risk" },
  { id: "low", label: "Low Risk" },
  { id: "aral", label: "ARAL Learners" },
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

export default function AdminAcademicAnalytics({
  stats = [],
  academicPerformance = [],
  riskDistribution = [],
  weakSubjects = [],
  recentActivity = [],
  priorityLearners = [],
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [riskFilter, setRiskFilter] = useState("all");

  const filteredLearners = useMemo(
    () =>
      priorityLearners.filter((learner) =>
        matchesRiskFilter(learner, riskFilter)
      ),
    [priorityLearners, riskFilter]
  );

  function selectRiskFilter(filter) {
    setRiskFilter(filter);
    setActiveTab("breakdown");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 bg-cnhs-green-soft/30 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
              <BarChart3 size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Academic Analytics
              </h2>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Academic analytics views"
            className="inline-flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm xl:w-auto"
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
                    "min-w-max cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
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

        <div className="mt-3 flex flex-wrap items-center gap-1.5 xl:justify-end">
          {RISK_FILTERS.map((filter) => {
            const active = riskFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => selectRiskFilter(filter.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
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
        className="p-4 sm:p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>

        {activeTab === "summary" ? (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
              <ChartCard title="Academic Performance by Grade Level">
                {academicPerformance.length ? (
                  <PerformanceChart data={academicPerformance} />
                ) : (
                  <EmptyState
                    title="No grade averages yet"
                    description="Import E-Class records so grade-level averages can appear here."
                  />
                )}
              </ChartCard>
              <ChartCard title="Risk Distribution">
                {riskDistribution.length ? (
                  <RiskDistributionChart data={riskDistribution} />
                ) : (
                  <EmptyState
                    title="No risk distribution yet"
                    description="Learner risk appears after grades are available for recommendation scoring."
                  />
                )}
              </ChartCard>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
              <ChartCard title="All Subject Weak-Learner Counts">
                {weakSubjects.length ? (
                  <WeakSubjectChart data={weakSubjects} />
                ) : (
                  <EmptyState
                    title="No assigned subjects yet"
                    description="Assigned class subjects will appear here, including subjects with zero weak learners."
                  />
                )}
              </ChartCard>
              <ChartCard title="Recent Activity">
                <RecentActivity activities={recentActivity} />
              </ChartCard>
            </div>
          </>
        ) : null}

        {activeTab === "charts" ? (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
              <ChartCard title="Academic Performance by Grade Level">
                {academicPerformance.length ? (
                  <PerformanceChart data={academicPerformance} />
                ) : (
                  <EmptyState
                    title="No grade averages yet"
                    description="Import E-Class records so grade-level averages can appear here."
                  />
                )}
              </ChartCard>
              <ChartCard title="Risk Distribution">
                {riskDistribution.length ? (
                  <RiskDistributionChart data={riskDistribution} />
                ) : (
                  <EmptyState
                    title="No risk distribution yet"
                    description="Learner risk appears after grades are available for recommendation scoring."
                  />
                )}
              </ChartCard>
            </div>
            <div className="mt-3">
              <ChartCard title="All Subject Weak-Learner Counts">
                {weakSubjects.length ? (
                  <WeakSubjectChart data={weakSubjects} />
                ) : (
                  <EmptyState
                    title="No assigned subjects yet"
                    description="Assigned class subjects will appear here, including subjects with zero weak learners."
                  />
                )}
              </ChartCard>
            </div>
          </>
        ) : null}

        {activeTab === "by-level" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_0.75fr]">
            <ChartCard title="Academic Performance by Grade Level">
              {academicPerformance.length ? (
                <PerformanceChart data={academicPerformance} />
              ) : (
                <EmptyState
                  title="No grade-level data yet"
                  description="Import E-Class records to compare grade-level averages."
                />
              )}
            </ChartCard>
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-2">
                <Layers3
                  size={15}
                  className="text-cnhs-green-dark"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold text-slate-900">
                  Grade-level averages
                </h3>
              </div>
              <div className="mt-3 space-y-2">
                {academicPerformance.length ? (
                  academicPerformance.map((row) => (
                    <div
                      key={row.grade}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                    >
                      <span className="text-[12px] font-medium text-slate-600">
                        {row.grade}
                      </span>
                      <span className="text-[13px] font-semibold text-cnhs-green-dark">
                        {row.average}%
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-slate-400">
                    No grade-level averages available.
                  </p>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "breakdown" ? (
          <div className="mt-4">
            {filteredLearners.length ? (
              <PriorityLearnersTable learners={filteredLearners} />
            ) : (
              <EmptyState
                title="No matching priority learners"
                description="No learners in the priority review list match the selected risk filter."
              />
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
