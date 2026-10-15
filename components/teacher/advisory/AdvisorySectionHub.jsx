"use client";

import React, { useState } from "react";
import {
  CloudUpload,
  School,
  Loader2,
  AlertCircle,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
} from "lucide-react";
import { useAdvisoryClass } from "@/hooks/teacher/useAdvisoryClass";
import AdvisoryRosterModal from "@/components/teacher/advisory/AdvisoryRosterModal";
import AdvisorySf9Modal from "@/components/teacher/advisory/AdvisorySf9Modal";
import AdvisoryAttendanceModal from "@/components/teacher/advisory/AdvisoryAttendanceModal";
import Sf9ReportCardModal from "@/components/reports/Sf9ReportCardModal";
import { formatStudentForSf9 } from "@/lib/reports/sf9DataService";
import {
  downloadSectionBatchSf9Pdf,
  downloadSectionBatchSf9PdfAsync,
} from "@/lib/reports/sf9PdfGenerator";
import SubjectPublishTracker from "@/components/teacher/advisory/SubjectPublishTracker";
import { deriveSchoolYearAttendanceMonths } from "@/lib/attendance/constants";

export default function AdvisorySectionHub({ advisory }) {
  const fallbackAdvisory = useAdvisoryClass();
  const advisoryState = advisory || fallbackAdvisory;

  const {
    hasAdvisory,
    section,
    subjectPublishStatus,
    publishedSubjectsCount,
    totalSubjectsCount,
    learners = [],
    attendanceMonths = [],
    loading,
    error,
    refresh,
  } = advisoryState;

  // Modals state
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterModalInitialTab, setRosterModalInitialTab] = useState("roster");
  const [sf9ModalOpen, setSf9ModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [subjectTrackerOpen, setSubjectTrackerOpen] = useState(false);

  // Single student SF9 Preview modal
  const [selectedStudentForSf9, setSelectedStudentForSf9] = useState(null);
  const [singleSf9ModalOpen, setSingleSf9ModalOpen] = useState(false);
  const [batchPdfWorking, setBatchPdfWorking] = useState(false);
  const [batchPdfProgress, setBatchPdfProgress] = useState(null);

  // Dynamic curriculum subjects calculation (Safeguard 1: do not hardcode 8 subjects)
  const subjectsList = subjectPublishStatus || [];
  const totalSubjects = totalSubjectsCount || subjectsList.length || 0;
  const publishedCount =
    publishedSubjectsCount !== undefined
      ? publishedSubjectsCount
      : subjectsList.filter((s) => s.isPublished).length;
  const pendingCount = Math.max(0, totalSubjects - publishedCount);
  const partiallyPublishedList = subjectsList.filter((s) => s.isPartiallyPublished);

  // SF9 readiness rule (Safeguard 2: reuse system completeness rule)
  const hasRoster = learners.length > 0;
  const readyCount = learners.filter((l) => l.isComplete).length;
  const isSf9Ready = hasRoster && readyCount > 0 && readyCount === learners.length;

  // Attendance summary metrics derived dynamically from active school year
  const dynamicCalendar = deriveSchoolYearAttendanceMonths(section?.schoolYear);
  const totalMonths = dynamicCalendar.length;
  const recordedMonths = dynamicCalendar.filter((cal) => {
    const found = (attendanceMonths || []).find((dbM) => {
      const dbName = String(dbM.month || "").toLowerCase();
      const calName = cal.month.toLowerCase().split(" ")[0];
      return dbName.includes(calName);
    });
    return Boolean(found?.isRecorded) || Number(found?.total_attendance || found?.att || 0) > 0 || Number(found?.absences || found?.abs || 0) > 0;
  }).length;
  const pendingMonths = Math.max(0, totalMonths - recordedMonths);

  const handleOpenSingleStudentSf9 = (student) => {
    setSelectedStudentForSf9(student);
    setSingleSf9ModalOpen(true);
  };

  const handleBatchDownloadAll = async () => {
    if (!learners.length || batchPdfWorking) return;
    setBatchPdfWorking(true);
    setBatchPdfProgress({ current: 0, total: learners.length, percent: 0, studentName: "" });
    try {
      const formatted = learners.map(formatStudentForSf9);
      await downloadSectionBatchSf9PdfAsync(
        section?.sectionName || "Section",
        formatted,
        section?.schoolYear,
        (progress) => {
          setBatchPdfProgress(progress);
        }
      );
    } catch (err) {
      console.error("Batch SF9 download failed:", err);
    } finally {
      setBatchPdfWorking(false);
      setBatchPdfProgress(null);
    }
  };

  const handleOpenUploadRoster = () => {
    setRosterModalInitialTab("upload");
    setRosterModalOpen(true);
  };

  const handleOpenManageRoster = () => {
    setRosterModalInitialTab("roster");
    setRosterModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-[45vh] flex flex-col items-center justify-center gap-3 text-slate-500 py-16">
        <Loader2 className="w-8 h-8 animate-spin text-cnhs-green" />
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Loading advisory section records...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-start gap-3 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <h4 className="font-bold text-sm">Failed to load Advisory Section</h4>
            <p className="text-xs mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Not an adviser state
  if (!hasAdvisory) {
    return (
      <div className="py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)] max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3 dark:bg-white/5">
            <School className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            No Class Advisory Assigned
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            You do not have an advisory section assigned for this school year. If you are an assigned class adviser, please contact the School Principal.
          </p>
        </div>
      </div>
    );
  }

  const hasNoRoster = !hasRoster;
  const progressPercent =
    totalSubjects > 0
      ? Math.min(100, Math.round((publishedCount / totalSubjects) * 100))
      : 0;

  return (
    <div className="space-y-5 pb-8">
      {/* SECTION HEADER & SUMMARY */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs dark:border-white/10 dark:bg-[var(--card)] sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                Official Advisory Section
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                SY {section?.schoolYear || "2026-2027"}
              </span>
            </div>
            <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Grade {section?.gradeLevel} &mdash; {section?.sectionName}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Class Adviser: <strong className="text-slate-700 dark:text-slate-300">{section?.adviserName || "Class Adviser"}</strong>
            </p>
          </div>

          {/* Action & Summary (Terminology: Class List, never Roster) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {hasNoRoster ? (
              <span className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                0 Learners &middot; Class list not yet set up
              </span>
            ) : (
              <>
                {section?.remedialLearnersCount > 0 ? (
                  <span
                    title={`${section.remedialLearnersCount} advisees are currently receiving remedial support from subject teachers`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>{section.remedialLearnersCount} under Subject Remedial</span>
                  </span>
                ) : null}
                <span className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 text-xs font-bold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {learners.length} Learners
                </span>
                <button
                  type="button"
                  onClick={handleOpenManageRoster}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Users size={14} className="text-cnhs-green" />
                  <span>Manage Class List</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: 1 SINGLE PAGE */}
      {hasNoRoster ? (
        /* EMPTY / NO CLASS LIST STATE: ONE CLEAN SETUP CARD */
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 sm:p-12 text-center shadow-2xs dark:border-white/10 dark:bg-[var(--card)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Users size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Class setup required
          </h3>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            No learners have been added to this section yet. Upload the official class list to begin.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleOpenUploadRoster}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-cnhs-green-dark px-6 text-sm font-bold text-white shadow-xs hover:bg-[#1b5842] transition"
            >
              <CloudUpload size={18} />
              <span>Upload Official Class List</span>
            </button>
            <span className="text-xs text-slate-400">
              Accepted file: .xlsx
            </span>
          </div>
        </div>
      ) : (
        /* ACTIVE STATE: EXACTLY 3 FOCUSED TASK CARDS */
        <div className="space-y-4">
          {/* CARD 1: GRADE SUBMISSION (Read-only summary + Tracker Modal) */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Grade Submission
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {publishedCount} of {totalSubjects} subjects published
                </p>
                {partiallyPublishedList.length > 0 ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300 font-medium">
                    * {partiallyPublishedList.map((p) => p.label).join(", ")}: One sub-area published, awaiting remaining sub-area.
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {pendingCount > 0
                    ? `${pendingCount} subject${pendingCount === 1 ? "" : "s"} pending`
                    : "All subjects published"}
                </span>
                <button
                  type="button"
                  onClick={() => setSubjectTrackerOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <span>View Tracker</span>
                </button>
              </div>
            </div>

            {/* Simple progress bar */}
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-white/10">
                <div
                  className="h-full bg-cnhs-green rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* CARD 2: SF9 REPORT CARDS */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-cnhs-green dark:bg-emerald-950/40 dark:text-emerald-300">
                    <FileText size={14} />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    SF9 Report Cards
                  </h3>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {learners.length} total learners &middot; {readyCount} final-ready
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isSf9Ready
                    ? "All required subject grades are complete. Report cards are ready for final release."
                    : "Some subject grades are still pending. You may preview available SF9 records."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSf9ModalOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start sm:self-auto rounded-xl bg-cnhs-green-dark px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1b5842] transition"
              >
                <span>View SF9 Report Cards</span>
              </button>
            </div>
          </div>

          {/* CARD 3: ATTENDANCE */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-50 text-cnhs-green dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Calendar size={14} />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Attendance
                  </h3>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {recordedMonths} of {totalMonths} months recorded &middot; {pendingMonths} pending
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Section monthly attendance summary and absence totals.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAttendanceModalOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <span>View Attendance</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. CLASS LIST SETUP MODAL */}
      <AdvisoryRosterModal
        isOpen={rosterModalOpen}
        onClose={() => setRosterModalOpen(false)}
        section={section}
        learners={learners}
        onSuccess={refresh}
        initialTab={rosterModalInitialTab}
      />

      {/* 2. SF9 REPORT CARDS MODAL */}
      <AdvisorySf9Modal
        isOpen={sf9ModalOpen}
        onClose={() => {
          if (!batchPdfWorking) setSf9ModalOpen(false);
        }}
        section={section}
        learners={learners}
        totalSubjects={totalSubjects}
        onPreviewStudent={handleOpenSingleStudentSf9}
        onBatchDownloadAll={handleBatchDownloadAll}
        isBatchDownloading={batchPdfWorking}
        batchDownloadProgress={batchPdfProgress}
      />

      {/* 3. ATTENDANCE MODAL */}
      <AdvisoryAttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        section={section}
        attendanceMonths={attendanceMonths}
      />

      {/* 4. SINGLE STUDENT SF9 PREVIEW MODAL */}
      {singleSf9ModalOpen && selectedStudentForSf9 && (
        <Sf9ReportCardModal
          isOpen={singleSf9ModalOpen}
          onClose={() => {
            setSingleSf9ModalOpen(false);
            setSelectedStudentForSf9(null);
          }}
          studentData={formatStudentForSf9(selectedStudentForSf9)}
          section={section}
          sectionName={section?.sectionName}
          schoolYear={section?.schoolYear}
          subjectsList={subjectsList}
          onStatusChange={refresh}
        />
      )}

      {/* 5. SUBJECT PUBLISH TRACKER MODAL */}
      <SubjectPublishTracker
        isOpen={subjectTrackerOpen}
        onClose={() => setSubjectTrackerOpen(false)}
        subjectPublishStatus={subjectPublishStatus}
        publishedCount={publishedCount}
        totalCount={totalSubjects}
      />
    </div>
  );
}
