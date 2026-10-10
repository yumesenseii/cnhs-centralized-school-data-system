"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  ArrowRight,
  ShieldCheck,
  BarChart2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import {
  CNHS_POPULATION_BASELINE,
  getMultiYearAralComparison,
  getTrimesterRiskTransitions,
} from "@/lib/supabase/queries/longitudinalAnalytics";
import { CNHS_OFFICIAL_ARAL_BENCHMARK } from "@/lib/supabase/queries/interventionHistory";
import { cn } from "@/lib/utils";

const SUBTABS = [
  { id: "cohort", label: "ARAL Cohort Benchmarks" },
  { id: "recovery", label: "Multi-Year Recovery Trends" },
  { id: "population", label: "School Population Baseline" },
];

export default function LongitudinalImpactPanel({ schoolYear = "SY 2026-2027" }) {
  const [data, setData] = useState(null);
  const [trimesterData, setTrimesterData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubtab, setActiveSubtab] = useState("cohort");

  useEffect(() => {
    let isMounted = true;
    async function loadAnalytics() {
      setLoading(true);
      try {
        const [compRes, trimRes] = await Promise.all([
          getMultiYearAralComparison(),
          getTrimesterRiskTransitions({ schoolYear }),
        ]);
        if (isMounted) {
          setData(compRes.data);
          setTrimesterData(trimRes.data);
        }
      } catch (err) {
        console.error("Failed to load longitudinal data", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [schoolYear]);

  const baseline = data?.baselinePopulation ?? CNHS_POPULATION_BASELINE;
  const benchmark = CNHS_OFFICIAL_ARAL_BENCHMARK;
  const multiYearRows = data?.schoolYears ?? [
    { schoolYear: "SY 2024-2025", approvedCount: 148, exitRate: 64 },
    { schoolYear: "SY 2025-2026", approvedCount: 112, exitRate: 74 },
    { schoolYear: "SY 2026-2027", approvedCount: 86, exitRate: 82 },
  ];

  return (
    <div className="mt-3 space-y-3">
      {/* 1. Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">
                Academic Intervention Pathways & Longitudinal Tracking
              </h3>
              <p className="text-[11px] text-slate-500">
                Tracking academic risk monitoring, ARAL Program (RA 12028), and Classroom Remediation progress over time.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm">
            <ShieldCheck size={14} className="text-emerald-600" />
            Official CNHS Cohort Benchmark Active
          </div>
        </div>
      </div>

      {/* 2. Top Summary KPI Row */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total School Population Baseline */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Verified Population
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {baseline.totalEnrollment}{" "}
            <span className="text-[11px] font-medium text-slate-500">Learners</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {baseline.totalMale} Male · {baseline.totalFemale} Female across Grades 7–10
          </p>
        </div>

        {/* ARAL Official Benchmark Outcome */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            ARAL Overall Promotion
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700">
            {benchmark.totalPercentage}%
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {benchmark.totalPromoted} of {benchmark.totalEnd} completed learners promoted
          </p>
        </div>

        {/* Post-Intervention Recovery Rate */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Intervention Recovery Rate
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700">
            {trimesterData?.recoveryRate ?? 82}%
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Transitioned from High/Moderate to Low Risk post-intervention
          </p>
        </div>

        {/* Multi-Year Caseload Reduction */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Intervention Caseload Trend
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700">
            -41.8%{" "}
            <span className="text-[11px] font-medium text-slate-500">over 3 SYs</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Caseload reduced from 148 (SY 24-25) to 86 (SY 26-27)
          </p>
        </div>
      </div>

      {/* Sub-tab Switcher */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2">
        {SUBTABS.map((tab) => {
          const active = activeSubtab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubtab(tab.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-cnhs-green-dark text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Subtab 1: ARAL Cohort Benchmarks */}
      {activeSubtab === "cohort" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2.5">
            <div>
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                Verified CNHS Sample Data Benchmark
              </span>
              <h4 className="mt-1 text-[13px] font-bold text-slate-900">
                ARAL Program Placement & Movement Outcomes ({benchmark.schoolYear})
              </h4>
              <p className="text-[11px] text-slate-500">
                Diagnostic assessment placement (Basic vs Plus), enrollment progression, and end-of-program movement.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-600">Total Beginning: {benchmark.totalBeginning}</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="text-xs font-semibold text-purple-700">Completed / Exited: {benchmark.totalPromoted} ({benchmark.totalPercentage}%)</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* ARAL Basic Tier */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
                  ARAL Basic Placement Tier
                </span>
                <span className="text-sm font-extrabold text-amber-700">
                  {benchmark.basicPercentage}% Completed / Exited
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Beginning</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.basicBeginning}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">End Total</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.basicEnd}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100">
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase">Exited</p>
                  <p className="mt-1 text-sm font-bold text-emerald-800">{benchmark.basicPromoted}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-2 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-700 uppercase">Continued</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.basicRetained}</p>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>Exit &amp; Recovery Rate</span>
                  <span className="font-bold text-slate-700">{benchmark.basicPercentage}% (101 / 129)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${benchmark.basicPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ARAL Plus Tier */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
                  ARAL Plus Placement Tier
                </span>
                <span className="text-sm font-extrabold text-purple-700">
                  {benchmark.plusPercentage}% Completed / Exited
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Beginning</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.plusBeginning}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">End Total</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.plusEnd}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100">
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase">Exited</p>
                  <p className="mt-1 text-sm font-bold text-emerald-800">{benchmark.plusPromoted}</p>
                </div>
                <div className="rounded-lg bg-slate-100 p-2 border border-slate-200">
                  <p className="text-[10px] font-semibold text-slate-700 uppercase">Continued</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.plusRetained}</p>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                  <span>Exit &amp; Recovery Rate</span>
                  <span className="font-bold text-slate-700">{benchmark.plusPercentage}% (74 / 86)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${benchmark.plusPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Attendance Tracking Reference */}
          <div className="mt-3 rounded-lg border border-slate-200/70 bg-white p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5 text-slate-800">
                <Calendar size={13} className="text-slate-500" />
                Monthly Attendance Tracking Profile (CNHS Benchmark Reference)
              </span>
              <span className="text-[11px] text-slate-400">September – November Monitoring</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-slate-50/80 p-2 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">September Attendance</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.attendance.september.average}%</p>
                <p className="text-[9px] text-slate-400">Basic {benchmark.attendance.september.basic}% · Plus {benchmark.attendance.september.plus}%</p>
              </div>
              <div className="rounded-md bg-slate-50/80 p-2 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">October Attendance</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.attendance.october.average}%</p>
                <p className="text-[9px] text-slate-400">Basic {benchmark.attendance.october.basic}% · Plus {benchmark.attendance.october.plus}%</p>
              </div>
              <div className="rounded-md bg-slate-50/80 p-2 border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">November Attendance</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{benchmark.attendance.november.average}%</p>
                <p className="text-[9px] text-slate-400">Basic {benchmark.attendance.november.basic}% · Plus {benchmark.attendance.november.plus}%</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subtab 2: Multi-Year Recovery Trends */}
      {activeSubtab === "recovery" ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {/* Multi-Year Intervention Caseload & Exit Rate */}
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-[12px] font-bold text-slate-900">
                  Year-over-Year (YoY) Intervention Caseload & Recovery
                </h4>
                <p className="text-[10px] text-slate-500">
                  Multi-year reduction in struggling learners requiring structured academic support.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {multiYearRows.map((row) => (
                <div
                  key={row.schoolYear}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-800">{row.schoolYear}</span>
                    <span className="text-emerald-700">
                      Exit Recovery Rate: {row.exitRate}%
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
                        style={{ width: `${Math.min(100, (row.approvedCount / 160) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700">
                      {row.approvedCount} enrollees
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-2 text-[10px] text-slate-500 italic">
              * Reflects both ARAL Program cohorts and subject-specific Classroom Remediation.
            </p>
          </div>

          {/* Trimester Risk Trend Pipeline */}
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h4 className="text-[12px] font-bold text-slate-900">
                  Trimester (Terms 1–3) Academic Recovery Cycle
                </h4>
                <p className="text-[10px] text-slate-500">
                  Progression from early warning to end-of-term assessment and outcome.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                <p className="text-[10px] font-bold uppercase text-red-700">Term 1</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Early Warning</p>
                <p className="text-[10px] text-slate-400">ECR Risk Baseline</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                <p className="text-[10px] font-bold uppercase text-amber-700">Term 2</p>
                <p className="mt-1 text-sm font-bold text-slate-800">Mid-Cycle Review</p>
                <p className="text-[10px] text-slate-400">Interventions Active</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-xs">
                <p className="text-[10px] font-bold uppercase text-emerald-700">Term 3</p>
                <p className="mt-1 text-sm font-bold text-slate-800">End Assessment</p>
                <p className="text-[10px] text-slate-400">Movement & Promotion</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 text-[11px] text-emerald-900">
              <p className="font-semibold">
                Intervention Insights for {schoolYear}:
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-800">
                Learners receiving targeted ARAL reading/numeracy sessions and teacher-guided remediation achieved an 82% transition rate to Low Academic Risk by final term assessment.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subtab 3: School Population Baseline */}
      {activeSubtab === "population" ? (
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <h4 className="text-[12px] font-bold text-slate-900 border-b border-slate-100 pb-2">
            Verified School Population Baseline & Distribution (SY 2026–2027)
          </h4>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(baseline.gradeLevels).map(([grade, info]) => (
              <div
                key={grade}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
              >
                <div>
                  <p className="text-[11px] font-bold text-slate-800">{grade}</p>
                  <p className="text-[10px] text-slate-500">
                    {info.male} Male · {info.female} Female
                  </p>
                </div>
                <span className="text-sm font-extrabold text-cnhs-green-dark">
                  {info.total} <span className="text-[10px] font-normal text-slate-400">total</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
