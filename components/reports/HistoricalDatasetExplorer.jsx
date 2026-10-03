"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  BarChart2,
  Calendar,
  Layers,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import { cn } from "@/lib/utils";

const GRADE_OPTIONS = ["All grades", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
const PATHWAY_OPTIONS = ["All Pathways", "ARAL Program (RA 12028)", "Classroom Remediation"];
const TIER_OPTIONS = ["All Tiers", "Basic", "Plus"];
const READING_OPTIONS = ["All Reading Levels", "Frustration", "Instructional", "Independent"];
const RISK_OPTIONS = ["All risks", "High Risk", "Moderate Risk", "Low Risk"];

export default function HistoricalDatasetExplorer({ initialSchoolYear = "SY 2025-2026" }) {
  const [schoolYear, setSchoolYear] = useState(initialSchoolYear);
  const [gradeLevel, setGradeLevel] = useState("All grades");
  const [pathway, setPathway] = useState("All Pathways");
  const [tier, setTier] = useState("All Tiers");
  const [readingLevel, setReadingLevel] = useState("All Reading Levels");
  const [riskLevel, setRiskLevel] = useState("All risks");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ learners: [], summary: {}, meta: {} });
  const [expandedId, setExpandedId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function fetchDataset() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          schoolYear,
          page: String(page),
          pageSize: "15",
        });
        if (gradeLevel !== "All grades") params.set("grade", gradeLevel);
        if (pathway !== "All Pathways") params.set("pathway", pathway);
        if (tier !== "All Tiers") params.set("tier", tier);
        if (readingLevel !== "All Reading Levels") params.set("readingLevel", readingLevel);
        if (riskLevel !== "All risks") params.set("risk", riskLevel);
        if (search) params.set("search", search);

        const res = await fetch(`/api/datasets/cnhs-2025-2026?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load dataset");
        const json = await res.json();
        if (!ignore) {
          setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchDataset();
    return () => {
      ignore = true;
    };
  }, [schoolYear, gradeLevel, pathway, tier, readingLevel, riskLevel, search, page]);

  const { learners = [], summary = {}, meta = {} } = data;

  function handleDownloadCsv() {
    window.open(`/api/datasets/cnhs-2025-2026?export=csv`, "_blank");
  }

  return (
    <div className="space-y-4">
      {/* Header & Cohort Identification Strip */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <BarChart2 size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Historical Learner Cohort Dataset ({schoolYear})
              </h2>
              <p className="text-[11px] text-slate-500">
                Calibrated against official CNHS historical baseline benchmark (1,800 term records · 600 students)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setSchoolYear("SY 2025-2026");
                setPage(1);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                schoolYear === "SY 2025-2026"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              SY 2025–2026 (Benchmark)
            </button>
            <button
              type="button"
              onClick={() => {
                setSchoolYear("SY 2026-2027");
                setPage(1);
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all",
                schoolYear === "SY 2026-2027"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              SY 2026–2027 (Active)
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download size={13} />
            Download Dataset (CSV)
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Cohort</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{summary.totalLearners ?? 0}</p>
          <p className="text-[9px] text-slate-400">Unique Learners</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">ARAL Basic</p>
          <p className="mt-1 text-lg font-bold text-sky-700">{summary.basicCount ?? 0}</p>
          <p className="text-[9px] text-slate-400">78.29% Promoted</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">ARAL Plus</p>
          <p className="mt-1 text-lg font-bold text-indigo-700">{summary.plusCount ?? 0}</p>
          <p className="text-[9px] text-slate-400">86.05% Promoted</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Classroom Remedial</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{summary.remedialCount ?? 0}</p>
          <p className="text-[9px] text-slate-400">Subject Specific</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">High Risk</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{summary.highRiskCount ?? 0}</p>
          <p className="text-[9px] text-slate-400">Needs Support</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Overall Promoted</p>
          <p className="mt-1 text-lg font-bold text-teal-700">{summary.promotedCount ?? 0}</p>
          <p className="text-[9px] text-slate-400">{summary.promotionRate ?? 0}% Recovery</p>
        </div>
      </div>

      {/* Two-Tier Filter Bar */}
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        {/* Primary Row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by learner ID (e.g. CNHS-SYN-2526-0001) or area needing attention…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <AppSelect
              label="Grade Level"
              value={gradeLevel}
              onChange={(v) => {
                setGradeLevel(v);
                setPage(1);
              }}
              options={GRADE_OPTIONS}
              size="field"
              triggerClassName="h-9 rounded-lg px-2.5 text-[11px]"
            />
            <AppSelect
              label="Intervention Pathway"
              value={pathway}
              onChange={(v) => {
                setPathway(v);
                setPage(1);
              }}
              options={PATHWAY_OPTIONS}
              size="field"
              triggerClassName="h-9 rounded-lg px-2.5 text-[11px]"
            />
          </div>
        </div>

        {/* Secondary Row */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Filters:
          </span>

          <AppSelect
            label="ARAL Placement Tier"
            value={tier}
            onChange={(v) => {
              setTier(v);
              setPage(1);
            }}
            options={TIER_OPTIONS}
            size="field"
            triggerClassName="h-8 rounded-lg px-2 text-[11px]"
          />

          <AppSelect
            label="Reading Level"
            value={readingLevel}
            onChange={(v) => {
              setReadingLevel(v);
              setPage(1);
            }}
            options={READING_OPTIONS}
            size="field"
            triggerClassName="h-8 rounded-lg px-2 text-[11px]"
          />

          <AppSelect
            label="Academic Risk Level"
            value={riskLevel}
            onChange={(v) => {
              setRiskLevel(v);
              setPage(1);
            }}
            options={RISK_OPTIONS}
            size="field"
            triggerClassName="h-8 rounded-lg px-2 text-[11px]"
          />

          {(gradeLevel !== "All grades" ||
            pathway !== "All Pathways" ||
            tier !== "All Tiers" ||
            readingLevel !== "All Reading Levels" ||
            riskLevel !== "All risks" ||
            search) && (
            <button
              type="button"
              onClick={() => {
                setGradeLevel("All grades");
                setPathway("All Pathways");
                setTier("All Tiers");
                setReadingLevel("All Reading Levels");
                setRiskLevel("All risks");
                setSearch("");
                setPage(1);
              }}
              className="ml-auto text-[11px] font-medium text-slate-500 hover:text-red-600"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Dataset Table & Trend Expansion */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-cnhs-green" />
          </div>
        ) : learners.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">No historical records match these filters</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search query or filter options.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-2.5">Learner ID</th>
                  <th className="px-3 py-2.5">Grade</th>
                  <th className="px-3 py-2.5">Academic Risk</th>
                  <th className="px-3 py-2.5">Area Needing Attention</th>
                  <th className="px-3 py-2.5">Pathway / Tier</th>
                  <th className="px-3 py-2.5">Phil-IRI Level</th>
                  <th className="px-3 py-2.5">Final Outcome</th>
                  <th className="px-3 py-2.5 text-right">Academic Risk Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[12px]">
                {learners.map((learner) => {
                  const isExpanded = expandedId === learner.learnerId;
                  const isAral = learner.interventionPathway.includes("ARAL");
                  return (
                    <tr key={learner.learnerId} className="group hover:bg-slate-50/50">
                      <td colSpan={8} className="p-0">
                        <div
                          className="flex cursor-pointer items-center justify-between px-3 py-2.5 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : learner.learnerId)}
                        >
                          <div className="grid w-full grid-cols-8 items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-slate-800">
                              {learner.learnerId}
                            </span>
                            <span className="text-slate-600">{learner.gradeLevel}</span>
                            <div>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                                  learner.riskLevel === "High Risk"
                                    ? "bg-rose-50 text-rose-700"
                                    : learner.riskLevel === "Moderate Risk"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-emerald-50 text-emerald-700"
                                )}
                              >
                                {learner.riskLevel}
                              </span>
                            </div>
                            <span className="text-slate-700 font-medium">{learner.weakSubject || "—"}</span>
                            <div>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                                  isAral
                                    ? "bg-sky-50 text-sky-700"
                                    : learner.interventionPathway.includes("Remediation")
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                )}
                              >
                                {isAral ? `ARAL: ${learner.aralPlacementTier}` : learner.interventionPathway}
                              </span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-600">
                                {learner.readingLevel !== "N/A" ? learner.readingLevel : "Classroom Check"}
                              </span>
                            </div>
                            <div>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                                  learner.movementOutcome === "Promoted" || learner.movementOutcome === "Improved"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                )}
                              >
                                {learner.movementOutcome}
                              </span>
                            </div>
                            <div className="flex justify-end">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Trend Card */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/70 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-[11px] font-semibold text-slate-700">
                                3-Term Academic Risk Trend & Progress Details:
                              </p>
                              <span className="text-[10px] text-slate-400">
                                Status: {learner.interventionStatus} · Reviewed by Principal
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              {["Term 1", "Term 2", "Term 3"].map((t) => {
                                const termData = learner.terms[t];
                                if (!termData) return null;
                                return (
                                  <div
                                    key={t}
                                    className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <span className="text-[11px] font-bold text-slate-800">{t}</span>
                                      <span className="text-[10px] font-semibold text-cnhs-green">
                                        GWA: {termData.generalAverage ?? "—"}
                                      </span>
                                    </div>

                                    <div className="mt-2 space-y-1 text-[11px]">
                                      <div className="flex justify-between text-slate-500">
                                        <span>English / Filipino:</span>
                                        <span className="font-semibold text-slate-700">
                                          {termData.englishGrade ?? "—"} / {termData.filipinoGrade ?? "—"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-500">
                                        <span>Math / Science:</span>
                                        <span className="font-semibold text-slate-700">
                                          {termData.mathematicsGrade ?? "—"} / {termData.scienceGrade ?? "—"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-500">
                                        <span>Assessment Score:</span>
                                        <span className="font-semibold text-slate-800">
                                          {t === "Term 1"
                                            ? termData.beginningAssessment ?? "—"
                                            : t === "Term 2"
                                              ? termData.middleAssessment ?? "—"
                                              : termData.endAssessment ?? "—"}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-500">
                                        <span>Monthly Attendance:</span>
                                        <span className="font-semibold text-slate-800">
                                          {termData.attendanceRate ? `${termData.attendanceRate}%` : "—"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
            <span>
              Showing page <strong className="text-slate-800">{meta.page}</strong> of{" "}
              <strong className="text-slate-800">{meta.totalPages}</strong> ({meta.total} total learners)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
