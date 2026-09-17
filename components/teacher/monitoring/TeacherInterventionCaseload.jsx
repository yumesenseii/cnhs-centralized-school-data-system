"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import {
  Pill,
  RiskPill,
  PriorityCue,
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
import { RECOMMENDATION, RISK_LEVEL } from "@/lib/monitoring/recommendations";
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
  const [grade, setGrade] = useState("All grades");
  const [section, setSection] = useState("All sections");
  const [subject, setSubject] = useState("All subjects");
  const [type, setType] = useState("All types");
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

  const rows = useMemo(
    () =>
      sortLearnersByCheckFirst(
        filterInterventionCaseload(uniqueStudents, {
          search,
          grade,
          section,
          subject,
          type,
          risk,
          status,
          facilitator,
          schoolYear,
          card,
        })
      ),
    [
      uniqueStudents,
      search,
      grade,
      section,
      subject,
      type,
      risk,
      status,
      facilitator,
      schoolYear,
      card,
    ]
  );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    grade,
    section,
    subject,
    type,
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
        scopeLabel: "Class caseload",
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
          hint={allEqualNotStarted ? "Same as total for now" : undefined}
        />
        <Card
          label="Ongoing"
          value={cards.ongoing}
          active={card === "ongoing"}
          onClick={() => setCard(card === "ongoing" ? null : "ongoing")}
        />
        <Card
          label="Completed"
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

      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search learner or LRN…"
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
        />
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
        {options.subjects.some((s) =>
          /english|filipino/i.test(String(s))
        ) ? (
          <AppSelect
            label="Filter by intervention type"
            value={type}
            onChange={setType}
            options={["All types", RECOMMENDATION.ARAL]}
            size="field"
            triggerClassName="h-8 rounded-lg px-2 text-[11px]"
          />
        ) : null}
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
        <button
          type="button"
          disabled={exporting || !rows.length}
          onClick={handleExport}
          title="Download the filtered intervention caseload as Excel (not the ARAL-recommended list)"
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          Export
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
        <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Learner",
                "Subject",
                "Risk",
                "Priority",
                "Intervention",
                "Facilitator",
                "Status",
                "Progress",
              ].map((col) => (
                <th
                  key={col}
                  className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
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
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
                    onClick={() => onOpen?.(row)}
                  >
                    <td className="px-3 py-2">
                      <LearnerName
                        firstName={row.firstName}
                        middleName={row.middleName}
                        lastName={row.lastName}
                        name={row.name}
                      />
                      <p className="text-[10px] text-slate-400">
                        {row.studentNumber}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {row.subject}
                    </td>
                    <td className="px-3 py-2">
                      <RiskPill value={row.riskLevel} />
                    </td>
                    <td className="px-3 py-2">
                      <PriorityCue learner={row} />
                    </td>
                    <td className="px-3 py-2">
                      <Pill
                        value={interventionTypeLabel(row)}
                        styles={interventionStyles}
                      />
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {hasFacilitator ? (
                        row.aralFacilitatorName
                      ) : (
                        <span
                          className="text-slate-400"
                          title="You identify ARAL learners; Head Teacher assigns the facilitator."
                        >
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Pill
                        value={statusLabel}
                        styles={monitoringStatusStyles}
                      />
                    </td>
                    <td className="px-3 py-2 text-[12px] font-semibold text-slate-700">
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
                    Candidates appear after ECR grades are published and risk is
                    generated. This caseload is interventions only — a
                    recommendation alone is not an assigned intervention.
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-slate-500">
                    Next:{" "}
                    <Link
                      href="/teacher/my-classes"
                      className="font-semibold text-cnhs-green-dark hover:underline"
                    >
                      publish ECR grades
                    </Link>
                    , clear filters above, or open ARAL Program if you are a
                    facilitator.
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
          Facilitators are assigned by the Head Teacher. You identify Eng/Fil
          ARAL learners here.
        </p>
      ) : null}
    </div>
  );
}
