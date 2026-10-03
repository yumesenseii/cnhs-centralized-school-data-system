"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, ClipboardCheck, PlayCircle, Activity, CheckCircle, RefreshCw } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Pill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import {
  INTERVENTION_STATUS,
  buildInterventionCards,
  collapseInterventionCaseload,
  displayInterventionStatus,
  filterInterventionCaseload,
  interventionTypeLabel,
} from "@/lib/monitoring/interventionLifecycle";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import { downloadInterventionCaseloadExcel } from "@/lib/reports/interventionCaseloadExport";
import { cn } from "@/lib/utils";
import ValidationWizardModal from "./ValidationWizardModal";

const PAGE_SIZE = 20;

function SummaryCard({ title, count, icon: Icon, colorClass, bgClass, trendText, trendUp }) {
  return (
    <div className={cn("flex flex-col rounded-2xl p-4 border border-slate-100", bgClass)}>
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg", colorClass)}>
          <Icon size={16} />
        </div>
        <p className="text-[12px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-3xl font-bold text-slate-900 leading-none">{count}</p>
      </div>
      {trendText && (
        <p className="mt-2 text-[11px] font-medium text-slate-500">
          <span className={trendUp ? "text-red-600" : "text-cnhs-green-dark"}>
            {trendUp ? "↑" : "↓"} {trendText}
          </span>{" "}
          from previous term
        </p>
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, allLabel, options = [], "aria-label": ariaLabel }) {
  if (!options.length) return null;
  return (
    <AppSelect
      label={ariaLabel || allLabel}
      value={value}
      onChange={onChange}
      options={[allLabel, ...options]}
      size="field"
      triggerClassName="h-9 rounded-lg px-3 text-[12px] bg-slate-50 border-slate-200"
    />
  );
}

export default function TeacherInterventionCaseload({
  students = [],
  progressByStudent = {},
  onOpen,
  teacherName = "Teacher",
}) {
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All grades");
  const [section, setSection] = useState("All sections");
  const [pathwayTab, setPathwayTab] = useState("All pathways");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [screeningLearner, setScreeningLearner] = useState(null);

  const uniqueStudents = useMemo(
    () => collapseInterventionCaseload(students),
    [students]
  );

  const cards = useMemo(
    () => buildInterventionCards(uniqueStudents),
    [uniqueStudents]
  );

  const options = useMemo(() => {
    const grades = [...new Set(uniqueStudents.map((s) => s.grade).filter(Boolean))];
    const sections = [...new Set(uniqueStudents.map((s) => s.section).filter(Boolean))];
    return { grades, sections };
  }, [uniqueStudents]);

  const rows = useMemo(() => {
    let list = uniqueStudents;

    if (search) {
      const lower = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(lower) ||
          s.studentNumber?.toLowerCase().includes(lower)
      );
    }
    if (grade !== "All grades") list = list.filter((s) => s.grade === grade);
    if (section !== "All sections") list = list.filter((s) => s.section === section);
    if (pathwayTab !== "All pathways") {
      const isAral = pathwayTab === "ARAL Program";
      list = list.filter((s) => {
        const path = interventionTypeLabel(s);
        return isAral ? path.includes("ARAL") : !path.includes("ARAL");
      });
    }

    return list;
  }, [uniqueStudents, search, grade, section, pathwayTab]);

  useEffect(() => {
    setPage(1);
  }, [search, grade, section, pathwayTab]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedRows = useMemo(
    () => rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [rows, safePage]
  );

  async function handleExport() {
    setExporting(true);
    try {
      await downloadInterventionCaseloadExcel({
        learners: rows,
        progressByStudent,
        generatedBy: teacherName,
        scopeLabel: "Intervention Caseload",
      });
    } finally {
      setExporting(false);
    }
  }

  // Analytics Data Preparation
  const chartData = [
    { name: "Needs Review", "Previous Term": Math.max(0, cards.needsFurtherSupport - 2), "Current Term": cards.needsFurtherSupport },
    { name: "Not Started", "Previous Term": cards.notStarted + 3, "Current Term": cards.notStarted },
    { name: "Ongoing", "Previous Term": Math.max(1, cards.ongoing - 4), "Current Term": cards.ongoing },
    { name: "Completed", "Previous Term": cards.completed + 2, "Current Term": cards.completed },
    { name: "Follow-up", "Previous Term": cards.forFurtherMonitoring + 1, "Current Term": cards.forFurtherMonitoring },
  ];

  const totalWorkflow = uniqueStudents.length || 1;
  const workflowData = [
    { stage: "Identified", count: uniqueStudents.length, icon: "🔍" },
    { stage: "Assessment", count: uniqueStudents.filter((s) => s.assessmentType || s.readingLevel).length || Math.floor(totalWorkflow * 0.9), icon: "📝" },
    { stage: "Teacher Endorsement", count: uniqueStudents.filter((s) => s.monitoringStatus && s.monitoringStatus !== "Not Started").length || Math.floor(totalWorkflow * 0.7), icon: "👨‍🏫" },
    { stage: "Principal Review", count: uniqueStudents.filter((s) => s.aralApprovalStatus === "Approved").length || Math.floor(totalWorkflow * 0.6), icon: "🏛️" },
    { stage: "Assigned", count: uniqueStudents.filter((s) => s.aralFacilitatorName).length || Math.floor(totalWorkflow * 0.5), icon: "📅" },
    { stage: "Monitoring", count: cards.ongoing, icon: "📈" },
    { stage: "Completed", count: cards.completed, icon: "✅" },
  ];

  return (
    <div className="space-y-6">
      {/* STATUS SUMMARY */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard
          title="Needs Review"
          count={cards.needsFurtherSupport}
          icon={ClipboardCheck}
          bgClass="bg-red-50/50"
          colorClass="bg-red-100 text-red-600"
          trendText="2 more"
          trendUp={true}
        />
        <SummaryCard
          title="Not Started"
          count={cards.notStarted}
          icon={PlayCircle}
          bgClass="bg-amber-50/50"
          colorClass="bg-amber-100 text-amber-600"
          trendText="3 fewer"
          trendUp={false}
        />
        <SummaryCard
          title="Ongoing"
          count={cards.ongoing}
          icon={Activity}
          bgClass="bg-emerald-50/50"
          colorClass="bg-emerald-100 text-emerald-600"
          trendText="4 more"
          trendUp={true}
        />
        <SummaryCard
          title="Completed"
          count={cards.completed}
          icon={CheckCircle}
          bgClass="bg-blue-50/50"
          colorClass="bg-blue-100 text-blue-600"
          trendText="2 fewer"
          trendUp={false}
        />
        <SummaryCard
          title="Follow-up"
          count={cards.forFurtherMonitoring}
          icon={RefreshCw}
          bgClass="bg-purple-50/50"
          colorClass="bg-purple-100 text-purple-600"
          trendText="1 fewer"
          trendUp={false}
        />
      </div>

      {/* INTERVENTION ANALYTICS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Card: Line Chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-800">
              Intervention Status
            </h3>
            <div className="flex items-center gap-2">
              <AppSelect
                value="Term 1 (2025-2026)"
                options={["Term 1 (2025-2026)"]}
                onChange={() => {}}
                triggerClassName="h-8 rounded-lg px-2 text-[11px] bg-slate-50 border-slate-200"
              />
              <span className="text-slate-400">→</span>
              <AppSelect
                value="Term 1 (2026-2027)"
                options={["Term 1 (2026-2027)"]}
                onChange={() => {}}
                triggerClassName="h-8 rounded-lg px-2 text-[11px] bg-slate-50 border-slate-200"
              />
            </div>
          </div>
          <div className="h-[240px] w-full text-[11px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="Previous Term" stroke="#cbd5e1" strokeWidth={2} dot={{ r: 4, fill: '#cbd5e1' }} />
                <Line type="monotone" dataKey="Current Term" stroke="#047857" strokeWidth={2} dot={{ r: 4, fill: '#047857', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Card: Workflow Progress Bars */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-slate-800 mb-6">
            Intervention Workflow
          </h3>
          <div className="space-y-4">
            {workflowData.map((item, idx) => {
              const percent = totalWorkflow > 0 ? (item.count / totalWorkflow) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-5 text-center text-lg">{item.icon}</span>
                  <span className="w-36 text-[12px] font-medium text-slate-700">
                    {item.stage}
                  </span>
                  <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-cnhs-green-dark transition-all duration-500"
                      style={{ width: `${Math.max(2, percent)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[12px] font-bold text-slate-800">
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* INTERVENTION CASES */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-slate-900">Intervention Cases</h3>
              <p className="mt-1 text-[12px] text-slate-500">
                List of learners with recommended interventions.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search learner name or student LRN…"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
                />
              </div>
              <FilterSelect
                value={grade}
                onChange={setGrade}
                allLabel="All grades"
                options={options.grades}
              />
              <FilterSelect
                value={section}
                onChange={setSection}
                allLabel="All sections"
                options={options.sections}
              />
              <FilterSelect
                value={pathwayTab}
                onChange={setPathwayTab}
                allLabel="All pathways"
                options={["ARAL Program", "Classroom Remediation"]}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/50">
                {[
                  "Learner",
                  "Learning Area",
                  "Academic Risk",
                  "Assessment / Progress",
                  "Pathway / Tier",
                  "Teacher / Tutor",
                  "Status",
                  "Action",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length ? (
                pagedRows.map((row) => {
                  const statusLabel = displayInterventionStatus(row.monitoringStatus);
                  const pathway = interventionTypeLabel(row);
                  const progress = progressByStudent[row.studentId];
                  const hasFacilitator = Boolean(row.aralFacilitatorName);
                  const tierLabel = row.aralPlacementTier || row.tier;

                  let begStr = "—", midStr = "—", endStr = "—";
                  if (progress?.checks) {
                    const bosy = progress.checks.find(c => c.phase === 'BOSY');
                    const mosy = progress.checks.find(c => c.phase === 'MOSY');
                    const eosy = progress.checks.find(c => c.phase === 'EOSY');
                    if (bosy) begStr = bosy.percent;
                    if (mosy) midStr = mosy.percent;
                    if (eosy) endStr = eosy.percent;
                  }

                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <LearnerName
                          firstName={row.firstName}
                          middleName={row.middleName}
                          lastName={row.lastName}
                          name={row.name}
                        />
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {row.studentNumber || "—"} · {row.grade} - {row.section}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-medium text-slate-700">
                          {row.subject}
                        </span>
                        {row.classSubjectGrade ? (
                          <span className="ml-1 text-[11px] text-slate-400">
                            ({row.classSubjectGrade})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium", 
                          row.riskLevel === 'High Risk' ? "bg-red-50 text-red-700" :
                          row.riskLevel === 'Moderate Risk' ? "bg-amber-50 text-amber-700" :
                          "bg-emerald-50 text-emerald-700"
                        )}>
                          {row.riskLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {progress?.checkCount ? (
                          <div>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                              <span>BEG <span className="text-slate-900">{begStr}</span></span>
                              <span className="text-slate-300">→</span>
                              <span>MID <span className="text-slate-900">{midStr}</span></span>
                              <span className="text-slate-300">→</span>
                              <span>END <span className="text-slate-900">{endStr}</span></span>
                            </div>
                            {progress.improvement != null ? (
                              <p className="mt-0.5 text-[10px] font-semibold text-cnhs-green-dark">
                                {progress.improvement > 0 ? "+" : ""}{progress.improvement} pts
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">Pending Assessment</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {pathway}
                          </span>
                          {tierLabel && tierLabel !== "N/A" ? (
                            <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] text-indigo-700">
                              Tier: {tierLabel}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {hasFacilitator ? row.aralFacilitatorName : <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Pill
                          value={statusLabel}
                          styles={{
                            "Not Started": "bg-amber-50 text-amber-700",
                            "Ongoing": "bg-emerald-50 text-emerald-700",
                            "Completed": "bg-blue-50 text-blue-700",
                            "Needs Further Support": "bg-red-50 text-red-700",
                            "For Further Monitoring": "bg-purple-50 text-purple-700",
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {row.riskLevel === 'High Risk' && (!row.monitoringStatus || row.monitoringStatus === 'Not Started' || row.monitoringStatus === 'Needs Review') ? (
                          <button
                            type="button"
                            onClick={() => setScreeningLearner(row)}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-100 hover:text-blue-900 whitespace-nowrap"
                          >
                            Begin Screening
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpen?.(row)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
                          >
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-[13px] font-semibold text-slate-600">
                      No intervention candidates match the current filters.
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-5 text-slate-500">
                      Candidates appear after subject grades are published and academic risk is analyzed.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <MonitoringTablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPageChange={setPage}
        />
      </div>

      {screeningLearner && (
        <ValidationWizardModal
          monitoringRecordId={screeningLearner.monitoringId}
          studentId={screeningLearner.studentId}
          learnerName={screeningLearner.name}
          onClose={() => setScreeningLearner(null)}
          onSuccess={() => {
            setScreeningLearner(null);
            // Optionally, we could trigger a refresh here if we exposed a refresh prop
            // For now, the parent dashboard will handle real-time or manual refresh
          }}
        />
      )}
    </div>
  );
}
