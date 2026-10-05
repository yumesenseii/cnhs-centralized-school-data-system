"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import ChartCard from "@/components/dashboard/ChartCard";
import RiskDistributionChart from "@/components/dashboard/RiskDistributionChart";
import WeakSubjectChart from "@/components/dashboard/WeakSubjectChart";
import LearnersAttention from "@/components/teacher/dashboard/LearnersAttention";
import MyClassesTable from "@/components/teacher/dashboard/MyClassesTable";
import WhatNeedsAttention from "@/components/teacher/dashboard/WhatNeedsAttention";
import AcademicOverviewCompact from "@/components/teacher/dashboard/AcademicOverviewCompact";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import { termLabel } from "@/lib/academic/termLabels";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "breakdown", label: "Breakdown" },
  { id: "charts", label: "Charts" },
];

const RISK_FILTERS = [
  { id: "all", label: "All Learners" },
  { id: "high", label: "High Risk", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "moderate", label: "Moderate Risk", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "low", label: "Low Risk", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "aral", label: "ARAL Eligible", color: "bg-sky-50 text-sky-700 border-sky-200" },
];

function PanelCard({ title, children, className }) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      {title ? (
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
            {title}
          </h3>
        </div>
      ) : null}
      {children}
    </section>
  );
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
  return null;
}

function buildSubtitle({ schoolYear, quarter, stats, classes }) {
  const parts = [];
  const sy = formatSchoolYearLabel(schoolYear);
  if (sy) parts.push(sy);
  if (quarter) parts.push(String(quarter) === "4" ? "Final Average" : termLabel(quarter));
  const learners = learnerCountFromStats(stats);
  if (learners != null) parts.push(`${learners} learners`);
  else if (classes?.length) parts.push(`${classes.length} classes`);
  return parts.join(" · ");
}

export default function TeacherAcademicAnalytics({
  schoolYear = null,
  quarter = null,
  stats = [],
  classes = [],
  recentActivities = [],
  learnersAttention = [],
  attentionItems = [],
  riskTrend = null,
  riskDistribution = [],
  weakSubjects = [],
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [riskFilter, setRiskFilter] = useState("all");

  const subtitle = buildSubtitle({ schoolYear, quarter, stats, classes });

  const earlyWarningCount = useMemo(() => {
    const high = stats?.find((s) => s.id === "high-risk")?.value || 0;
    const mod = stats?.find((s) => s.id === "moderate-risk")?.value || 0;
    return Number(high) + Number(mod);
  }, [stats]);

  const filteredLearners = useMemo(() => {
    if (riskFilter === "all") return learnersAttention;
    if (riskFilter === "high") {
      return learnersAttention.filter((l) =>
        /high/i.test(String(l.riskLevel || l.officialRiskLevel || ""))
      );
    }
    if (riskFilter === "moderate") {
      return learnersAttention.filter((l) =>
        /mod/i.test(String(l.riskLevel || l.officialRiskLevel || ""))
      );
    }
    if (riskFilter === "low") {
      return learnersAttention.filter((l) =>
        /low/i.test(String(l.riskLevel || l.officialRiskLevel || ""))
      );
    }
    if (riskFilter === "aral") {
      return learnersAttention.filter(
        (l) => l.aralEligible || /aral/i.test(String(l.intervention || ""))
      );
    }
    return learnersAttention;
  }, [learnersAttention, riskFilter]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      {/* Header with Title on Left, Tabs on Right */}
      <div className="border-b border-slate-100 bg-cnhs-green-soft/30 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
              <BarChart3 size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Academic Overview
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {/* Right-Side Clickable Tab Buttons */}
          <div
            role="tablist"
            aria-label="Teacher academic analytics views"
            className="inline-flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`teacher-analytics-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`teacher-analytics-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "min-w-max cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
                    active
                      ? "bg-cnhs-green-soft text-cnhs-green-dark shadow-xs"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        id={`teacher-analytics-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`teacher-analytics-tab-${activeTab}`}
        className="p-4 sm:p-5"
      >
        <TabSwitchPanel activeKey={activeTab} className="mt-0">
          {/* TAB 1: SUMMARY */}
          {activeTab === "summary" ? (
            <div className="space-y-4">
              {/* Unified Action Center */}
              {attentionItems?.length > 0 ? (
                <WhatNeedsAttention
                  items={attentionItems}
                  earlyWarningCount={earlyWarningCount}
                />
              ) : null}

              {/* Full-Width My Classes Overview */}
              <PanelCard title="My Classes Overview">
                <MyClassesTable classes={classes} embedded />
              </PanelCard>
            </div>
          ) : null}

          {/* TAB 2: BREAKDOWN */}
          {activeTab === "breakdown" ? (
            <div className="space-y-4">
              {/* Detailed Risk Breakdown Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <StatCard
                    key={stat.id}
                    stat={{
                      ...stat,
                      href: stat.href || "/teacher/monitoring",
                    }}
                  />
                ))}
              </div>

              {/* Risk Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 mr-1">Filter by Risk:</span>
                {RISK_FILTERS.map((f) => {
                  const isSelected = riskFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setRiskFilter(f.id)}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        isSelected
                          ? "border-slate-800 bg-slate-800 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Priority Learners Roster */}
              <PanelCard title={`Learners Needing Attention (${filteredLearners.length})`}>
                <LearnersAttention
                  learners={filteredLearners}
                  embedded
                />
              </PanelCard>

              {/* Academic Risk Trend Comparison */}
              {riskTrend ? (
                <div className="mt-2">
                  <AcademicOverviewCompact
                    riskTrend={riskTrend}
                    earlyWarningCount={earlyWarningCount}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* TAB 3: CHARTS */}
          {activeTab === "charts" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Chart 1: Risk Distribution */}
                <ChartCard title="Academic Risk Distribution">
                  <p className="mb-3 text-xs text-slate-500">
                    Proportion of enrolled learners across High, Moderate, and Low risk tiers.
                  </p>
                  <RiskDistributionChart data={riskDistribution} />
                </ChartCard>

                {/* Chart 2: Weak Subjects / Areas Needing Attention */}
                <ChartCard title="Areas Needing Attention (Subjects)">
                  <p className="mb-3 text-xs text-slate-500">
                    Count of learners needing academic review or remediation per subject area.
                  </p>
                  <WeakSubjectChart data={weakSubjects} />
                </ChartCard>
              </div>

              {/* Additional Context or Classes Comparison */}
              <PanelCard title="Class Risk Distribution Overview">
                <div className="p-4">
                  <MyClassesTable classes={classes} />
                </div>
              </PanelCard>
            </div>
          ) : null}
        </TabSwitchPanel>
      </div>
    </section>
  );
}
