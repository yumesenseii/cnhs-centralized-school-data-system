"use client";

import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Search,
  BookOpen,
  FileText,
  Pencil,
  ChevronRight,
  Eye,
  ClipboardList,
  FileSearch,
  LifeBuoy,
  CalendarClock,
} from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import PhilIriImportModal from "@/components/teacher/monitoring/PhilIriImportModal";
import PhilIriDocumentsModal from "@/components/teacher/monitoring/PhilIriDocumentsModal";
import PhilIriEnterResultModal from "@/components/teacher/monitoring/PhilIriEnterResultModal";
import StudentMonitoringSidePanel from "@/components/teacher/monitoring/StudentMonitoringSidePanel";
import { aggregateAralLearners, filterAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
import {
  aralPeriodLabel,
  getAralPeriodPermissions,
  normalizeAralPeriod,
} from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function AralMonitoringSection({
  students = [],
  filterOptions = { grades: [], sections: [], subjects: [] },
  grade,
  setGrade,
  section,
  setSection,
  subject,
  setSubject,
  searchTerm,
  setSearchTerm,
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  // Authoritative ARAL assessment period (BOSY/MOSY/EOSY), owned by system
  // configuration — never inferred from the academic term here.
  aralPeriod = null,
  onRefresh,
  onViewLearner,
}) {
  const effectivePeriod = normalizeAralPeriod(aralPeriod) || "BOSY";
  const periodPermissions = getAralPeriodPermissions(effectivePeriod);
  const bosyEditable = periodPermissions.BOSY.editable === true;
  // 4 Primary Workflow Tabs
  const [activeWorkflowTab, setActiveWorkflowTab] = useState("all");

  // Contextual dropdown filters
  const [assessmentStatus, setAssessmentStatus] = useState("All assessment statuses");
  const [readingLevel, setReadingLevel] = useState("All reading levels");

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isEnterResultOpen, setIsEnterResultOpen] = useState(false);
  const [selectedStudentForResult, setSelectedStudentForResult] = useState(null);
  const [selectedLearnerForProfile, setSelectedLearnerForProfile] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);

  // 1. Filter and deduplicate students to unique language/reading learners
  const languageLearners = useMemo(() => {
    return aggregateAralLearners(students);
  }, [students]);

  // Principal-approved referrals enter the assessment queue WITHOUT
  // requiring a BEG result first (approved → pending assessment).
  function isApprovedAwaitingAssessment(row) {
    const approval = String(row.aralApprovalStatus || "");
    if (!/approved/i.test(approval)) return false;
    if (row.philIriScore != null) return false;
    const st = row.interventionStatus || row.monitoringStatus || "";
    if (/Active Intervention|Progressing|In Progress|Assigned|Completed/i.test(st)) return false;
    return true;
  }

  // 2. Metrics calculation
  const metrics = useMemo(() => {
    let forAssessmentCount = 0;
    let forReviewCount = 0;
    let activeCount = 0;
    let assessmentDueCount = 0;

    languageLearners.forEach((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "Needs Review";
      const hasScore = s.philIriScore != null;

      if (isApprovedAwaitingAssessment(s)) {
        forAssessmentCount++;
      } else if (!hasScore && (st === "Needs Review" || st === "ARAL Candidate" || st === "For Review")) {
        forAssessmentCount++;
      } else if (hasScore && (st === "Needs Review" || st === "For Review" || st === "ARAL Candidate")) {
        forReviewCount++;
      } else if (st === "Active Intervention" || st === "Progressing" || st === "In Progress" || st === "Assigned") {
        activeCount++;
      } else if (st === "For Midline Assessment" || st === "For EOSY Assessment") {
        assessmentDueCount++;
      }
    });

    return {
      total: languageLearners.length,
      forAssessmentCount,
      forReviewCount,
      activeCount,
      assessmentDueCount,
    };
  }, [languageLearners]);

  // 3. Tab Categorization
  const categorizedRows = useMemo(() => {
    return languageLearners.filter((row) => {
      const status = row.interventionStatus || row.monitoringStatus || "Needs Review";
      const hasScore = row.philIriScore != null;

      switch (activeWorkflowTab) {
        case "for_assessment":
          return (
            isApprovedAwaitingAssessment(row) ||
            (!hasScore && (status === "Needs Review" || status === "ARAL Candidate" || status === "For Review"))
          );
        
        case "for_review":
          return hasScore && (status === "Needs Review" || status === "For Review" || status === "ARAL Candidate");

        case "active":
          return status === "Active Intervention" || status === "Progressing" || status === "In Progress" || status === "Assigned";

        case "assessment_due":
          return status === "For Midline Assessment" || status === "For EOSY Assessment";

        default:
          return true;
      }
    });
  }, [languageLearners, activeWorkflowTab]);

  // 4. Secondary filters & search
  const filteredRows = useMemo(() => {
    return filterAralLearners(categorizedRows, {
      searchTerm,
      grade,
      section,
      subject,
      assessmentStatus,
      readingLevel,
    });
  }, [categorizedRows, searchTerm, grade, section, subject, assessmentStatus, readingLevel]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleViewLearner(row) {
    if (onViewLearner) {
      onViewLearner(row);
    } else {
      setSelectedLearnerForProfile(row);
    }
  }

  // Tab empty states text
  const emptyStateTextMap = {
    all: "No reading intervention learners found for the selected filters.",
    for_assessment: "No learners are currently waiting for baseline assessment.",
    for_review: "No learners are currently waiting for review after assessment.",
    active: "No active intervention records found for the selected filter.",
    assessment_due: "No learners are currently due for midline or EOSY assessment.",
  };

  return (
    <div className="space-y-3.5">
      {/* 1. CONTEXTUAL TOOLBAR (Replaces Repetitive Card Title) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/70">
            <BookOpen size={13} className="text-cnhs-green" />
            ARAL Monitoring · English & Filipino · Phil-IRI
          </span>
          <span
            title="Authoritative ARAL assessment period (system configuration)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-cnhs-green-soft px-2.5 py-1 text-xs font-semibold text-cnhs-green-dark border border-emerald-200/70"
          >
            {aralPeriodLabel(effectivePeriod)}
          </span>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDocsOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <FileText size={13} className="text-slate-500" />
            <span>Reading Assessment Records</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedStudentForResult(null);
              setIsEnterResultOpen(true);
            }}
            disabled={!bosyEditable}
            title={
              bosyEditable
                ? "Record Phil-IRI baseline screening (Beginning Assessment)"
                : "Baseline screening is only available during the Beginning Assessment (BOSY) period"
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-cnhs-green-dark shadow-xs hover:bg-emerald-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil size={12} />
            <span>Enter Assessment Result</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            disabled={!bosyEditable}
            title={
              bosyEditable
                ? "Import Phil-IRI baseline screening"
                : "Baseline screening import is only available during the Beginning Assessment (BOSY) period"
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#246f54] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet size={13} />
            <span>Import Form 1B</span>
          </button>
        </div>
      </div>

      {/* 2. DIAGNOSTIC PIPELINE / PROCESS STEPPER */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 shadow-xs text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-500">1</span> Candidate</span>
        <ChevronRight size={14} className="text-slate-300 mx-1 shrink-0" />
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-500">2</span> Assessment</span>
        <ChevronRight size={14} className="text-slate-300 mx-1 shrink-0" />
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-500">3</span> Review</span>
        <ChevronRight size={14} className="text-slate-300 mx-1 shrink-0" />
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-500">4</span> Intervention</span>
        <ChevronRight size={14} className="text-slate-300 mx-1 shrink-0" />
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-500">5</span> Progress</span>
        <ChevronRight size={14} className="text-slate-300 mx-1 shrink-0" />
        <span className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px] text-slate-500">6</span> Completed</span>
      </div>

      {/* 3. PRIMARY SUMMARY CARDS (Display only) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[
          { id: "for_assessment", label: "For Assessment", count: metrics.forAssessmentCount, desc: "Awaiting baseline", icon: ClipboardList, tile: "bg-amber-50 text-amber-700 ring-amber-200/60", countText: "text-slate-900", descText: "text-slate-400" },
          { id: "for_review", label: "For Review", count: metrics.forReviewCount, desc: "Screened candidates", icon: FileSearch, tile: "bg-sky-50 text-sky-700 ring-sky-200/60", countText: "text-slate-900", descText: "text-slate-400" },
          { id: "active", label: "Active Intervention", count: metrics.activeCount, desc: "Currently in progress", icon: LifeBuoy, tile: "bg-blue-50 text-blue-700 ring-blue-200/60", countText: "text-blue-700", descText: "text-blue-600/80" },
          { id: "assessment_due", label: "Assessment Due", count: metrics.assessmentDueCount, desc: "Midline or EOSY", icon: CalendarClock, tile: "bg-red-50 text-red-700 ring-red-200/60", countText: "text-red-700", descText: "text-red-600/80" },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
          <div
            key={tab.id}
            className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
          >
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1", tab.tile)}>
              <Icon size={18} strokeWidth={1.9} />
            </span>
            <span className="block min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {tab.label}
              </span>
              <span className={cn(
                "mt-1 block text-[26px] font-bold leading-none tracking-tight",
                tab.countText
              )}>
                {tab.count}
              </span>
              <span className={cn("mt-1.5 block text-[11px] leading-4", tab.descText)}>{tab.desc}</span>
            </span>
          </div>
          );
        })}
      </div>

      {/* 4. SEARCH & CONTEXTUAL FILTERS */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search learner name or LRN..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-cnhs-green transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.sections?.length > 0 && (
            <AppSelect
              label="All sections"
              value={section}
              onChange={setSection}
              options={["All sections", ...filterOptions.sections]}
              size="pill"
              triggerClassName="h-8 text-[11px]"
            />
          )}

          <AppSelect
            label="All subjects"
            value={subject}
            onChange={setSubject}
            options={["All subjects", "English", "Filipino"]}
            size="pill"
            triggerClassName="h-8 text-[11px]"
          />

          <AppSelect
            label="All assessment statuses"
            value={assessmentStatus}
            onChange={setAssessmentStatus}
            options={["All assessment statuses", "Not Screened", "Pending", "Assessed"]}
            size="pill"
            triggerClassName="h-8 text-[11px]"
          />

          <AppSelect
            label="All reading levels"
            value={readingLevel}
            onChange={setReadingLevel}
            options={["All reading levels", "Not Screened", "Instructional", "Frustration", "Independent"]}
            size="pill"
            triggerClassName="h-8 text-[11px]"
          />
        </div>
      </div>

      {/* 5. LEARNER ROSTER TABLE */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-400">
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Grade & Section</th>
                <th className="px-4 py-3">Current Stage</th>
                <th className="px-4 py-3">Referral / Evidence</th>
                <th className="px-4 py-3">Assessment Result</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Next Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => {
                  const gradeVal = row.classSubjectGrade ?? row.academicGrade;
                  const academicTrigger = gradeVal != null
                    ? `${row.subject || 'Subject'} (Grade ${gradeVal})`
                    : row.subject || "English / Filipino";

                  const st = row.interventionStatus || row.aralStatus || "Needs Review";
                  // BOSY is screening (GST → further assessment), never an
                  // automatic placement: no score yet means awaiting screening.
                  let stage = "Review";
                  if (isApprovedAwaitingAssessment(row)) stage = "Waiting for Reading Assessment";
                  else if (row.philIriScore == null) stage = "Beginning Assessment";
                  else if (st === "Needs Review" || st === "For Review") stage = "Review";
                  else if (st === "Active Intervention") stage = "Under ARAL Intervention";
                  else if (st === "For Midline Assessment") stage = "Mid-Year Assessment";
                  else if (st === "For EOSY Assessment") stage = "End-of-Year Assessment";
                  else if (st.includes("Completed")) stage = "Completed";

                  return (
                    <tr
                      key={row.id || row.studentId || row.lrn}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          <LearnerName
                            firstName={row.firstName}
                            lastName={row.lastName}
                            name={row.name}
                          />
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                          {row.lrn || row.studentNumber || "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {row.grade ? `Grade ${row.grade}` : "Grade"} · {row.section || "Section"}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                          {stage}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {academicTrigger}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {row.philIriScore != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-900 text-[11px]">
                              {row.philIriScore}/20
                            </span>
                            <span className={cn(
                              "text-[10px] font-semibold",
                              row.readingLevel === "Frustration"
                                ? "text-rose-600"
                                : row.readingLevel === "Instructional"
                                ? "text-amber-600"
                                : row.readingLevel === "Independent"
                                ? "text-cnhs-green-dark"
                                : "text-slate-500"
                            )}>
                              {row.readingLevel || "Not Set"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium">
                            Not Screened
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 border border-emerald-200/50 px-2.5 py-0.5 text-[10px] font-bold text-cnhs-green-dark">
                          {st}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {activeWorkflowTab === "needs_review" && (row.interventionStatus === "Approved" || row.candidateStatus === "Approved") ? (
                           <button
                             type="button"
                             onClick={(e) => { 
                               e.stopPropagation();
                               setSelectedStudentForResult(row); 
                               setIsEnterResultOpen(true); 
                             }}
                             className="inline-flex items-center gap-1 rounded-lg bg-cnhs-green-dark px-2 py-1 text-[10px] font-semibold text-white shadow-xs hover:bg-[#246f54] transition-colors cursor-pointer mr-2"
                           >
                             📝 Enter GST/Phil-IRI Result
                           </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleViewLearner(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Eye size={12} className="text-slate-500" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">
                      {emptyStateTextMap[activeWorkflowTab] || "No learners match your search or filter criteria."}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Learners progress through Intake Review &rarr; Phil-IRI Screening &rarr; Active Intervention &rarr; Midline &rarr; EOSY.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <MonitoringTablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredRows.length}
          onPageChange={setPage}
        />
      </div>

      {/* MODALS */}
      {/* 1. Unified Learner Support Profile Panel (ARAL context) */}
      <StudentMonitoringSidePanel
        isOpen={Boolean(selectedLearnerForProfile)}
        onClose={() => setSelectedLearnerForProfile(null)}
        learner={selectedLearnerForProfile || {}}
        schoolYear={schoolYear}
        onRefresh={onRefresh}
        context="aral"
        aralPeriod={effectivePeriod}
        currentQuarterNumber={quarter}
        isLanguageTeacher={true}
      />

      {/* 2. Phil-IRI Import Modal */}
      <PhilIriImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        enrolledStudents={languageLearners}
        teacherId={teacherId}
        schoolYear={schoolYear}
        quarter={quarter}
        onSuccess={onRefresh}
      />

      {/* 3. Phil-IRI Documents Repository Modal */}
      <PhilIriDocumentsModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
        enrolledStudents={languageLearners}
        schoolYear={schoolYear}
        quarter={quarter}
      />

      {/* 4. Individual Enter Score Modal (BOSY baseline screening) */}
      <PhilIriEnterResultModal
        isOpen={isEnterResultOpen}
        onClose={() => {
          setIsEnterResultOpen(false);
          setSelectedStudentForResult(null);
        }}
        learner={selectedStudentForResult}
        enrolledStudents={languageLearners}
        teacherId={teacherId}
        schoolYear={schoolYear}
        quarter={quarter}
        aralPeriod={effectivePeriod}
        onSuccess={onRefresh}
      />
    </div>
  );
}
