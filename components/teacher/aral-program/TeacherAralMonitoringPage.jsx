"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  GraduationCap,
  BookOpen,
  Users,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AralMonitoringSection from "@/components/teacher/monitoring/AralMonitoringSection";
import AralLearnerRecordModal from "@/components/teacher/monitoring/AralLearnerRecordModal";
import AralAssessmentFlowModal from "@/components/teacher/monitoring/AralAssessmentFlowModal";
import PageHelp from "@/components/shared/PageHelp";
import { useTeacherMonitoring } from "@/hooks/teacher/useMonitoring";
import { formatPersonName } from "@/lib/teacher/monitoringMappers";
import {
  exportAralRecommendedExcel,
  filterAralRecommendedLearners,
} from "@/lib/reports/aralRecommendedExport";
import { useAppToast } from "@/components/shared/AppToast";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { aralPeriodLabel } from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

export default function TeacherAralMonitoringPage() {
  const searchParams = useSearchParams();
  const {
    students,
    filterOptions,
    controls,
    teacher,
    profile,
    teacherId,
    loading,
    refreshing,
    error,
    refresh,
  } = useTeacherMonitoring();

  const [selectedLearner, setSelectedLearner] = useState(null);
  const [selectedAssessmentLearner, setSelectedAssessmentLearner] = useState(null);
  const [exportingAral, setExportingAral] = useState(false);
  const { showToast } = useAppToast();
  const { period: aralPeriod } = useAralAssessmentPeriod();

  const teacherDisplayName = useMemo(() => {
    const named = formatPersonName(teacher);
    if (named && named !== "—") return named;
    return profile?.email || "Teacher";
  }, [teacher, profile]);

  // Deep-link learner selection: ?studentId=...
  useEffect(() => {
    const studentId = searchParams?.get("studentId");
    if (!studentId || loading || !students.length) return;
    const hit = students.find(
      (s) => s.studentId === studentId || s.id === studentId
    );
    if (hit) {
      setSelectedLearner(hit);
    }
  }, [searchParams, loading, students]);

  const aralExportCount = useMemo(
    () => filterAralRecommendedLearners(students).length,
    [students]
  );

  async function handleExportAral() {
    if (exportingAral) return;
    setExportingAral(true);
    try {
      await exportAralRecommendedExcel({
        learners: students,
        schoolYear: controls.schoolYear,
        quarter: controls.quarter,
        periodLabel: controls.quarter,
        generatedBy: teacherDisplayName,
        scopeLabel: "My Reading Classes",
        includeTeacherColumn: false,
      });
    } catch (err) {
      console.error(err);
      showToast("Unable to export ARAL recommended list.");
    } finally {
      setExportingAral(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-6"
    >
      {/* Page Header */}
      <header className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400">
                  <Link
                    href="/teacher/dashboard"
                    className="hover:text-slate-600 transition-colors"
                  >
                    Home
                  </Link>
                  <span className="text-slate-300"> &gt; </span>
                  <span className="font-semibold text-slate-600">
                    ARAL Monitoring
                  </span>
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px] dark:text-white">
                    ARAL Monitoring
                  </h1>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-[#246f54] dark:text-emerald-400">
                  {aralPeriodLabel(aralPeriod)} · {controls.schoolYear || "SY 2026–2027"}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Reading assessment and ARAL support for assigned learners.
                </p>
              </div>

              <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
                {(close) => <TeacherSidebar mobile onNavigate={close} />}
              </MobileNavSheet>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <PageHelp
              summary="Teacher ARAL Monitoring for English & Filipino reading assessment and support."
              steps={[
                "Who is assigned to me? Check the learner work queue below.",
                "What step are they in? Review the current step (Waiting for Assessment, Needs Individual Assessment, Under ARAL Support, etc.).",
                "What do I do next? Click Assess to record GST screening, Continue for Individual Assessment, or View for the full record.",
                "Summary Cards at the top give you an instant tally of remaining tasks.",
              ]}
            />

            <button
              type="button"
              onClick={handleExportAral}
              disabled={loading || exportingAral || aralExportCount === 0}
              title="Download Eng/Fil ARAL-recommended learners list."
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-[#246f54] transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              {exportingAral ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={13} />
              )}
              <span>Export Endorsement List</span>
              {aralExportCount > 0 ? (
                <span className="rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-[#246f54]">
                  {aralExportCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <Link
              href="/teacher/monitoring"
              title="Return to general Academic Monitoring across subjects"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            >
              <FileText size={13} />
              <span>Academic Monitoring</span>
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {/* Main Content Area */}
      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-16 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <Loader2 size={16} className="animate-spin text-[#246f54]" />
          <span>Loading ARAL monitoring records…</span>
        </div>
      ) : (
        <AralMonitoringSection
          students={students}
          filterOptions={filterOptions}
          teacherId={teacherId}
          schoolYear={controls.schoolYear}
          quarter={controls.quarter}
          aralPeriod={aralPeriod}
          onRefresh={refresh}
          onViewLearner={setSelectedLearner}
        />
      )}

      {/* Focused 5-Part Learner Record Modal */}
      <AralLearnerRecordModal
        learner={selectedLearner}
        isOpen={Boolean(selectedLearner)}
        onClose={() => setSelectedLearner(null)}
        teacherId={teacherId}
        schoolYear={controls.schoolYear}
        onOpenAssessment={(l) => {
          setSelectedAssessmentLearner(l);
          setSelectedLearner(null);
        }}
        onRefresh={refresh}
      />

      {/* Two-Stage Assessment Flow Modal */}
      <AralAssessmentFlowModal
        learner={selectedAssessmentLearner}
        isOpen={Boolean(selectedAssessmentLearner)}
        onClose={() => setSelectedAssessmentLearner(null)}
        teacherId={teacherId}
        schoolYear={controls.schoolYear}
        quarter={controls.quarter}
        aralPeriod={aralPeriod}
        onSuccess={refresh}
      />
    </motion.div>
  );
}
