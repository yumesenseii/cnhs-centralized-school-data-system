"use client";

import { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Search,
  BookOpen,
  FileText,
  Pencil,
  ArrowRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import AralAssessmentFlowModal from "@/components/teacher/monitoring/AralAssessmentFlowModal";
import AralLearnerRecordModal from "@/components/teacher/monitoring/AralLearnerRecordModal";
import AralAssessmentFilesModal from "@/components/teacher/monitoring/AralAssessmentFilesModal";
import AralUploadAssessmentModal from "@/components/teacher/monitoring/AralUploadAssessmentModal";
import {
  aggregateAralLearners,
  computeAralMetrics,
  filterAralLearners,
  ARAL_STEP_DEFINITIONS,
} from "@/lib/monitoring/aralLearnerAggregation";
import {
  aralPeriodLabel,
  getAralPeriodPermissions,
  normalizeAralPeriod,
} from "@/lib/monitoring/assessmentTimeline";
import { formatGradeSection } from "@/lib/monitoring/philIriEvaluation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function AralMonitoringSection({
  students = [],
  filterOptions = { grades: [], sections: [], subjects: [] },
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  aralPeriod = null,
  onRefresh,
  onViewLearner,
}) {
  const effectivePeriod = normalizeAralPeriod(aralPeriod) || "BOSY";
  const periodPermissions = getAralPeriodPermissions(effectivePeriod);
  const bosyEditable = periodPermissions.BOSY.editable === true;

  // Minimal, teacher-friendly filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [currentStep, setCurrentStep] = useState("All Steps");
  const [grade, setGrade] = useState("All Grades");
  const [language, setLanguage] = useState("All Languages");

  // Modals state
  const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
  const [selectedLearnerForAssessment, setSelectedLearnerForAssessment] = useState(null);

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedLearnerForRecord, setSelectedLearnerForRecord] = useState(null);

  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // 1. Authoritative aggregation & deduplication (1 row per learner + language + school year)
  // Strict eligibility: only valid ARAL cases (referral, BOSY assignment, facilitator, or active ARAL case)
  const languageLearners = useMemo(() => {
    return aggregateAralLearners(students, {
      currentTeacherId: teacherId,
      schoolYear,
    });
  }, [students, teacherId, schoolYear]);

  // 2. Metrics calculation for the 3 primary cards (+ optional progress check)
  const metrics = useMemo(() => {
    return computeAralMetrics(languageLearners);
  }, [languageLearners]);

  // 3. Filtered list for the work queue
  const filteredRows = useMemo(() => {
    return filterAralLearners(languageLearners, {
      searchTerm,
      currentStep,
      grade,
      language,
    });
  }, [languageLearners, searchTerm, currentStep, grade, language]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Available grade options
  const gradeOptions = useMemo(() => {
    if (filterOptions.grades?.length) {
      return ["All Grades", ...filterOptions.grades.map((g) => (String(g).startsWith("Grade") ? g : `Grade ${g}`))];
    }
    return ["All Grades", "Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  }, [filterOptions.grades]);

  // Step filter options
  const stepFilterOptions = useMemo(() => [
    "All Steps",
    "Waiting for Assessment",
    "Needs Individual Assessment",
    "Assessment Complete — No ARAL Support Needed",
    "Reading Profile Available",
    "Under ARAL Support",
    "Progress Check Due",
    "Completed",
  ], []);

  // Handlers for modal interactions
  function handleOpenRecord(learner) {
    if (onViewLearner) {
      onViewLearner(learner);
    } else {
      setSelectedLearnerForRecord(learner);
      setIsRecordModalOpen(true);
    }
  }

  function handleOpenAssessment(learner) {
    setSelectedLearnerForAssessment(learner);
    setIsAssessmentModalOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* 1. TOP TOOLBAR: Context & Assessment Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200/70 dark:bg-white/5 dark:text-slate-300 dark:border-white/10">
            <BookOpen size={13} className="text-[#246f54]" />
            Reading Assessment & ARAL Queue
          </span>
          <span
            title="Authoritative ARAL assessment period (system configuration)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#246f54] border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
          >
            {aralPeriodLabel(effectivePeriod)}
          </span>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilesModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            <FileText size={13} className="text-slate-500" />
            <span>Reading Assessment Files</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            disabled={!bosyEditable}
            title={
              bosyEditable
                ? "Upload Phil-IRI Excel score sheet"
                : "Excel upload is only enabled during Beginning Assessment (BOSY)"
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#246f54] px-3 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={13} />
            <span>Upload Assessment Excel</span>
          </button>
        </div>
      </div>

      {/* 2. THREE SUMMARY CARDS (+ Optional Progress Check Card) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Card 1: Waiting for Assessment */}
        <button
          type="button"
          onClick={() => {
            setCurrentStep((prev) =>
              prev === "Waiting for Assessment" ? "All Steps" : "Waiting for Assessment"
            );
            setPage(1);
          }}
          className={cn(
            "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
            currentStep === "Waiting for Assessment"
              ? "border-amber-400 bg-amber-50/70 ring-2 ring-amber-300/40 dark:bg-amber-950/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Waiting for Assessment
            </span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {metrics.waitingForAssessmentCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Awaiting Group Screening Test (GST)
          </span>
        </button>

        {/* Card 2: Needs Individual Assessment */}
        <button
          type="button"
          onClick={() => {
            setCurrentStep((prev) =>
              prev === "Needs Individual Assessment" ? "All Steps" : "Needs Individual Assessment"
            );
            setPage(1);
          }}
          className={cn(
            "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
            currentStep === "Needs Individual Assessment"
              ? "border-blue-400 bg-blue-50/70 ring-2 ring-blue-300/40 dark:bg-blue-950/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Needs Individual Assessment
            </span>
            <AlertCircle size={16} className="text-blue-600" />
          </div>
          <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {metrics.needsIndividualAssessmentCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Score below 28 — passage test required
          </span>
        </button>

        {/* Card 3: Under ARAL Support */}
        <button
          type="button"
          onClick={() => {
            setCurrentStep((prev) =>
              prev === "Under ARAL Support" ? "All Steps" : "Under ARAL Support"
            );
            setPage(1);
          }}
          className={cn(
            "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
            currentStep === "Under ARAL Support"
              ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-300/40 dark:bg-emerald-950/20"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Under ARAL Support
            </span>
            <CheckCircle2 size={16} className="text-[#246f54]" />
          </div>
          <span className="mt-2 block text-3xl font-bold tracking-tight text-[#246f54] dark:text-emerald-400">
            {metrics.underAralSupportCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Active reading intervention in progress
          </span>
        </button>
      </div>

      {/* Optional Alert for Progress Checks Due */}
      {metrics.progressCheckDueCount > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span className="font-semibold">
              {metrics.progressCheckDueCount} learner{metrics.progressCheckDueCount > 1 ? "s have" : " has"} a regular progress check due.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentStep("Progress Check Due");
              setPage(1);
            }}
            className="font-bold underline hover:no-underline text-rose-800 dark:text-rose-300"
          >
            Show due learners &rarr;
          </button>
        </div>
      )}

      {/* 3. MINIMAL FILTER BAR: Search, Current Step, Grade, Language */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
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
            className="h-8 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-[#246f54] focus:ring-1 focus:ring-[#246f54] transition dark:border-white/10 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AppSelect
            label="Current Step"
            value={currentStep}
            onChange={(val) => {
              setCurrentStep(val);
              setPage(1);
            }}
            options={stepFilterOptions}
            size="pill"
            triggerClassName="h-8 text-xs font-medium"
          />

          <AppSelect
            label="Grade"
            value={grade}
            onChange={(val) => {
              setGrade(val);
              setPage(1);
            }}
            options={gradeOptions}
            size="pill"
            triggerClassName="h-8 text-xs font-medium"
          />

          <AppSelect
            label="Language"
            value={language}
            onChange={(val) => {
              setLanguage(val);
              setPage(1);
            }}
            options={["All Languages", "English", "Filipino"]}
            size="pill"
            triggerClassName="h-8 text-xs font-medium"
          />
        </div>
      </div>

      {/* 4. WORK QUEUE TABLE (6 Clean Columns) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/75 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:border-white/5 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Grade & Section</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Current Step</th>
                <th className="px-4 py-3">Reading Result</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => {
                  const stepMeta = row.currentStepMeta || ARAL_STEP_DEFINITIONS[row.currentStepKey] || {};
                  const isAssigned = row.isAssignedToMe || !teacherId;

                  return (
                    <tr
                      key={`${row.studentId || row.id}_${row.language}`}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* 1. Learner */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          <LearnerName
                            firstName={row.firstName}
                            lastName={row.lastName}
                            name={row.name}
                          />
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                          {row.lrn || row.studentNumber || "—"}
                        </div>
                      </td>

                      {/* 2. Grade & Section */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                        {row.gradeSectionDisplay || formatGradeSection(row.grade, row.section)}
                      </td>

                      {/* 3. Language */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-300">
                          {row.language || row.subject || "English"}
                        </span>
                      </td>

                      {/* 4. Current Step */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border",
                            stepMeta.badgeClass || "border-slate-200 bg-slate-50 text-slate-700"
                          )}
                        >
                          {row.currentStepLabel || stepMeta.label || "Under Review"}
                        </span>
                      </td>

                      {/* 5. Reading Result */}
                      <td className="px-4 py-3">
                        {row.readingLevel && row.readingLevel !== "Not Screened" && row.readingLevel !== "Not Set" ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={cn(
                                "font-bold text-xs",
                                row.readingLevel === "Independent"
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : row.readingLevel === "Instructional"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-rose-700 dark:text-rose-400"
                              )}
                            >
                              {row.readingLevel}
                            </span>
                            {row.screeningInterpretation && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {row.screeningInterpretation}
                              </span>
                            )}
                          </div>
                        ) : row.philIriScore != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              GST: {row.philIriScore}/40
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {Number(row.philIriScore) >= 28
                                ? "Independent (Proficient)"
                                : "Score < 28 (Needs IRA)"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs italic">
                            Not recorded
                          </span>
                        )}
                      </td>

                      {/* 6. Action */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isAssigned && row.currentStepKey === "waiting_for_assessment" && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssessment(row)}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#246f54] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] transition"
                            >
                              <Pencil size={11} />
                              <span>Assess</span>
                            </button>
                          )}

                          {isAssigned && row.currentStepKey === "needs_individual_assessment" && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssessment(row)}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
                            >
                              <ArrowRight size={11} />
                              <span>Continue</span>
                            </button>
                          )}

                          {isAssigned && row.currentStepKey === "reading_profile_available" && (
                            <button
                              type="button"
                              onClick={() => handleOpenRecord(row)}
                              className="inline-flex items-center gap-1 rounded-xl bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-purple-700 transition"
                            >
                              <BookOpen size={11} />
                              <span>Review</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenRecord(row)}
                            title={
                              !isAssigned
                                ? "Assigned to another facilitator. You have view-only access."
                                : "View full learner reading record"
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <Eye size={12} className="text-slate-400" />
                            <span>View</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                      No reading assessment cases match your criteria.
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Learners appear here once they have an approved reading referral, school-assigned BOSY assessment, or active ARAL case.
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

      {/* 5. MODALS */}
      {/* A. Two-Stage Assessment Flow Modal */}
      <AralAssessmentFlowModal
        isOpen={isAssessmentModalOpen}
        onClose={() => {
          setIsAssessmentModalOpen(false);
          setSelectedLearnerForAssessment(null);
        }}
        learner={selectedLearnerForAssessment}
        teacherId={teacherId}
        schoolYear={schoolYear}
        quarter={quarter}
        aralPeriod={effectivePeriod}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      {/* B. Focused 5-Part Learner Record Modal */}
      <AralLearnerRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setSelectedLearnerForRecord(null);
        }}
        learner={selectedLearnerForRecord}
        teacherId={teacherId}
        schoolYear={schoolYear}
        onOpenAssessment={(l) => {
          setIsRecordModalOpen(false);
          setSelectedLearnerForRecord(null);
          handleOpenAssessment(l);
        }}
        onRefresh={onRefresh}
      />

      {/* C. Reading Assessment Files Modal */}
      <AralAssessmentFilesModal
        isOpen={isFilesModalOpen}
        onClose={() => setIsFilesModalOpen(false)}
        schoolYear={schoolYear}
        onOpenUpload={() => {
          setIsFilesModalOpen(false);
          setIsUploadModalOpen(true);
        }}
      />

      {/* D. Upload Assessment Excel Modal */}
      <AralUploadAssessmentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
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
