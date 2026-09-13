"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Pill,
  RiskPill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import {
  INTERVENTION_STATUS,
  buildInterventionCards,
  displayInterventionStatus,
  filterInterventionCaseload,
  interventionTypeLabel,
  learnerDisplayName,
} from "@/lib/monitoring/interventionLifecycle";
import { downloadInterventionCaseloadExcel } from "@/lib/reports/interventionCaseloadExport";
import { RECOMMENDATION, RISK_LEVEL } from "@/lib/monitoring/recommendations";
import { cn } from "@/lib/utils";

function Card({ label, value, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white px-3 py-2 text-left shadow-[0_4px_12px_rgba(15,23,42,0.03)]",
        active
          ? "border-cnhs-green/50 ring-1 ring-cnhs-green/20"
          : "border-slate-100 hover:border-slate-200"
      )}
    >
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[10px] font-semibold text-slate-500">{label}</p>
    </button>
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
  const [exporting, setExporting] = useState(false);

  const cards = useMemo(() => buildInterventionCards(students), [students]);

  const options = useMemo(() => {
    const grades = [...new Set(students.map((s) => s.grade).filter(Boolean))];
    const sections = [...new Set(students.map((s) => s.section).filter(Boolean))];
    const subjects = [...new Set(students.map((s) => s.subject).filter(Boolean))];
    const years = [...new Set(students.map((s) => s.schoolYear).filter(Boolean))];
    const facilitators = [
      ...new Set(students.map((s) => s.aralFacilitatorName).filter(Boolean)),
    ];
    return { grades, sections, subjects, years, facilitators };
  }, [students]);

  const rows = useMemo(
    () =>
      filterInterventionCaseload(students, {
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
      }),
    [
      students,
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

  const selectClass =
    "h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Card
          label="For intervention"
          value={cards.forIntervention}
          active={card == null}
          onClick={() => setCard(null)}
        />
        <Card
          label="Not started"
          value={cards.notStarted}
          active={card === "notStarted"}
          onClick={() => setCard(card === "notStarted" ? null : "notStarted")}
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
            setCard(card === "needsFurtherSupport" ? null : "needsFurtherSupport")
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
        <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectClass}>
          <option>All grades</option>
          {options.grades.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
        <select value={section} onChange={(e) => setSection(e.target.value)} className={selectClass}>
          <option>All sections</option>
          {options.sections.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectClass}>
          <option>All subjects</option>
          {options.subjects.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option>All types</option>
          <option>{RECOMMENDATION.ARAL}</option>
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className={selectClass}>
          <option>All risks</option>
          <option>{RISK_LEVEL.HIGH}</option>
          <option>{RISK_LEVEL.MODERATE}</option>
          <option>{RISK_LEVEL.LOW}</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option>All Status</option>
          <option>{INTERVENTION_STATUS.NOT_STARTED}</option>
          <option>{INTERVENTION_STATUS.ONGOING}</option>
          <option>{INTERVENTION_STATUS.COMPLETED}</option>
          <option>{INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT}</option>
          <option>{INTERVENTION_STATUS.FOR_FURTHER_MONITORING}</option>
        </select>
        <select
          value={facilitator}
          onChange={(e) => setFacilitator(e.target.value)}
          className={selectClass}
        >
          <option>All facilitators</option>
          {options.facilitators.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
        <select
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          className={selectClass}
        >
          <option>All years</option>
          {options.years.map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={exporting || !rows.length}
          onClick={handleExport}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          Excel
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
        <table className="min-w-[880px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {["Learner", "Subject", "Risk", "Intervention", "Facilitator", "Status", "Progress"].map(
                (col) => (
                  <th
                    key={col}
                    className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const statusLabel = displayInterventionStatus(row.monitoringStatus);
                const progress = progressByStudent[row.studentId];
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
                    onClick={() => onOpen?.(row)}
                  >
                    <td className="px-3 py-2">
                      <p className="text-[12px] font-semibold text-slate-800">
                        {learnerDisplayName(row)}
                      </p>
                      <p className="text-[10px] text-slate-400">{row.studentNumber}</p>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{row.subject}</td>
                    <td className="px-3 py-2">
                      <RiskPill value={row.riskLevel} />
                    </td>
                    <td className="px-3 py-2">
                      <Pill value={interventionTypeLabel(row)} styles={interventionStyles} />
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {row.aralFacilitatorName || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Pill value={statusLabel} styles={monitoringStatusStyles} />
                    </td>
                    <td className="px-3 py-2 text-[12px] font-semibold text-slate-700">
                      {progress?.label || "—"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[12px] text-slate-400">
                  No intervention candidates match these filters. RF recommendation
                  is not an assigned intervention by itself.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
