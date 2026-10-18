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
  getAralTermDisplay,
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

  // Pagination
  const [page, setPage] = useState(1);

  // 1. Authoritative aggregation & deduplication (1 row per learner + language + school year)
  const languageLearners = useMemo(() => {
    return aggregateAralLearners(students, {
      currentTeacherId: teacherId,
      schoolYear,
    });
  }, [students, teacherId, schoolYear]);

  // 2. Metrics calculation for pure reading assessment cards
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

  // Step filter options matching simplified Phil-IRI statuses
  const stepFilterOptions = useMemo(() => [
    "All Steps",
    "Needs Screening Test",
    "Needs Reading Assessment",
    "Screening Complete — At Grade Level",
    "Reading Assessment Complete",
    "GST Under Review",
    "Absent / For Reschedule",
    "For Further Review",
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
            ARAL Reading Assessment
          </span>
          <span
            title="Active reading assessment period"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#246f54] border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
          >
            {getAralTermDisplay(effectivePeriod)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilesModalOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
          >
            <FileText size={13} className="text-slate-500" />
            <span>Reading Assessment Files</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY CARDS: Pure Reading Assessment Tally */}
      <div className={cn(
        "grid grid-cols-1 gap-3",
        metrics.forReviewCount > 0 || effectivePeriod === "EOSY"
          ? "sm:grid-cols-4"
          : "sm:grid-cols-3"
      )}>
        {/* Card 1: Needs Screening Test */}
        <button
          type="button"
          onClick={() => {
            setCurrentStep((prev) =>
              prev === "Needs Screening Test" ? "All Steps" : "Needs Screening Test"
            );
            setPage(1);
          }}
          className={cn(
            "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
            currentStep === "Needs Screening Test"
              ? "border-[#166534] ring-1 ring-[#166534]/25 bg-slate-50/80"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Needs Screening Test
            </span>
            <Clock size={16} className="text-slate-400" />
          </div>
          <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {metrics.waitingForAssessmentCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Awaiting initial GST screening test
          </span>
        </button>

        {/* Card 2: Needs Reading Assessment */}
        <button
          type="button"
          onClick={() => {
            setCurrentStep((prev) =>
              prev === "Needs Reading Assessment" ? "All Steps" : "Needs Reading Assessment"
            );
            setPage(1);
          }}
          className={cn(
            "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
            currentStep === "Needs Reading Assessment"
              ? "border-[#166534] ring-1 ring-[#166534]/25 bg-slate-50/80"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Needs Reading Assessment
            </span>
            <AlertCircle size={16} className="text-slate-400" />
          </div>
          <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {metrics.needsIndividualAssessmentCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Score below 28 — reading passage needed
          </span>
        </button>

        {/* Card 3: Completed Reading Assessments */}
        <button
          type="button"
          onClick={() => {
            setCurrentStep((prev) =>
              prev === "Reading Assessment Complete" ? "All Steps" : "Reading Assessment Complete"
            );
            setPage(1);
          }}
          className={cn(
            "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
            currentStep === "Reading Assessment Complete"
              ? "border-[#166534] ring-1 ring-[#166534]/25 bg-slate-50/80"
              : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Assessment Completed
            </span>
            <CheckCircle2 size={16} className="text-slate-400" />
          </div>
          <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {metrics.totalCompleteCount}
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400 truncate">
            {metrics.screeningCompleteCount} At Grade Level · {metrics.assessmentCompleteCount} IRA Complete
          </span>
        </button>

        {/* Card 4: EOSY / For Further Review (Conditional) */}
        {(metrics.forReviewCount > 0 || effectivePeriod === "EOSY") && (
          <button
            type="button"
            onClick={() => {
              setCurrentStep((prev) =>
                prev === "For Further Review" ? "All Steps" : "For Further Review"
              );
              setPage(1);
            }}
            className={cn(
              "rounded-2xl border p-4 text-left shadow-xs transition cursor-pointer",
              currentStep === "For Further Review"
                ? "border-[#166534] ring-1 ring-[#166534]/25 bg-slate-50/80"
                : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                For Further Review
              </span>
              <AlertCircle size={16} className="text-slate-400" />
            </div>
            <span className="mt-2 block text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {metrics.forReviewCount}
            </span>
            <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">
              Possible ARAL Summer Consideration
            </span>
          </button>
        )}
      </div>

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
            label="Status Filter"
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

      {/* 4. WORK QUEUE TABLE (Primary 9 Clean Columns) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/75 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:border-white/5 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Grade & Section</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Assessment Period</th>
                <th className="px-4 py-3">GST Result</th>
                <th className="px-4 py-3">Reading Assessment</th>
                <th className="px-4 py-3">Current Result</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => {
                  const stepMeta = row.currentStepMeta || ARAL_STEP_DEFINITIONS[row.currentStepKey] || {};
                  const isAssigned = row.isAssignedToMe || !teacherId;

                  const isAbsent = Boolean(
                    row.isAbsent ||
                    row.candidateStatus === "Absent / For Reschedule" ||
                    row.screeningStatus === "Absent / For Reschedule" ||
                    row.rawPayload?.isAbsent
                  );

                  const isUnderReview = Boolean(
                    row.candidateStatus === "For Review" &&
                    (row.teacherReviewReason || row.rawPayload?.teacherReviewReason)
                  );

                  const isGstAtGradeLevel =
                    !isAbsent && row.philIriScore != null && Number(row.philIriScore) >= 28;

                  const hasIra = Boolean(
                    !isAbsent &&
                    row.readingLevel &&
                    row.readingLevel !== "Not Screened" &&
                    row.readingLevel !== "Not Assessed" &&
                    row.readingLevel !== "Not Set" &&
                    row.readingLevel !== "Pending Oral Profile" &&
                    row.readingLevel !== "Pending Individual Assessment"
                  );

                  // GST result display
                  const gstDisplay = isAbsent
                    ? "Absent"
                    : isUnderReview
                    ? `${row.philIriScore} / 40`
                    : row.philIriScore != null
                    ? `${row.philIriScore} / 40`
                    : "Not Recorded";

                  const gstSub = isAbsent
                    ? "For Reschedule"
                    : isUnderReview
                    ? "Under Review"
                    : row.philIriScore != null
                    ? isGstAtGradeLevel
                      ? "At Grade Level"
                      : "Score < 28"
                    : "Pending Screening";

                  // Reading assessment display
                  const iraDisplay = isAbsent
                    ? "Pending Screening"
                    : isGstAtGradeLevel
                    ? "Not Required"
                    : hasIra
                    ? "Form 3 Completed"
                    : row.philIriScore != null
                    ? "Needs IRA"
                    : "Pending Screening";

                  const iraSub = isGstAtGradeLevel
                    ? "Screening Complete"
                    : hasIra
                    ? (row.iraMetrics?.passageLevel || row.screeningInterpretation || "Oral Assessment")
                    : row.philIriScore != null
                    ? "Reading Passage Needed"
                    : "Awaiting GST";

                  // Current Result display
                  const currentResultText = isAbsent
                    ? "Absent"
                    : isUnderReview
                    ? "Under Review"
                    : isGstAtGradeLevel
                    ? "At Grade Level"
                    : hasIra
                    ? row.readingLevel
                    : "Pending";

                  const currentResultColor = isGstAtGradeLevel || row.readingLevel === "Independent"
                    ? "text-emerald-700 dark:text-emerald-400 font-bold"
                    : row.readingLevel === "Instructional"
                    ? "text-amber-700 dark:text-amber-400 font-bold"
                    : row.readingLevel === "Frustration"
                    ? "text-rose-700 dark:text-rose-400 font-bold"
                    : isAbsent
                    ? "text-slate-500 font-medium"
                    : "text-slate-500 font-medium";

                  // Period display
                  const periodDisplay = getAralTermDisplay(row.assessmentPeriod || effectivePeriod);

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

                      {/* 4. Assessment Period */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">
                        <span className="text-[11px] block">{periodDisplay}</span>
                      </td>

                      {/* 5. GST Result */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {gstDisplay}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {gstSub}
                          </span>
                        </div>
                      </td>

                      {/* 6. Reading Assessment */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                            {iraDisplay}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {iraSub}
                          </span>
                        </div>
                      </td>

                      {/* 7. Current Result */}
                      <td className="px-4 py-3">
                        <span className={cn("text-xs", currentResultColor)}>
                          {currentResultText}
                        </span>
                      </td>

                      {/* 8. Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border w-fit",
                              stepMeta.badgeClass || "border-slate-200 bg-slate-50 text-slate-700"
                            )}
                          >
                            {row.currentStepLabel || stepMeta.label || "Under Review"}
                          </span>
                          {row.currentStepKey === "for_review" && (
                            <span className="text-[9.5px] text-slate-400 italic">
                              Possible ARAL Summer Consideration
                            </span>
                          )}
                          {row.isMissingLanguageTeacher && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              <AlertCircle size={10} className="shrink-0" />
                              Reading assessment teacher not found
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 9. Action */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {/* Subject Teacher Assessment Actions */}
                          {row.currentStepKey === "waiting_for_assessment" && row.canEditAssessment && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssessment(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#246f54] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] transition cursor-pointer"
                            >
                              <Pencil size={12} />
                              <span>Start Assessment</span>
                            </button>
                          )}

                          {row.currentStepKey === "absent_reschedule" && row.canEditAssessment && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssessment(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Pencil size={12} />
                              <span>Reschedule Assessment</span>
                            </button>
                          )}

                          {row.currentStepKey === "needs_individual_assessment" && row.canEditAssessment && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssessment(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                            >
                              <ArrowRight size={12} />
                              <span>Continue Assessment</span>
                            </button>
                          )}

                          {row.currentStepKey === "gst_under_review" && row.canEditAssessment && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssessment(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition cursor-pointer"
                            >
                              <Pencil size={12} />
                              <span>Review Result</span>
                            </button>
                          )}

                          {/* Term 2 or Term 3 Reassessment for existing completed cases */}
                          {(effectivePeriod === "MOSY" || effectivePeriod === "EOSY") &&
                            (row.currentStepKey === "screening_complete_at_grade" || row.currentStepKey === "assessment_complete") &&
                            row.canEditAssessment && (
                              <button
                                type="button"
                                onClick={() => handleOpenAssessment(row)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-200 transition cursor-pointer"
                              >
                                <Pencil size={12} />
                                <span>Update Assessment</span>
                              </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenRecord(row)}
                            title={
                              !isAssigned
                                ? "Assigned to another teacher. You have view-only access."
                                : "View full reading record"
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                          >
                            <Eye size={12} className="text-slate-400" />
                            <span>View Reading Record</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                      No reading assessment cases match your criteria.
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      All learners enrolled in English or Filipino classes are monitored here.
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
      />
    </div>
  );
}
