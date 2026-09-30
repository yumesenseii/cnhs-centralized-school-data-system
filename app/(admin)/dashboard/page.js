"use client";

import { motion } from "framer-motion";
import AdminAcademicAnalytics from "@/components/dashboard/AdminAcademicAnalytics";
import Header from "@/components/dashboard/Header";
import LoadingSkeleton from "@/components/dashboard/LoadingSkeleton";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import DeferredMount from "@/components/shared/DeferredMount";
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
  const academicPerformance = data?.academicPerformance ?? [];
  const riskDistribution = data?.riskDistribution ?? [];
  const weakSubjects = data?.weakSubjects ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const priorityLearners = data?.priorityLearners ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        description={data?.welcomeDescription}
        controls={
          <PageHelp
            summary="School overview of academic risk and attendance (separate modules)."
            steps={[
              "Review the four summary cards for learner counts and risk.",
              "Use Summary / Charts / By Level / Breakdown tabs for details.",
              "Risk and recommendations use ECR grades only — not attendance.",
              "Attendance snapshot below is from SF2 archive or daily records; open Attendance Monitoring for full tools.",
              "Click a risk card or filter to open the learner breakdown.",
            ]}
          />
        }
      />

      <GuidedTour role="admin" />

      <AdminAcademicAnalytics
        schoolYear={data?.schoolYear}
        stats={stats}
        academicPerformance={academicPerformance}
        riskDistribution={riskDistribution}
        weakSubjects={weakSubjects}
        recentActivity={recentActivity}
        priorityLearners={priorityLearners}
      />

      <div className="mt-2 border-t border-slate-100 pt-2">
        <DeferredMount
          delayMs={100}
          fallback={
            <p className="py-3 text-center text-[12px] text-slate-400">
              Loading attendance analytics…
            </p>
          }
        >
          <AttendanceMonitoringPanel
            showUpload={false}
            compact
            linkHref="/attendance"
            linkLabel="Attendance →"
          />
        </DeferredMount>
        <p className="mt-1.5 text-[10px] text-slate-400">
          Upload SF2 files and manage monthly reports on{" "}
          <a
            href="/attendance"
            className="font-semibold text-cnhs-green-dark hover:underline"
          >
            Attendance Monitoring
          </a>
          .
        </p>
      </div>
    </motion.div>
  );
}
