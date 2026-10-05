"use client";

import React, { useState, useEffect } from "react";
import {
  Download,
  FileText,
  School,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { useAdvisoryClass } from "@/hooks/teacher/useAdvisoryClass";
import SubjectPublishTracker from "@/components/teacher/advisory/SubjectPublishTracker";
import AdvisoryGradesMatrix from "@/components/teacher/advisory/AdvisoryGradesMatrix";
import Sf9ReportCardModal from "@/components/reports/Sf9ReportCardModal";
import AdvisoryRosterModal from "@/components/teacher/advisory/AdvisoryRosterModal";
import AdvisorySectionCard from "@/components/teacher/advisory/AdvisorySectionCard";
import { SummaryKpiCards } from "@/components/teacher/my-classes/shared";
import {
  formatStudentForSf9,
  formatDepEdLearnerName,
} from "@/lib/reports/sf9DataService";
import { downloadSectionBatchSf9Pdf } from "@/lib/reports/sf9PdfGenerator";
import { getSectionSf9Releases } from "@/lib/supabase/queries/sf9Releases";

export default function AdvisorySectionHub({ advisory }) {
  const fallbackAdvisory = useAdvisoryClass();
  const advisoryState = advisory || fallbackAdvisory;

  const {
    hasAdvisory,
    section,
    subjectPublishStatus,
    publishedSubjectsCount,
    totalSubjectsCount,
    learners,
    attendanceMonths,
    loading,
    error,
  } = advisoryState;

  const [viewMode, setViewMode] = useState("card"); // 'card' | 'workspace'
  const [activeSubTab, setActiveSubTab] = useState("matrix"); // 'matrix', 'sf9', 'attendance'
  const [selectedStudentForSf9, setSelectedStudentForSf9] = useState(null);
  const [sf9ModalOpen, setSf9ModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [releasesMap, setReleasesMap] = useState({});

  useEffect(() => {
    let active = true;
    async function loadReleases() {
      if (!section?.id) return;
      const { data } = await getSectionSf9Releases(section.id, section.schoolYear);
      if (active && data) {
        setReleasesMap(data);
      }
    }
    loadReleases();
    return () => {
      active = false;
    };
  }, [section?.id, section?.schoolYear]);

  const pendingCount = (totalSubjectsCount || 8) - publishedSubjectsCount;
  const readyCount = learners.filter((l) => l.isComplete).length;
  const pendingLearnersCount = learners.length - readyCount;

  const handleOpenSf9 = (student) => {
    setSelectedStudentForSf9(student);
    setSf9ModalOpen(true);
  };

  const handleBatchDownloadAll = () => {
    if (!learners.length) return;
    const formatted = learners.map(formatStudentForSf9);
    downloadSectionBatchSf9Pdf(
      section?.sectionName || "Section",
      formatted,
      section?.schoolYear
    );
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
        <Loader2 className="w-7 h-7 animate-spin text-cnhs-green" />
        <p className="text-xs font-medium">Loading advisory section records...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-start gap-2.5 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-xs">Failed to load Advisory Class</h4>
            <p className="text-[11px] mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Not an adviser state
  if (!hasAdvisory) {
    const emptyKpis = [
      {
        id: "advisory-section",
        label: "Advisory Section",
        value: 0,
        icon: "book",
        tone: "green",
      },
      {
        id: "advisory-students",
        label: "Students Enrolled",
        value: 0,
        icon: "users",
        tone: "blue",
      },
      {
        id: "advisory-subjects",
        label: "Curricular Subjects",
        value: 0,
        icon: "file",
        tone: "orange",
      },
      {
        id: "advisory-publishing",
        label: "Published Subjects",
        value: "0/0",
        icon: "clipboard",
        tone: "red",
      },
    ];

    return (
      <div className="space-y-4">
        <SummaryKpiCards kpis={emptyKpis} />
        <div className="py-8">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3 dark:bg-slate-800">
              <School className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              No Class Advisory
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed dark:text-slate-400">
              You do not have an advisory class assigned for this school year. If you are an assigned class adviser, please contact the school administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const advisoryKpis = [
    {
      id: "advisory-section",
      label: "Advisory Section",
      value: 1,
      icon: "book",
      tone: "green",
    },
    {
      id: "advisory-students",
      label: "Students Enrolled",
      value: learners.length,
      icon: "users",
      tone: "blue",
    },
    {
      id: "advisory-subjects",
      label: "Curricular Subjects",
      value: totalSubjectsCount || 8,
      icon: "file",
      tone: "orange",
    },
    {
      id: "advisory-publishing",
      label: "Published Subjects",
      value: `${publishedSubjectsCount}/${totalSubjectsCount || 8}`,
      icon: pendingCount > 0 ? "alert" : "check",
      tone: pendingCount > 0 ? "red" : "green",
      alert: pendingCount > 0,
    },
  ];

  return (
    <div className="space-y-4">
      {viewMode === "card" ? (
        <>
          {/* Advisory Summary KPIs */}
          <SummaryKpiCards kpis={advisoryKpis} />

          {/* Section Indicator Bar matching Teaching Classes search/filter placement */}
          <section className="mt-4 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cnhs-green" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Official Advisory Section &bull; SY {section?.schoolYear || "2026-2027"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Grade {section?.gradeLevel} &mdash; {section?.sectionName}
                </span>
              </div>
            </div>
          </section>

          {/* 2-Column Responsive Card Grid matching Teaching Classes layout */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <AdvisorySectionCard
              section={section}
              learnersCount={learners.length}
              maleCount={section?.maleCount || 0}
              femaleCount={section?.femaleCount || 0}
              publishedCount={publishedSubjectsCount}
              totalCount={totalSubjectsCount || 8}
              onOpenWorkspace={() => {
                setActiveSubTab("matrix");
                setViewMode("workspace");
              }}
              onOpenSf9={() => {
                setActiveSubTab("sf9");
                setViewMode("workspace");
              }}
              onOpenAttendance={() => {
                setActiveSubTab("attendance");
                setViewMode("workspace");
              }}
              onManageSection={() => setManageModalOpen(true)}
            />
          </div>
        </>
      ) : (
        <>
          {/* Workspace Back Button Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ArrowLeft size={14} />
              <span>Back to Advisory Overview</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Grade {section?.gradeLevel} &mdash; {section?.sectionName}
              </span>
              <span>&bull;</span>
              <span>SY {section?.schoolYear || "2026-2027"}</span>
            </div>
          </div>

          {/* 4. Top Section: Dedicated Advisory Workspace Header */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-cnhs-green dark:text-emerald-400">
                    Class Adviser
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                  <span className="text-slate-500 font-medium dark:text-slate-400">
                    SY {section?.schoolYear || "2026-2027"}
                  </span>
                </div>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
                  Grade {section?.gradeLevel}, {section?.sectionName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Adviser: <strong>{section?.adviserName || "Class Adviser"}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded-md bg-cnhs-green px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#115a3e] active:bg-[#0c432e] transition-colors"
                >
                  <School size={13} />
                  <span>Manage Section</span>
                </button>
              </div>
            </div>

            {/* Compact Summary Information Blocks */}
            <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="rounded-md bg-slate-50/80 px-3 py-2 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Enrolled Learners
                </span>
                <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {learners.length} Learners
                </p>
              </div>

              <div className="rounded-md bg-slate-50/80 px-3 py-2 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Curricular Subjects
                </span>
                <p className="mt-0.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {totalSubjectsCount || 8} Subjects
                </p>
              </div>

          <div className="rounded-md bg-slate-50/80 px-3 py-2 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Submission Status
            </span>
            <p className="mt-0.5 text-xs font-bold text-cnhs-green dark:text-emerald-400">
              {publishedSubjectsCount}/{totalSubjectsCount || 8} Published
            </p>
          </div>

          <div className="rounded-md bg-slate-50/80 px-3 py-2 border border-slate-100 dark:bg-slate-800/40 dark:border-slate-800">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Pending Submissions
            </span>
            <p
              className={`mt-0.5 text-xs font-bold ${
                pendingCount > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-slate-700 dark:text-slate-300"
              }`}
            >
              {pendingCount > 0
                ? `${pendingCount} Subject${pendingCount === 1 ? "" : "s"} Pending`
                : "None (All Ready)"}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Compact Readiness Status Banner */}
      {pendingCount > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-md border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>
                {publishedSubjectsCount} of {totalSubjectsCount || 8} subjects published.
              </strong>{" "}
              {pendingCount === 1
                ? "One subject is still pending before SF9 batch generation."
                : `${pendingCount} subjects are still pending before SF9 batch generation.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("subject-publishing-status");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 active:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100 transition-colors shadow-2xs"
          >
            <span>Review Pending Subject</span>
            <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-md border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0 text-cnhs-green dark:text-emerald-400" />
            <span>
              <strong>All {totalSubjectsCount || 8} subjects published.</strong> Ready for School Form 9 (SF9) batch generation.
            </span>
          </div>
          <button
            type="button"
            onClick={handleBatchDownloadAll}
            className="inline-flex shrink-0 items-center gap-1.5 rounded bg-cnhs-green px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#115a3e] transition-colors shadow-2xs"
          >
            <Download size={12} />
            <span>Batch Download SF9</span>
          </button>
        </div>
      )}

      {/* 6. Subject Publishing Status Horizontal Tracker */}
      <SubjectPublishTracker
        subjectPublishStatus={subjectPublishStatus}
        publishedCount={publishedSubjectsCount}
        totalCount={totalSubjectsCount}
      />

      {/* 7. Advisory Sub-Navigation Tabs */}
      <nav
        aria-label="Advisory Workspace Tabs"
        className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          onClick={() => setActiveSubTab("matrix")}
          className={`pb-2.5 text-xs sm:text-sm transition-colors border-b-2 -mb-[1px] ${
            activeSubTab === "matrix"
              ? "border-cnhs-green text-cnhs-green font-semibold dark:text-emerald-400"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <span>Consolidated Grades</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sf9")}
          className={`pb-2.5 text-xs sm:text-sm transition-colors border-b-2 -mb-[1px] flex items-center gap-1.5 ${
            activeSubTab === "sf9"
              ? "border-cnhs-green text-cnhs-green font-semibold dark:text-emerald-400"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <span>SF9 Report Cards</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeSubTab === "sf9"
                ? "bg-emerald-50 text-cnhs-green dark:bg-emerald-950/60 dark:text-emerald-400"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {learners.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("attendance")}
          className={`pb-2.5 text-xs sm:text-sm transition-colors border-b-2 -mb-[1px] ${
            activeSubTab === "attendance"
              ? "border-cnhs-green text-cnhs-green font-semibold dark:text-emerald-400"
              : "border-transparent text-slate-500 font-medium hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <span>Section Attendance</span>
        </button>
      </nav>

      {/* 8. Sub-Tab 1: Consolidated Grades Table */}
      {activeSubTab === "matrix" && (
        <AdvisoryGradesMatrix
          learners={learners}
          releasesMap={releasesMap}
          onOpenSf9Modal={handleOpenSf9}
        />
      )}

      {/* 9. Sub-Tab 2: SF9 Report Cards Compact Document View */}
      {activeSubTab === "sf9" && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          {/* SF9 Header */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dark:border-slate-800 dark:bg-slate-800/30">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                SF9 Report Cards
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>{learners.length} Learners</span>
                <span className="mx-1.5 text-slate-300 dark:text-slate-600">&bull;</span>
                <span className="text-emerald-700 font-semibold dark:text-emerald-400">
                  {readyCount} Ready
                </span>
                <span className="mx-1.5 text-slate-300 dark:text-slate-600">&bull;</span>
                <span className={pendingLearnersCount > 0 ? "text-amber-700 font-semibold dark:text-amber-400" : "text-slate-500"}>
                  {pendingLearnersCount} Pending
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (learners.length > 0) handleOpenSf9(learners[0]);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Eye size={13} />
                <span>Preview SF9</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDownloadAll}
                disabled={!learners.length}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cnhs-green px-3 text-xs font-semibold text-white shadow-xs hover:bg-[#115a3e] active:bg-[#0c432e] transition-colors disabled:opacity-50"
              >
                <Download size={13} />
                <span>Batch Download</span>
              </button>
            </div>
          </div>

          {/* Compact Learner Rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 text-[11px] font-semibold dark:bg-slate-800 dark:text-slate-300">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 px-3 w-8 text-center">#</th>
                  <th className="py-2 px-3">Learner Name</th>
                  <th className="py-2 px-3">Grade & Section</th>
                  <th className="py-2 px-3 text-center">General Average</th>
                  <th className="py-2 px-3 text-center">SF9 Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px] dark:divide-slate-800/80">
                {learners.map((learner, idx) => {
                  const isReady = learner.isComplete;
                  return (
                    <tr
                      key={learner.id}
                      className="even:bg-slate-50/50 hover:bg-slate-100/60 transition-colors dark:even:bg-slate-800/20 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatDepEdLearnerName(learner)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          LRN: {learner.lrn}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                        Grade {section?.gradeLevel}, {section?.sectionName}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        {learner.generalAverage
                          ? `${learner.generalAverage}`
                          : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {(() => {
                          const rel = releasesMap[learner.id || learner.studentId];
                          let statusLabel = isReady ? "Ready" : "Pending";
                          let statusBadgeClass = isReady
                            ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
                          let statusDotClass = isReady ? "bg-purple-600" : "bg-amber-500";

                          if (rel?.status === "released") {
                            statusLabel = "Released";
                            statusBadgeClass = "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
                            statusDotClass = "bg-cnhs-green";
                          } else if (rel?.status === "completed") {
                            statusLabel = "Completed";
                            statusBadgeClass = "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";
                            statusDotClass = "bg-blue-600";
                          }

                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadgeClass}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                              <span>{statusLabel}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenSf9(learner)}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 active:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <FileText size={11} className="text-slate-400" />
                          <span>Preview</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. Sub-Tab 3: Section SF2 Attendance Document Archive */}
      {activeSubTab === "attendance" && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/30">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Section Attendance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Official DepEd School Form 2 (SF2) monthly attendance records for Grade {section?.gradeLevel}, {section?.sectionName}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 text-slate-600 text-[11px] font-semibold dark:bg-slate-800 dark:text-slate-300">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 px-3">School Month</th>
                  <th className="py-2 px-3 text-center">School Days</th>
                  <th className="py-2 px-3 text-center">Total Attendance</th>
                  <th className="py-2 px-3 text-center">Absences</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11.5px] dark:divide-slate-800/80">
                {[
                  { month: "September 2026", days: 21, att: 982, abs: 18, completed: true },
                  { month: "October 2026", days: 22, att: 1014, abs: 24, completed: true },
                  { month: "November 2026", days: 20, att: 940, abs: 20, completed: true },
                  { month: "December 2026", days: 15, att: 700, abs: 15, completed: false },
                ].map((row, idx) => (
                  <tr
                    key={idx}
                    className="even:bg-slate-50/50 hover:bg-slate-100/60 transition-colors dark:even:bg-slate-800/20 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {row.month}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                      {row.days} Days
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                      {row.completed ? row.att : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                      {row.completed ? row.abs : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          row.completed
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            row.completed ? "bg-cnhs-green" : "bg-amber-500"
                          }`}
                        />
                        <span>{row.completed ? "Completed" : "Pending"}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {row.completed ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <span>View</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition-colors dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        >
                          <span>Complete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* Manage Official Section Roster Modal */}
      {manageModalOpen && (
        <AdvisoryRosterModal
          isOpen={manageModalOpen}
          onClose={() => setManageModalOpen(false)}
          section={section}
          learners={learners}
          onSuccess={() => advisoryState.refresh?.()}
        />
      )}

      {/* SF9 Interactive Modal */}
      {sf9ModalOpen && selectedStudentForSf9 && (
        <Sf9ReportCardModal
          key={selectedStudentForSf9.id || selectedStudentForSf9.studentId}
          isOpen={sf9ModalOpen}
          onClose={() => setSf9ModalOpen(false)}
          studentData={formatStudentForSf9(selectedStudentForSf9)}
          studentsList={learners.map((l) => formatStudentForSf9(l))}
          section={section}
          sectionName={section?.sectionName || "Section"}
          schoolYear={section?.schoolYear || "2026-2027"}
          onStatusChange={(studentId, newStatus) => {
            setReleasesMap((prev) => ({
              ...prev,
              [studentId]: {
                ...(prev[studentId] || {}),
                status: newStatus,
              },
            }));
            advisoryState.refresh?.();
          }}
        />
      )}
    </div>
  );
}
