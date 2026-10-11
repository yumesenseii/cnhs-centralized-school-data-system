"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AcademicReportTab({
  summary = {},
  schoolSummary = {},
  classReports = [],
  charts = {},
  overviewMonitoringHealth = {},
  doingWell = 0,
}) {
  const learners = schoolSummary?.totalLearners ?? summary?.totalStudents ?? 0;
  const needSupport = schoolSummary?.atRisk ?? summary?.needingSupport ?? 0;
  const continuingMonitoring = overviewMonitoringHealth?.ongoing ?? 0;
  const doingWellCount =
    doingWell ||
    charts?.riskDistribution?.find(
      (r) =>
        String(r.name).toLowerCase().includes("low") ||
        r.name === "Low Risk"
    )?.value ||
    Math.max(0, learners - needSupport);

  const passingRateLabel =
    summary?.passingRate != null ? `${summary.passingRate}% passing rate` : "On track";

  // Top 4 Scoped Summary Cards
  const cards = [
    {
      label: "Learners with Records",
      value: learners,
      desc: "Unique learners from class records",
    },
    {
      label: "Need Academic Support",
      value: needSupport,
      desc: "ARAL screening and remedial candidates",
    },
    {
      label: "Continuing Monitoring",
      value: continuingMonitoring,
      desc: "Active academic intervention cases",
    },
    {
      label: "Doing Well",
      value: doingWellCount,
      desc: passingRateLabel,
    },
  ];

  // Subject support chart data
  const subjectChartData = useMemo(() => {
    const perfList = charts?.performanceBySubject ?? [];
    if (perfList.length > 0) {
      return perfList.map((item) => {
        const subjectName = item.subject || item.name || "Subject";
        // Calculate needing support for this subject if available, or approximate from classReports
        const matchedClasses = classReports.filter(
          (c) =>
            String(c.subject || "").toLowerCase() ===
            subjectName.toLowerCase()
        );
        const supportCount = matchedClasses.reduce(
          (acc, c) => acc + (Number(c.requiringIntervention) || 0),
          0
        );
        return {
          subject: subjectName,
          learners: supportCount > 0 ? supportCount : Math.max(0, Math.round((100 - (Number(item.average) || 75)) * 0.4)),
        };
      }).sort((a, b) => b.learners - a.learners).slice(0, 8);
    }

    // Fallback aggregation from classReports
    const map = new Map();
    classReports.forEach((c) => {
      const subj = c.subject || "General";
      const sup = Number(c.requiringIntervention) || 0;
      map.set(subj, (map.get(subj) || 0) + sup);
    });
    return Array.from(map.entries())
      .map(([subject, count]) => ({ subject, learners: count }))
      .sort((a, b) => b.learners - a.learners)
      .slice(0, 8);
  }, [charts, classReports]);

  // Section Summary Table Data (aggregated per section)
  const sectionSummaryData = useMemo(() => {
    const secMap = new Map();

    classReports.forEach((c) => {
      const sectionName =
        c.gradeSection ||
        c.className ||
        (c.gradeLevel && c.sectionName ? `Grade ${c.gradeLevel} - ${c.sectionName}` : "Section");

      if (!secMap.has(sectionName)) {
        secMap.set(sectionName, {
          section: sectionName,
          learners: Number(c.students) || 0,
          needSupport: 0,
          subjectConcerns: new Map(),
        });
      }

      const entry = secMap.get(sectionName);
      entry.learners = Math.max(entry.learners, Number(c.students) || 0);
      const needing = Number(c.requiringIntervention) || 0;
      entry.needSupport += needing;

      if (c.subject && needing > 0) {
        entry.subjectConcerns.set(
          c.subject,
          (entry.subjectConcerns.get(c.subject) || 0) + needing
        );
      }
    });

    return Array.from(secMap.values()).map((row) => {
      let mainConcern = "None";
      let highestConcernCount = 0;
      row.subjectConcerns.forEach((count, subject) => {
        if (count > highestConcernCount) {
          highestConcernCount = count;
          mainConcern = subject;
        }
      });
      return {
        section: row.section,
        learners: row.learners,
        needSupport: row.needSupport,
        mainConcern: row.needSupport > 0 ? mainConcern : "None",
      };
    });
  }, [classReports]);

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

      {/* 1 SIMPLE HORIZONTAL BAR CHART */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Learners Needing Academic Support by Subject
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Distribution of identified learners needing targeted academic or remedial support.
          </p>
        </div>

        <div className="mt-4 h-[240px] w-full">
          {subjectChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={subjectChartData}
                margin={{ top: 6, right: 30, left: 40, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: "#334155" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val) => [`${val} learners`, "Needing Support"]}
                />
                <Bar
                  dataKey="learners"
                  fill="#1b4332"
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No subject support data available for this term.
            </div>
          )}
        </div>
      </div>

      {/* SECTION SUMMARY TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
            Section Summary
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Summary of learners requiring academic assistance across grade sections.
          </p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 dark:border-white/10">
                <th className="pb-2 font-semibold">Section</th>
                <th className="pb-2 font-semibold tabular-nums">Learners</th>
                <th className="pb-2 font-semibold tabular-nums">Need Support</th>
                <th className="pb-2 font-semibold">Main Concern</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {sectionSummaryData.length > 0 ? (
                sectionSummaryData.map((row) => (
                  <tr key={row.section} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02]">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {row.section}
                    </td>
                    <td className="py-2.5 tabular-nums text-slate-700 dark:text-slate-300">
                      {row.learners}
                    </td>
                    <td className="py-2.5 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {row.needSupport}
                    </td>
                    <td className="py-2.5 text-slate-600 dark:text-slate-400">
                      {row.mainConcern}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-slate-400">
                    No section data available for the selected reporting period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
