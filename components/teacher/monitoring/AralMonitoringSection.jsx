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
} from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import PhilIriImportModal from "@/components/teacher/monitoring/PhilIriImportModal";
import PhilIriDocumentsModal from "@/components/teacher/monitoring/PhilIriDocumentsModal";
import PhilIriEnterResultModal from "@/components/teacher/monitoring/PhilIriEnterResultModal";
import AralLearnerProfileModal from "@/components/teacher/monitoring/AralLearnerProfileModal";
import { aggregateAralLearners, filterAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
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
  onRefresh,
  onViewLearner,
}) {
  // 6 Action-Focused Tabs
  const [activeWorkflowTab, setActiveWorkflowTab] = useState("needs_review");

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

  // 2. Metrics calculation
  const metrics = useMemo(() => {
    const total = languageLearners.length;
    const withBosyScore = languageLearners.filter((s) => s.philIriScore != null).length;

    const needsReviewCount = languageLearners.filter((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "Needs Review";
      return (
        st === "Needs Review" ||
        st === "For Review" ||
        st === "ARAL Candidate" ||
        (!st.includes("Active") && !st.includes("Completed") && !st.includes("Summer"))
      );
    }).length;

    const activeCount = languageLearners.filter((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "";
      return st === "Active Intervention" || st === "Progressing" || st === "In Progress" || st === "Assigned";
    }).length;

    const midlinePendingCount = languageLearners.filter((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "";
      return st === "For Midline Assessment" || (st === "Active Intervention" && !s.midlineScore);
    }).length;

    const eosyPendingCount = languageLearners.filter((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "";
      return st === "For EOSY Assessment" || (st === "Active Intervention" && !s.eosyScore);
    }).length;

    const summerReferralCount = languageLearners.filter((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "";
      return st === "ARAL Summer Referral" || s.summerStatus != null || s.eosyDecision === "ARAL Summer Referral";
    }).length;

    const completedCount = languageLearners.filter((s) => {
      const st = s.interventionStatus || s.monitoringStatus || "";
      return st === "Completed" || st === "Program Completed";
    }).length;

    return {
      withBosyScore,
      total,
      needsReviewCount,
      activeCount,
      midlinePendingCount,
      eosyPendingCount,
      summerReferralCount,
      completedCount,
    };
  }, [languageLearners]);

  // 3. Tab Categorization
  const categorizedRows = useMemo(() => {
    return languageLearners.filter((row) => {
      const status = row.interventionStatus || row.monitoringStatus || "Needs Review";
      const hasScore = row.philIriScore != null;
      const score = hasScore ? Number(row.philIriScore) : null;

      switch (activeWorkflowTab) {
        case "needs_review":
          return (
            status === "Needs Review" ||
            status === "For Review" ||
            status === "ARAL Candidate" ||
            (!status.includes("Active") && !status.includes("Completed") && !status.includes("Summer") && (hasScore && score <= 27))
          );

        case "active":
          return (
            status === "Active Intervention" ||
            status === "Progressing" ||
            status === "In Progress" ||
            status === "Assigned" ||
            status === "Qualified"
          );

        case "midline":
          return (
            status === "For Midline Assessment" ||
            row.midlineScore != null ||
            status === "Active Intervention"
          );

        case "eosy":
          return (
            status === "For EOSY Assessment" ||
            row.eosyScore != null ||
            status === "Active Intervention"
          );

        case "summer_referral":
          return (
            status === "ARAL Summer Referral" ||
            row.summerStatus != null ||
            row.eosyDecision === "ARAL Summer Referral"
          );

        case "completed":
          return status === "Completed" || status === "Program Completed";

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
    needs_review: "No learners currently require ARAL intake review.",
    active: "No active ARAL intervention records found for the selected filter.",
    midline: "No learners are currently due for Midline assessment.",
    eosy: "No learners are currently due for EOSY assessment.",
    summer_referral: "No learners referred for ARAL Summer Eligibility.",
    completed: "No completed ARAL intervention records for the selected period.",
  };

  return (
    <div className="space-y-3.5">
      {/* 1. CONTEXTUAL TOOLBAR (Replaces Repetitive Card Title) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/70">
            <BookOpen size={13} className="text-cnhs-green" />
            Reading Intervention · English & Filipino · Phil-IRI
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
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-cnhs-green-dark shadow-xs hover:bg-emerald-100 transition-colors"
          >
            <Pencil size={12} />
            <span>Enter Assessment Result</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#246f54] transition-colors"
          >
            <FileSpreadsheet size={13} />
            <span>Import Form 1B</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT OVERVIEW SUMMARY BAR */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs shadow-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Screening:</span>
          <span className="font-bold text-slate-900">
            {metrics.withBosyScore} / {metrics.total}
          </span>
          <span className="text-[11px] text-slate-400">screened</span>
        </div>

        <span className="text-slate-200 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Needs Review:</span>
          <span className="font-bold text-amber-800">{metrics.needsReviewCount}</span>
        </div>

        <span className="text-slate-200 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active:</span>
          <span className="font-bold text-slate-900">{metrics.activeCount}</span>
        </div>

        <span className="text-slate-200 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Assessment Due:</span>
          <span className="font-semibold text-slate-700">
            Midline ({metrics.midlinePendingCount}) · EOSY ({metrics.eosyPendingCount})
          </span>
        </div>

        <span className="text-slate-200 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Summer Referral:</span>
          <span className="font-bold text-amber-800">{metrics.summerReferralCount}</span>
        </div>

        <span className="text-slate-200 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Completed:</span>
          <span className="font-bold text-cnhs-green-dark">{metrics.completedCount}</span>
        </div>
      </div>

      {/* 3. WORKFLOW STATUS SEGMENTED TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-transparent pb-1">
        {[
          { id: "needs_review", label: "Needs Review", count: metrics.needsReviewCount },
          { id: "active", label: "Active Intervention", count: metrics.activeCount },
          { id: "midline", label: "Midline", count: metrics.midlinePendingCount },
          { id: "eosy", label: "EOSY", count: metrics.eosyPendingCount },
          { id: "summer_referral", label: "Summer Referral", count: metrics.summerReferralCount },
          { id: "completed", label: "Completed", count: metrics.completedCount },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveWorkflowTab(tab.id);
              setPage(1);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors shrink-0 cursor-pointer",
              activeWorkflowTab === tab.id
                ? "bg-cnhs-green-dark text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60 bg-white"
            )}
          >
            <span>{tab.label}</span>
            <span className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
              activeWorkflowTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            )}>
              {tab.id === activeWorkflowTab ? filteredRows.length : tab.count}
            </span>
          </button>
        ))}
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
                <th className="px-4 py-3">LRN</th>
                <th className="px-4 py-3">Grade & Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Academic Trigger</th>
                <th className="px-4 py-3">Phil-IRI Status</th>
                <th className="px-4 py-3">Reading Level</th>
                <th className="px-4 py-3">ARAL Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => {
                  const gradeVal = row.classSubjectGrade ?? row.academicGrade;
                  const academicTrigger = gradeVal != null
                    ? `${row.subject || 'Subject'} · Grade ${gradeVal}`
                    : "Academic Need Flagged";

                  return (
                    <tr
                      key={row.id || row.studentId || row.lrn}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <LearnerName
                          firstName={row.firstName}
                          lastName={row.lastName}
                          name={row.name}
                        />
                      </td>

                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {row.lrn || row.studentNumber || "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {row.grade ? `Grade ${row.grade}` : "Grade"} · {row.section || "Section"}
                      </td>

                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {row.displaySubject || row.subject || "English / Filipino"}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {academicTrigger}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {row.philIriScore != null ? (
                          <span className="font-bold text-slate-900">
                            Form 1B ({row.philIriScore}/20)
                          </span>
                        ) : (
                          <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium">
                            Not Screened
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold",
                          row.readingLevel === "Frustration"
                            ? "bg-rose-50 text-rose-700"
                            : row.readingLevel === "Instructional"
                            ? "bg-amber-50 text-amber-800"
                            : row.readingLevel === "Independent"
                            ? "bg-emerald-50 text-cnhs-green-dark"
                            : "bg-slate-100 text-slate-500"
                        )}>
                          {row.readingLevel || "Not Screened"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-cnhs-green-dark">
                          {row.interventionStatus || row.aralStatus || "Needs Review"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
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
      {/* 1. ARAL Learner Profile Modal */}
      <AralLearnerProfileModal
        isOpen={Boolean(selectedLearnerForProfile)}
        onClose={() => setSelectedLearnerForProfile(null)}
        learner={selectedLearnerForProfile}
        schoolYear={schoolYear}
        onUpdated={onRefresh}
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

      {/* 4. Individual Enter Score Modal */}
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
        onSuccess={onRefresh}
      />
    </div>
  );
}
