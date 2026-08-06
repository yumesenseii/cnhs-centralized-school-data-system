"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import LearnersAttention from "@/components/teacher/dashboard/LearnersAttention";
import MonitoringProgress from "@/components/teacher/dashboard/MonitoringProgress";
import MyClassesTable from "@/components/teacher/dashboard/MyClassesTable";
import QuickActions from "@/components/teacher/dashboard/QuickActions";
import RecentActivities from "@/components/teacher/dashboard/RecentActivities";
import SystemRecommendations from "@/components/teacher/dashboard/SystemRecommendations";
import TodaysTasks from "@/components/teacher/dashboard/TodaysTasks";
import UpcomingDeadlines from "@/components/teacher/dashboard/UpcomingDeadlines";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "classes", label: "Classes" },
  { id: "tasks", label: "Tasks" },
  { id: "attention", label: "Attention" },
];

const RECENT_ACTIVITY_LIMIT = 5;

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

/**
 * Teacher Academic Analytics shell — simplified Summary; other panels live in tabs.
 */
export default function TeacherAcademicAnalytics({
  schoolYear,
  stats = [],
  classes = [],
  recentActivities = [],
  learnersAttention = [],
  todaysTasks,
  quickActions = [],
  upcomingDeadlines = [],
  monitoringProgress,
  systemRecommendations = [],
}) {
  const [activeTab, setActiveTab] = useState("summary");

  const summaryActivities = useMemo(
    () => recentActivities.slice(0, RECENT_ACTIVITY_LIMIT),
    [recentActivities]
  );

  const hasDeadlines = upcomingDeadlines.length > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 bg-cnhs-green-soft/30 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm ring-1 ring-slate-100">
              <BarChart3 size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Academic Analytics
              </h2>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                Risk predictions use academic performance (ECR grades) only
                {schoolYear ? ` · ${schoolYear}` : ""}. Attendance is not a
                prediction input.
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Teacher academic analytics views"
            className="inline-flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm xl:w-auto"
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
      </div>

      <div
        id={`teacher-analytics-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`teacher-analytics-tab-${activeTab}`}
        className="p-4 sm:p-5"
      >
        {/* StatCards stay visible on every tab for Admin-like orientation */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>

        {activeTab === "summary" ? (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
              <PanelCard title="My Classes Overview">
                <MyClassesTable classes={classes} embedded />
              </PanelCard>
              <PanelCard title="Recent Activity">
                <div className="px-4 pb-3">
                  <RecentActivities
                    activities={summaryActivities}
                    embedded
                  />
                </div>
              </PanelCard>
            </div>
            <div className="mt-3">
              <LearnersAttention learners={learnersAttention} embedded />
            </div>
          </>
        ) : null}

        {activeTab === "classes" ? (
          <div className="mt-4">
            <MyClassesTable classes={classes} />
          </div>
        ) : null}

        {activeTab === "tasks" ? (
          <div className="mt-4 space-y-3">
            <TodaysTasks tasks={todaysTasks} />
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                hasDeadlines ? "xl:grid-cols-2" : "xl:grid-cols-1"
              )}
            >
              <QuickActions actions={quickActions} />
              {hasDeadlines ? (
                <UpcomingDeadlines deadlines={upcomingDeadlines} />
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === "attention" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1.15fr]">
            {monitoringProgress ? (
              <MonitoringProgress monitoring={monitoringProgress} />
            ) : null}
            <SystemRecommendations recommendations={systemRecommendations} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
