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
import StudentMonitoringSidePanel from "@/components/teacher/monitoring/StudentMonitoringSidePanel";
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
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px]">
                    ARAL Monitoring
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-cnhs-green-dark border border-emerald-200">
                    <GraduationCap size={13} />
                    RA 12028
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">
                  Specialized reading intervention and Phil-IRI assessment tracking.
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {controls.schoolYear} · Term {controls.quarterNumber || 1}
                  <span className="mx-1.5 text-slate-300">•</span>
                  <span className="font-semibold text-cnhs-green-dark">
                    {aralPeriodLabel(aralPeriod)}
                  </span>
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
              summary="Specialized reading intervention tracking across DepEd ARAL milestones."
              steps={[
                "BOSY Group Screening Test (GST) Form 1B establishes baseline reading levels.",
                "Review candidates flagged from English and Filipino academic performance.",
                "Track learners across: Needs Review → Active Intervention → Midline → EOSY → Final Outcome.",
                "ARAL Summer Program is strictly recorded as an Eligibility/Referral state (Eligible/Not Eligible); summer lessons and scheduling are conducted outside CNHS Learn.",
                "Click on any learner to view their continuous Learner Profile and update Phil-IRI assessment scores.",
              ]}
            />

            <button
              type="button"
              onClick={handleExportAral}
              disabled={loading || exportingAral || aralExportCount === 0}
              title="Download Eng/Fil ARAL-recommended learners list."
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-cnhs-green-dark transition-colors hover:bg-emerald-100 disabled:opacity-60"
            >
              {exportingAral ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={13} />
              )}
              <span>Export Endorsement List</span>
              {aralExportCount > 0 ? (
                <span className="rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-cnhs-green-dark">
                  {aralExportCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <FileText size={13} />
              <span>Academic Monitoring</span>
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {/* Main Content Area */}
      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-16 text-sm text-slate-500 shadow-sm">
          <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
          <span>Loading ARAL monitoring records…</span>
        </div>
      ) : (
        <AralMonitoringSection
          students={students}
          teacherId={teacherId}
          schoolYear={controls.schoolYear}
          quarter={controls.quarter}
          aralPeriod={aralPeriod}
          onRefresh={refresh}
          onViewLearner={setSelectedLearner}
        />
      )}

      {/* Continuous Learner Profile Side Panel (ARAL context) */}
      <StudentMonitoringSidePanel
        learner={selectedLearner}
        isOpen={Boolean(selectedLearner)}
        onClose={() => setSelectedLearner(null)}
        onRefresh={refresh}
        context="aral"
        aralPeriod={aralPeriod}
        isLanguageTeacher={true}
        currentQuarterNumber={controls.quarterNumber || 1}
      />
    </motion.div>
  );
}
