"use client";

import { motion } from "framer-motion";
import AdminAcademicAnalytics from "@/components/dashboard/AdminAcademicAnalytics";
import Header from "@/components/dashboard/Header";
import LoadingSkeleton from "@/components/dashboard/LoadingSkeleton";
import PageHelp from "@/components/shared/PageHelp";
import GuidedTour from "@/components/shared/GuidedTour";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useAdminDashboard } from "@/hooks/admin/useAdminDashboard";

function DashboardLoading() {
  return (
    <div className="pb-4">
      <Header description="Loading school overview…" />
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="mb-4 h-12 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} type="card" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
          <LoadingSkeleton type="chart" />
          <LoadingSkeleton type="chart" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, refreshing, error, refresh } = useAdminDashboard();

  if (loading && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <DashboardLoading />
      </motion.div>
    );
  }

  if (error && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="pb-5"
      >
        <Header description="Overview status" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200/80 bg-red-50/70 p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-red-950/30 sm:p-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
            <AlertCircle size={24} />
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">
            {error}
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">
            Please verify that your server is running and click Retry to reload the latest school overview data.
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-5 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-cnhs-green-dark px-5 text-[12.5px] font-semibold text-white shadow-sm transition-all hover:bg-[#246f54] active:scale-95"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>Retry Connection</span>
          </button>
        </div>
      </motion.div>
    );
  }

  const stats = data?.stats ?? [];
  const weakSubjects = data?.weakSubjects ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const supportByGrade = data?.supportByGrade ?? [];
  const subjectBands = data?.subjectBands ?? [];
  const subjectUnassignedCount = data?.subjectUnassignedCount ?? 0;
  const gradeSectionTree = data?.gradeSectionTree ?? [];
  const termTrends = data?.termTrends ?? [];
  const watchSections = data?.watchSections ?? [];
  const pendingAralReferrals = data?.pendingAralReferrals ?? 0;
  const pendingLessonPlans = data?.pendingLessonPlans ?? 0;
  const aralPipeline = data?.aralPipeline ?? {
    pending: 0,
    waiting: 0,
    active: 0,
    completed: 0,
  };
  const aralAttention = data?.aralAttention ?? {
    unassignedFacilitator: 0,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        description="Here is what needs your attention today."
        controls={
          <PageHelp
            summary="School overview of learners needing support (ECR grades only)."
            steps={[
              "Start with Needs Your Attention for items requiring action.",
              "Use Academic Overview / ARAL Overview / Progress Over Time for the school picture.",
              "Risk and recommendations use ECR grades only — not attendance.",
              "Attendance snapshot below is from SF2 archive or daily records; open Attendance Monitoring for full tools.",
              "Click a card action to open learners, sections, or reviews.",
            ]}
          />
        }
      />

      <GuidedTour role="admin" />

      <AdminAcademicAnalytics
        schoolYear={data?.schoolYear}
        stats={stats}
        weakSubjects={weakSubjects}
        recentActivity={recentActivity}
        supportByGrade={supportByGrade}
        subjectBands={subjectBands}
        subjectUnassignedCount={subjectUnassignedCount}
        gradeSectionTree={gradeSectionTree}
        termTrends={termTrends}
        watchSections={watchSections}
        pendingAralReferrals={pendingAralReferrals}
        pendingLessonPlans={pendingLessonPlans}
        aralPipeline={aralPipeline}
        aralAttention={aralAttention}
      />
    </motion.div>
  );
}
