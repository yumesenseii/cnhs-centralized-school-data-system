"use client";

import { useMemo, useState, useEffect } from "react";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { aralPeriodLabel } from "@/lib/monitoring/assessmentTimeline";

const PAGE_SIZE = 10;

export default function AralReportTab({
  aralSummary = {},
  aralPeriod = "BOSY",
  classReports = [],
  overviewHotspots = {},
}) {
  const waitingReview = Number(aralSummary?.waitingForReview ?? 0);
  const waitingAssessment = Number(aralSummary?.waitingForAssessment ?? 0);
  const underSupport = Number(aralSummary?.underAralSupport ?? 0);
  const outcomesCount = Number(aralSummary?.outcomes ?? 0);

  // 4 Scoped Summary Cards
  const cards = [
    {
      label: "Waiting for Review",
      value: waitingReview,
      desc: "Referrals awaiting administrative endorsement",
    },
    {
      label: "Waiting for Assessment",
      value: waitingAssessment,
      desc: `${aralPeriodLabel(aralPeriod)} assessment pending`,
    },
    {
      label: "Under ARAL Support",
      value: underSupport,
      desc: "Learners actively undergoing sessions",
    },
    {
      label: "Outcomes",
      value: outcomesCount,
      desc:
        outcomesCount > 0
          ? `${outcomesCount} learners completed program`
          : "No completed outcomes yet for this period",
    },
  ];

  // Grade-level ARAL distribution for the chart
  const gradeChartData = useMemo(() => {
    const gradeMap = new Map([
      ["Grade 7", 0],
      ["Grade 8", 0],
      ["Grade 9", 0],
      ["Grade 10", 0],
    ]);

    classReports.forEach((c) => {
      const g = c.gradeLevel ? `Grade ${c.gradeLevel}` : null;
      if (g && gradeMap.has(g)) {
        const aralCount = c.aralEligible ? (Number(c.aralScreening) || 0) : (Number(c.aralCount) || 0);
        gradeMap.set(g, gradeMap.get(g) + aralCount);
      }
    });

    // If no grade distribution yet, derive from hotspots
    const hasData = Array.from(gradeMap.values()).some((v) => v > 0);
    if (!hasData && overviewHotspots?.sections?.length) {
      overviewHotspots.sections.forEach((sec) => {
        const label = sec.label || "";
        for (const g of ["Grade 7", "Grade 8", "Grade 9", "Grade 10"]) {
          if (label.includes(g)) {
            gradeMap.set(g, gradeMap.get(g) + (Number(sec.aral) || 0));
          }
        }
      });
    }

    return Array.from(gradeMap.entries()).map(([grade, learners]) => ({
      grade,
      learners,
    }));
  }, [classReports, overviewHotspots]);

  // Section Summary Table Data
  const sectionSummaryData = useMemo(() => {
    const secMap = new Map();

    classReports.forEach((c) => {
      const name =
        c.gradeSection ||
        c.className ||
        (c.gradeLevel && c.sectionName ? `Grade ${c.gradeLevel} - ${c.sectionName}` : "Section");

      if (!secMap.has(name)) {
        secMap.set(name, {
          section: name,
          totalLearners: Number(c.students) || 0,
          waitingReview: 0,
          inSupport: 0,
          aralTotal: 0,
        });
      }

      const entry = secMap.get(name);
      entry.totalLearners = Math.max(entry.totalLearners, Number(c.students) || 0);
      const aralCount = c.aralEligible ? (Number(c.aralScreening) || 0) : (Number(c.aralCount) || 0);
      entry.aralTotal += aralCount;
    });

    if (secMap.size === 0 && overviewHotspots?.sections?.length) {
      overviewHotspots.sections.forEach((s) => {
        secMap.set(s.label, {
          section: s.label,
          totalLearners: (Number(s.aral) || 0) + (Number(s.atRisk) || 0),
          waitingReview: 0,
          inSupport: Number(s.aral) || 0,
          aralTotal: Number(s.aral) || 0,
        });
      });
    }

    return Array.from(secMap.values()).map((row) => {
      const inSupport = Math.max(0, row.aralTotal - row.waitingReview);
      let status = "Monitoring";
      if (inSupport > 0) status = "Active Support";
      else if (row.waitingReview > 0) status = "Needs Review";

      return {
        section: row.section,
        totalLearners: row.totalLearners,
        waitingReview: row.waitingReview,
        inSupport: inSupport > 0 ? inSupport : row.aralTotal,
        status,
      };
    });
  }, [classReports, overviewHotspots]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [sectionSummaryData]);
  const totalPages = Math.max(1, Math.ceil(sectionSummaryData.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sectionSummaryData.slice(start, start + PAGE_SIZE);
  }, [sectionSummaryData, safePage]);

  return (
    <div className="space-y-4">
      {/* 4 SCOPED SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex min-h-[110px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold leading-tight tabular-nums text-slate-900 dark:text-slate-100">
              {card.value}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* 1 SIMPLE CHART: ARAL STATUS BY GRADE */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
            ARAL Status by Grade Level
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Enrolled reading and language intervention learners across grade cohorts.
          </p>
        </div>

        <div className="mt-4 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={gradeChartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="grade"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(val) => [`${val} learners`, "ARAL Learners"]}
              />
              <Bar
                dataKey="learners"
                fill="#1b4332"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION SUMMARY TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-200/80 px-4 py-3 dark:border-white/5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Section Summary
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Intervention progress and review status per section.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 dark:bg-white/[0.02]">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Section
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
                  Total Learners
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
                  Waiting for Review
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 tabular-nums">
                  In Support
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {sectionSummaryData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-slate-400">
                    No section ARAL records available for this period.
                  </td>
                </tr>
              ) : (
                pagedSections.map((row) => (
                  <tr key={row.section} className="hover:bg-slate-50/70 transition-colors dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      {row.section}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700 dark:text-slate-300">
                      {row.totalLearners}
                    </td>
                    <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700 dark:text-slate-300">
                      {row.waitingReview}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {row.inSupport}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminTablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={sectionSummaryData.length}
          onPageChange={setPage}
          itemLabel="sections"
        />
      </div>
    </div>
  );
}
