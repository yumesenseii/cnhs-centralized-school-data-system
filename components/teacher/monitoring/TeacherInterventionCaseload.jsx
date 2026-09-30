"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Sparkles, BookOpen, GraduationCap } from "lucide-react";
import {
  Pill,
  RiskPill,
  PriorityCue,
  interventionStyles,
  monitoringStatusStyles,
  tierStyles,
  readingLevelStyles,
  pathwayStyles,
} from "@/components/teacher/monitoring/shared";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import {
  INTERVENTION_STATUS,
  buildInterventionCards,
  collapseInterventionCaseload,
  displayInterventionStatus,
  filterInterventionCaseload,
  interventionTypeLabel,
  isAralCandidate,
  isRemediationCandidate,
} from "@/lib/monitoring/interventionLifecycle";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import { downloadInterventionCaseloadExcel } from "@/lib/reports/interventionCaseloadExport";
import { RECOMMENDATION, RISK_LEVEL, READING_LEVEL } from "@/lib/monitoring/recommendations";
import { sortLearnersByCheckFirst } from "@/lib/monitoring/riskPriority";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function Card({ label, value, active, onClick, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint || undefined}
      className={cn(
        "rounded-xl border bg-white px-3 py-2 text-left shadow-[0_4px_12px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow] duration-160",
        active
          ? "border-cnhs-green/50 ring-1 ring-cnhs-green/20"
          : "border-slate-100 hover:border-slate-200"
      )}
    >
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
      {hint ? (
        <p className="mt-0.5 text-[9px] font-medium leading-3 text-slate-400">
          {hint}
        </p>
      ) : null}
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  allLabel,
  options = [],
  "aria-label": ariaLabel,
}) {
  if (!options.length) return null;
  return (
    <AppSelect
      label={ariaLabel || allLabel}
      value={value}
      onChange={onChange}
      options={[allLabel, ...options]}
      size="field"
      triggerClassName="h-8 rounded-lg px-2 text-[11px]"
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
  const [pathwayTab, setPathwayTab] = useState("all");
  const [grade, setGrade] = useState("All grades");
  const [section, setSection] = useState("All sections");
  const [subject, setSubject] = useState("All subjects");
  const [tier, setTier] = useState("All Tiers");
  const [readingLevel, setReadingLevel] = useState("All Reading Levels");
  const [risk, setRisk] = useState("All risks");
  const [status, setStatus] = useState("All Status");
  const [facilitator, setFacilitator] = useState("All facilitators");
  const [schoolYear, setSchoolYear] = useState("All years");
  const [card, setCard] = useState(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const uniqueStudents = useMemo(
    () => collapseInterventionCaseload(students),
    [students]
  );

  const cards = useMemo(
    () => buildInterventionCards(uniqueStudents),
    [uniqueStudents]
  );

  const options = useMemo(() => {
    const grades = [
      ...new Set(uniqueStudents.map((s) => s.grade).filter(Boolean)),
    ];
    const sections = [
      ...new Set(uniqueStudents.map((s) => s.section).filter(Boolean)),
    ];
    const subjects = [
      ...new Set(uniqueStudents.map((s) => s.subject).filter(Boolean)),
    ];
    const years = [
      ...new Set(uniqueStudents.map((s) => s.schoolYear).filter(Boolean)),
    ];
    const facilitators = [
      ...new Set(
        uniqueStudents.map((s) => s.aralFacilitatorName).filter(Boolean)
      ),
    ];
    const risks = [
      ...new Set(uniqueStudents.map((s) => s.riskLevel).filter(Boolean)),
    ];
    return { grades, sections, subjects, years, facilitators, risks };
  }, [uniqueStudents]);

  const rows = useMemo(() => {
    let list = filterInterventionCaseload(uniqueStudents, {
      search,
      grade,
      section,
      subject,
      risk,
      status,
      facilitator,
      schoolYear,
      card,
    });

    if (pathwayTab === "aral") {
      list = list.filter(isAralCandidate);
    } else if (pathwayTab === "remediation") {
      list = list.filter(isRemediationCandidate);
    }

    if (tier !== "All Tiers") {
      list = list.filter(
        (s) => (s.aralPlacementTier || s.tier || "N/A").toLowerCase() === tier.toLowerCase()
      );
    }

    if (readingLevel !== "All Reading Levels") {
      list = list.filter((s) => s.readingLevel === readingLevel);
    }

    return sortLearnersByCheckFirst(list);
  }, [
    uniqueStudents,
    search,
    pathwayTab,
    grade,
    section,
    subject,
    tier,
    readingLevel,
    risk,
    status,
    facilitator,
    schoolYear,
    card,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    pathwayTab,
    grade,
    section,
    subject,
    tier,
    readingLevel,
    risk,
    status,
    facilitator,
    schoolYear,
    card,
  ]);

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
        scopeLabel:
          pathwayTab === "aral"
            ? "ARAL Program Caseload"
            : pathwayTab === "remediation"
              ? "Classroom Remediation Caseload"
              : "All Interventions",
      });
    } finally {
      setExporting(false);
    }
  }

  const allEqualNotStarted =
    cards.forIntervention > 0 &&
    cards.forIntervention === cards.notStarted &&
    cards.ongoing === 0 &&
    cards.completed === 0;

  return (
    <div className="space-y-3">
      {/* Pathway Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => setPathwayTab("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              pathwayTab === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            All Intervention Pathways
          </button>
          <button
            type="button"
            onClick={() => setPathwayTab("aral")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              pathwayTab === "aral"
                ? "bg-white text-sky-700 shadow-sm ring-1 ring-sky-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Sparkles size={13} className="text-sky-600" />
            ARAL Program (RA 12028)
          </button>
          <button
            type="button"
            onClick={() => setPathwayTab("remediation")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              pathwayTab === "remediation"
                ? "bg-white text-cnhs-green-dark shadow-sm ring-1 ring-emerald-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BookOpen size={13} className="text-cnhs-green-dark" />
            Classroom Remediation
          </button>
        </div>

        <p className="text-[11px] text-slate-500">
          Showing <span className="font-semibold text-slate-700">{rows.length}</span> intervention candidates
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Card
          label="All interventions"
          value={cards.forIntervention}
          active={card == null}
          onClick={() => setCard(null)}
          hint="Total caseload"
        />
        <Card
          label="Not started"
          value={cards.notStarted}
          active={card === "notStarted"}
          onClick={() => setCard(card === "notStarted" ? null : "notStarted")}
          hint={allEqualNotStarted ? "Pending first session" : undefined}
        />
        <Card
          label="Ongoing"
          value={cards.ongoing}
          active={card === "ongoing"}
          onClick={() => setCard(card === "ongoing" ? null : "ongoing")}
        />
        <Card
          label="Completed / Improved"
          value={cards.completed}
          active={card === "completed"}
          onClick={() => setCard(card === "completed" ? null : "completed")}
        />
        <Card
          label="Further support"
          value={cards.needsFurtherSupport}
          active={card === "needsFurtherSupport"}
          onClick={() =>
            setCard(
              card === "needsFurtherSupport" ? null : "needsFurtherSupport"
            )
          }
        />
        <Card
          label="Further monitoring"
          value={cards.forFurtherMonitoring}
          active={card === "forFurtherMonitoring"}
          onClick={() =>
            setCard(
              card === "forFurtherMonitoring" ? null : "forFurtherMonitoring"
            )
          }
        />
      </div>

      {/* Filter Bar */}
      <div className="space-y-2 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_2px_8px_rgba(15,23,42,0.02)]">
        {/* Primary Row: Search + Main Scopes + Export */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search learner name or student LRN…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
              value={subject}
              onChange={setSubject}
              allLabel="All subjects"
              options={options.subjects}
            />
            <button
              type="button"
              disabled={exporting || !rows.length}
              onClick={handleExport}
              title="Download the filtered intervention caseload as Excel"
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 size={13} className="animate-spin text-cnhs-green" />
              ) : (
                <Download size={13} />
              )}
              Export Excel
            </button>
          </div>
        </div>

        {/* Secondary Row: Specific Filters & Reset */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Filters:
          </span>

          <FilterSelect
            value={risk}
            onChange={setRisk}
            allLabel="All risks"
            options={[
              RISK_LEVEL.HIGH,
              RISK_LEVEL.MODERATE,
              RISK_LEVEL.LOW,
            ].filter((level) => options.risks.includes(level))}
          />

          <AppSelect
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              "All Status",
              INTERVENTION_STATUS.NOT_STARTED,
              INTERVENTION_STATUS.ONGOING,
              INTERVENTION_STATUS.COMPLETED,
              INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT,
              INTERVENTION_STATUS.FOR_FURTHER_MONITORING,
            ]}
            size="field"
            triggerClassName="h-8 rounded-lg px-2 text-[11px]"
          />

          {pathwayTab === "aral" || pathwayTab === "all" ? (
            <>
              <AppSelect
                label="Filter by ARAL Tier"
                value={tier}
                onChange={setTier}
                options={["All Tiers", "Basic", "Plus"]}
                size="field"
                triggerClassName="h-8 rounded-lg px-2 text-[11px]"
              />
              <AppSelect
                label="Filter by Reading Level"
                value={readingLevel}
                onChange={setReadingLevel}
                options={[
                  "All Reading Levels",
                  READING_LEVEL.FRUSTRATION,
                  READING_LEVEL.INSTRUCTIONAL,
                  READING_LEVEL.INDEPENDENT,
                ]}
                size="field"
                triggerClassName="h-8 rounded-lg px-2 text-[11px]"
              />
            </>
          ) : null}

          <FilterSelect
            value={facilitator}
            onChange={setFacilitator}
            allLabel="All facilitators"
            options={options.facilitators}
          />

          {options.years.length > 1 ? (
            <FilterSelect
              value={schoolYear}
              onChange={setSchoolYear}
              allLabel="All years"
              options={options.years}
            />
          ) : null}

          {(search ||
            grade !== "All grades" ||
            section !== "All sections" ||
            subject !== "All subjects" ||
            risk !== "All risks" ||
            status !== "All Status" ||
            tier !== "All Tiers" ||
            readingLevel !== "All Reading Levels" ||
            facilitator !== "All facilitators" ||
            schoolYear !== "All years" ||
            card !== null) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setGrade("All grades");
                setSection("All sections");
                setSubject("All subjects");
                setRisk("All risks");
                setStatus("All Status");
                setTier("All Tiers");
                setReadingLevel("All Reading Levels");
                setFacilitator("All facilitators");
                setSchoolYear("All years");
                setCard(null);
              }}
              className="ml-auto text-[11px] font-medium text-slate-500 hover:text-red-600"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Main Caseload Table */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80">
                {[
                  "Learner",
                  "Learning Area",
                  "Academic Risk",
                  "Assessment / Reading Level",
                  "Pathway / Tier",
                  "Teacher / Tutor",
                  "Status",
                  "Progress Result",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.length ? (
                pagedRows.map((row) => {
                  const statusLabel = displayInterventionStatus(
                    row.monitoringStatus
                  );
                  const progress = progressByStudent[row.studentId];
                  const hasFacilitator = Boolean(row.aralFacilitatorName);
                  const pathway = interventionTypeLabel(row);
                  const tierLabel = row.aralPlacementTier || row.tier;
                  const readingLvl = row.readingLevel || (pathway.includes("ARAL") ? "Frustration" : null);

                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                      onClick={() => onOpen?.(row)}
                    >
                      <td className="px-3 py-2.5">
                        <LearnerName
                          firstName={row.firstName}
                          middleName={row.middleName}
                          lastName={row.lastName}
                          name={row.name}
                        />
                        <p className="text-[10px] text-slate-400">
                          {row.studentNumber} · {row.grade} - {row.section}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[12px] font-medium text-slate-700">
                          {row.subject}
                        </span>
                        {row.classSubjectGrade ? (
                          <span className="ml-1 text-[11px] text-slate-400">
                            ({row.classSubjectGrade})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <RiskPill value={row.riskLevel} />
                      </td>
                      <td className="px-3 py-2.5">
                        {readingLvl && readingLvl !== "N/A" ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px]",
                              readingLevelStyles[readingLvl] ?? "bg-slate-100 text-slate-600"
                            )}
                          >
                            {readingLvl}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Classroom Check
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[10px] font-semibold",
                              pathwayStyles[pathway] ?? "bg-slate-100 text-slate-700"
                            )}
                          >
                            {pathway}
                          </span>
                          {tierLabel && tierLabel !== "N/A" ? (
                            <span
                              className={cn(
                                "inline-flex w-fit items-center rounded px-1.5 py-0.2 text-[9px]",
                                tierStyles[tierLabel] ?? "bg-indigo-50 text-indigo-700"
                              )}
                            >
                              Tier: {tierLabel}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-600">
                        {hasFacilitator ? (
                          row.aralFacilitatorName
                        ) : (
                          <span
                            className="text-slate-400"
                            title="ARAL tutors/facilitators are assigned by the Head Teacher / Principal"
                          >
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill
                          value={statusLabel}
                          styles={monitoringStatusStyles}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-slate-700">
                        {progress?.label || "—"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center">
                    <p className="text-[12px] font-semibold text-slate-600">
                      No intervention candidates match these filters
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-5 text-slate-500">
                      Candidates appear after subject grades are published and academic risk is analyzed.
                      ARAL qualification requires diagnostic assessment results and school head review.
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

      {!options.facilitators.length && rows.length > 0 ? (
        <p className="text-[10px] text-slate-400">
          Note: ARAL tutors/facilitators are formally assigned by the Head Teacher / Principal following diagnostic assessment.
        </p>
      ) : null}
    </div>
  );
}
