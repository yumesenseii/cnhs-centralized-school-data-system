"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
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
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import ChartCard from "@/components/dashboard/ChartCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import StatCard from "@/components/dashboard/StatCard";
import SubjectBandTable from "@/components/dashboard/SubjectBandTable";
import DeferredMount from "@/components/shared/DeferredMount";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { aralPeriodShortLabel } from "@/lib/monitoring/assessmentTimeline";
import { getTrimesterRiskTransitions } from "@/lib/supabase/queries/longitudinalAnalytics";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Academic Overview" },
  { id: "aral", label: "ARAL Overview" },
  { id: "progress", label: "Progress Over Time" },
];

function previousSchoolYearLabel(schoolYear) {
  const match = String(schoolYear || "").match(/(\d{4})\s*[–-]\s*(\d{4})/);
  if (!match) return null;
  return `SY ${Number(match[1]) - 1}-${Number(match[2]) - 1}`;
}

const CARD_COPY = {
  "high-risk": {
    label: "Needs Immediate Review",
    meaning: "Learners far below passing",
  },
  "moderate-risk": {
    label: "Needs Monitoring",
    meaning: "Learners to watch closely",
  },
  "low-risk": {
    label: "Doing Well",
    meaning: "Learners meeting expectations",
  },
  aral: {
    label: "ARAL Learners",
    meaning: "English / Filipino only",
  },
};

function formatSchoolYearLabel(schoolYear) {
  const raw = String(schoolYear ?? "").trim();
  if (!raw) return "";
  return /^sy\b/i.test(raw) ? raw : `SY ${raw}`;
}

function learnerCountFromStats(stats = []) {
  const sum = stats
    .filter((s) => ["high-risk", "moderate-risk", "low-risk"].includes(s.id))
    .reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  return sum > 0 ? sum : null;
}

function buildSubtitle({ schoolYear, stats, latestTerm }) {
  const parts = [];
  const sy = formatSchoolYearLabel(schoolYear);
  if (sy) parts.push(sy);
  const learners = learnerCountFromStats(stats);
  if (learners != null) parts.push(`${learners} learners`);
  if (latestTerm) parts.push(latestTerm);
  return parts.join(" · ");
}

function buildTrendStatements(termTrends = []) {
  const withData = termTrends.filter(
    (t) => (t.needReview ?? 0) + (t.doingWell ?? 0) > 0
  );
  if (withData.length < 2) return [];
  const prev = withData[withData.length - 2];
  const curr = withData[withData.length - 1];
  const statements = [];

  if (curr.needReview < prev.needReview) {
    statements.push(
      `Fewer learners need immediate review than ${prev.term} (${prev.needReview} → ${curr.needReview}).`
    );
  } else if (curr.needReview > prev.needReview) {
    statements.push(
      `More learners need immediate review than ${prev.term} (${prev.needReview} → ${curr.needReview}).`
    );
  } else {
    statements.push(
      `Learners needing immediate review held steady since ${prev.term} (${curr.needReview}).`
    );
  }

  if (curr.doingWell > prev.doingWell) {
    statements.push(
      `More learners are doing well (${prev.doingWell} → ${curr.doingWell}).`
    );
  } else if (curr.doingWell < prev.doingWell) {
    statements.push(
      `Fewer learners are doing well than ${prev.term} (${prev.doingWell} → ${curr.doingWell}). This may need closer attention.`
    );
  } else {
    statements.push(
      `Learners doing well held steady since ${prev.term} (${curr.doingWell}).`
    );
  }
  return statements;
}

export default function AdminAcademicAnalytics({
  schoolYear = null,
  stats = [],
  recentActivity = [],
  subjectBands = [],
  subjectUnassignedCount = 0,
  termTrends = [],
  watchSections = [],
  pendingAralReferrals = 0,
  pendingLessonPlans = 0,
  aralPipeline = { pending: 0, waiting: 0, active: 0, completed: 0 },
  aralAttention = { unassignedFacilitator: 0 },
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const { period: aralPeriod } = useAralAssessmentPeriod();
  const [prevYearComparison, setPrevYearComparison] = useState(null);

  const bandDeltas = useMemo(() => {
    const withData = termTrends.filter(
      (t) => (t.high ?? 0) + (t.moderate ?? 0) + (t.low ?? 0) > 0
    );
    if (withData.length < 2) return {};
    const prev = withData[withData.length - 2];
    const curr = withData[withData.length - 1];
    const make = (before, after) => {
      if (before === after) return null;
      const diff = Math.abs(after - before);
      return {
        direction: after < before ? "down" : "up",
        text: `${diff} vs ${prev.term}`,
      };
    };
    return {
      "high-risk": make(prev.high ?? 0, curr.high ?? 0),
      "moderate-risk": make(prev.moderate ?? 0, curr.moderate ?? 0),
      "low-risk": make(prev.low ?? 0, curr.low ?? 0),
    };
  }, [termTrends]);

  const friendlyStats = useMemo(
    () =>
      stats.map((stat) => {
        const copy = CARD_COPY[stat.id];
        if (!copy) return stat;
        const pending = String(stat.subtext ?? "").includes("Updating");
        return {
          ...stat,
          label: copy.label,
          unit: "learners",
          subtext: pending ? stat.subtext : copy.meaning,
          actionLabel: stat.href ? "View learners" : undefined,
          delta: bandDeltas[stat.id] ?? undefined,
        };
      }),
    [stats, bandDeltas]
  );

  const highRiskStat = stats.find((s) => s.id === "high-risk");

  const attentionItems = useMemo(() => {
    const items = [];
    if (Number(pendingAralReferrals) > 0) {
      items.push({
        id: "aral-referrals",
        text: `${pendingAralReferrals} ARAL referral${pendingAralReferrals === 1 ? "" : "s"} waiting for review`,
        action: "View",
        href: "/aral-monitoring",
      });
    }
    if (Number(highRiskStat?.value) > 0 && highRiskStat?.href) {
      items.push({
        id: "high-risk",
        text: `${highRiskStat.value} learner${highRiskStat.value === 1 ? "" : "s"} need${highRiskStat.value === 1 ? "s" : ""} immediate review`,
        action: "View",
        href: highRiskStat.href,
      });
    }
    const watchedSections = watchSections ?? [];
    const watchedSectionCount = watchedSections.length;
    const watchedLearnersAffected = watchedSections.reduce(
      (sum, section) => sum + (Number(section.count) || 0),
      0
    );
    if (watchedSectionCount > 0) {
      items.push({
        id: "sections-needing-monitoring",
        text: `${watchedSectionCount} Section${watchedSectionCount === 1 ? "" : "s"} Need Closer Monitoring`,
        sub: `${watchedLearnersAffected} learner${watchedLearnersAffected === 1 ? "" : "s"} affected`,
        action: "View",
        href: "/class-organization",
      });
    }
    if (Number(pendingLessonPlans) > 0) {
      items.push({
        id: "lesson-plans",
        text: `${pendingLessonPlans} lesson plan${pendingLessonPlans === 1 ? "" : "s"} waiting for review`,
        action: "View",
        href: "/lesson-plan-review",
      });
    }
    return items;
  }, [pendingAralReferrals, pendingLessonPlans, highRiskStat, watchSections]);

  const latestTerm =
    termTrends.length > 0 ? termTrends[termTrends.length - 1].term : "";
  const subtitle = buildSubtitle({ schoolYear, stats, latestTerm });
  const trendStatements = useMemo(
    () => buildTrendStatements(termTrends),
    [termTrends]
  );
  const progressChartData = useMemo(
    () =>
      termTrends.map((row) => ({
        term: row.term,
        immediate: row.needReview ?? 0,
        well: row.doingWell ?? 0,
      })),
    [termTrends]
  );

  const aralCards = useMemo(
    () => [
      {
        id: "aral-pending",
        label: "Pending Principal Review",
        value: Number(aralPipeline?.pending) || 0,
        unit: "learners",
        subtext: "Referrals waiting for review",
        icon: "alert",
        variant: "warning",
        href: "/aral-monitoring",
        actionLabel: "Open ARAL Monitoring",
      },
      {
        id: "aral-waiting",
        label: "Waiting for Reading Assessment",
        value: Number(aralPipeline?.waiting) || 0,
        unit: "learners",
        subtext: "Approved, assessment scheduled",
        icon: "users",
        variant: "default",
        href: "/aral-monitoring",
        actionLabel: "Open ARAL Monitoring",
      },
      {
        id: "aral-active",
        label: "Under ARAL Intervention",
        value: Number(aralPipeline?.active) || 0,
        unit: "learners",
        subtext: "Currently receiving support",
        icon: "users",
        variant: "default",
        href: "/aral-monitoring",
        actionLabel: "Open ARAL Monitoring",
      },
      {
        id: "aral-completed",
        label: "Completed",
        value: Number(aralPipeline?.completed) || 0,
        unit: "learners",
        subtext: "Finished intervention",
        icon: "check",
        variant: "success",
        href: "/aral-monitoring",
        actionLabel: "Open ARAL Monitoring",
      },
    ],
    [aralPipeline]
  );

  const aralAttentionItems = useMemo(() => {
    const items = [];
    if (Number(aralPipeline?.pending) > 0) {
      items.push({
        id: "aral-pending-review",
        text: `${aralPipeline.pending} referral${aralPipeline.pending === 1 ? "" : "s"} waiting for principal review`,
        action: "View",
        href: "/aral-monitoring",
      });
    }
    if (Number(aralAttention?.unassignedFacilitator) > 0) {
      items.push({
        id: "aral-unassigned",
        text: `${aralAttention.unassignedFacilitator} approved learner${aralAttention.unassignedFacilitator === 1 ? "" : "s"} need${aralAttention.unassignedFacilitator === 1 ? "s" : ""} a facilitator`,
        action: "View",
        href: "/aral-monitoring",
      });
    }
    return items;
  }, [aralPipeline, aralAttention]);

  // Same-period previous school year comparison, loaded lazily on tab open.
  useEffect(() => {
    if (activeTab !== "progress" || prevYearComparison !== null) return;
    let cancelled = false;
    const prevYear = previousSchoolYearLabel(schoolYear);
    if (!prevYear) {
      setPrevYearComparison({ unavailable: true });
      return;
    }
    (async () => {
      try {
        const result = await getTrimesterRiskTransitions({
          schoolYear: prevYear,
        });
        if (!cancelled) {
          setPrevYearComparison(
            result?.error || !result?.data
              ? { unavailable: true }
              : { year: prevYear, data: result.data }
          );
        }
      } catch {
        if (!cancelled) setPrevYearComparison({ unavailable: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, schoolYear, prevYearComparison]);

  const prevYearStatements = useMemo(() => {
    if (!prevYearComparison?.data?.termDistribution) return null;
    const dist = prevYearComparison.data.termDistribution;
    const current = termTrends.filter(
      (t) => (t.needReview ?? 0) + (t.doingWell ?? 0) > 0
    );
    if (!current.length) return null;
    const termKey = { "Term 1": "term1", "Term 2": "term2", "Term 3": "term3" };
    const statements = [];
    for (const row of current) {
      const prev = dist[termKey[row.term]];
      if (!prev) continue;
      const prevNeed = (prev.high ?? 0) + (prev.moderate ?? 0);
      const currNeed = row.needReview ?? 0;
      if (currNeed < prevNeed) {
        statements.push(
          `Fewer learners need immediate review than ${row.term} last school year (${prevNeed} → ${currNeed}).`
        );
      } else if (currNeed > prevNeed) {
        statements.push(
          `More learners need immediate review than ${row.term} last school year (${prevNeed} → ${currNeed}).`
        );
      }
      const prevWell = prev.low ?? 0;
      const currWell = row.doingWell ?? 0;
      if (currWell > prevWell) {
        statements.push(
          `More learners are doing well than ${row.term} last school year (${prevWell} → ${currWell}).`
        );
      }
    }
    return statements.length ? statements : null;
  }, [prevYearComparison, termTrends]);

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
                Academic Overview
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div
            role="tablist"
            aria-label="School overview views"
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
      </div>

      <div
        id={`analytics-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`analytics-tab-${activeTab}`}
        className="p-3 sm:p-3.5"
      >
        <TabSwitchPanel activeKey={activeTab}>
          {activeTab === "overview" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {friendlyStats.map((stat) => (
                  <StatCard key={stat.id} stat={stat} />
                ))}
              </div>

              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
                <div className="min-w-0 space-y-4">
                  <DeferredMount
                    delayMs={40}
                    fallback={
                      <p className="py-6 text-center text-[12px] text-slate-400">
                        Loading charts…
                      </p>
                    }
                  >
                    <ChartCard title="Learners Needing Support by Subject">
                      <SubjectBandTable
                        data={subjectBands}
                        unassignedCount={subjectUnassignedCount}
                      />
                    </ChartCard>
                  </DeferredMount>
                  <ChartCard title="Recent Activity">
                    <RecentActivity activities={recentActivity} />
                  </ChartCard>
                </div>
                {attentionItems.length > 0 ? (
                  <aside
                    aria-label="Needs your attention"
                    className="min-w-0 rounded-xl border border-amber-200/70 bg-amber-50/50 p-3"
                  >
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      Needs Your Attention
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {attentionItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <span className="block text-[12px] font-medium leading-5 text-slate-700">
                              {item.text}
                            </span>
                            {item.sub ? (
                              <span className="mt-0.5 block text-[11px] tabular-nums text-slate-500">
                                {item.sub}
                              </span>
                            ) : null}
                          </div>
                          <a
                            href={item.href}
                            className="shrink-0 rounded-lg bg-cnhs-green-dark px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
                          >
                            {item.action}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </aside>
                ) : null}
              </div>

              <AttendanceMonitoringPanel
                showUpload={false}
                compact
                linkHref="/attendance"
                linkLabel="View Attendance"
                labels={{
                  average: "Average Attendance",
                  rate: "Attendance Rate",
                  absences: "Absences",
                  flagged: "Learners Flagged",
                }}
              />
            </div>
          ) : null}

          {activeTab === "aral" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  Current ARAL assessment period:{" "}
                  <span className="font-semibold text-cnhs-green-dark">
                    {aralPeriodShortLabel(aralPeriod)}
                  </span>
                </p>
                <a
                  href="/aral-monitoring"
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
                >
                  Open ARAL Monitoring
                  <span aria-hidden="true">→</span>
                </a>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {aralCards.map((stat) => (
                  <StatCard key={stat.id} stat={stat} />
                ))}
              </div>
              {aralAttentionItems.length > 0 ? (
                <section
                  aria-label="ARAL items needing attention"
                  className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3"
                >
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Needs Your Attention
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {aralAttentionItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-2.5 py-2"
                      >
                        <span className="block min-w-0 text-[12px] font-medium leading-5 text-slate-700">
                          {item.text}
                        </span>
                        <a
                          href={item.href}
                          className="shrink-0 rounded-lg bg-cnhs-green-dark px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
                        >
                          {item.action}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="rounded-xl border border-slate-100 bg-white px-3 py-4 text-center text-xs text-slate-400">
                  No ARAL actions need attention right now.
                </p>
              )}
            </div>
          ) : null}

          {activeTab === "progress" ? (
            <div className="space-y-2">
            <section className="rounded-xl border border-slate-100 bg-white p-3">
              <h3 className="text-[13px] font-semibold text-slate-900">
                Are learners improving?
              </h3>
              {trendStatements.length > 0 ? (
                <>
                  <div className="mt-2 h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={progressChartData}
                        margin={{ top: 18, right: 6, left: -22, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="term"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          dy={6}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={false}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(82, 183, 136, 0.06)" }}
                          contentStyle={{
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--card-foreground)",
                            borderRadius: 12,
                            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="immediate"
                          name="Needs Immediate Review"
                          fill="#f4a261"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={64}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="immediate"
                            position="top"
                            style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }}
                          />
                        </Bar>
                        <Bar
                          dataKey="well"
                          name="Doing Well"
                          fill="#52b788"
                          radius={[8, 8, 0, 0]}
                          maxBarSize={64}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="well"
                            position="top"
                            style={{ fontSize: 11, fontWeight: 700, fill: "#475569" }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {trendStatements.map((statement) => (
                      <li
                        key={statement}
                        className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[12px] font-medium text-slate-700"
                      >
                        {statement}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-[12px] text-slate-500">
                  Trends appear once more than one term has grades.
                </p>
              )}
            </section>
            <section
              aria-label="ARAL outcomes"
              className="rounded-xl border border-slate-100 bg-white p-3"
            >
              <h3 className="text-[13px] font-semibold text-slate-900">
                ARAL Outcomes
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {[
                  { label: "Referred", value: aralPipeline?.referred ?? null },
                  { label: "Approved", value: aralPipeline?.approved ?? null },
                  { label: "Assessed", value: aralPipeline?.assessed ?? null },
                  { label: "Completed", value: aralPipeline?.completed ?? null },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-center"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                      {item.value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Full ARAL workflow lives on{" "}
                <a
                  href="/aral-monitoring"
                  className="font-semibold text-cnhs-green-dark hover:underline"
                >
                  ARAL Monitoring
                </a>
                .
              </p>
            </section>
            <section
              aria-label="Same-period comparison with previous school year"
              className="rounded-xl border border-slate-100 bg-white p-3"
            >
              <h3 className="text-[13px] font-semibold text-slate-900">
                Compared With Last School Year
              </h3>
              {prevYearComparison === null ? (
                <p className="mt-2 text-[12px] text-slate-500">
                  Loading previous school year…
                </p>
              ) : prevYearStatements.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {prevYearStatements.map((statement) => (
                    <li
                      key={statement}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[12px] font-medium text-slate-700"
                    >
                      {statement}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-slate-500">
                  Previous school year comparison is not available.
                </p>
              )}
            </section>
            </div>
          ) : null}
        </TabSwitchPanel>
      </div>
    </section>
  );
}
