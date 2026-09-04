"use client";

import { motion } from "framer-motion";
import AdminAcademicAnalytics from "@/components/dashboard/AdminAcademicAnalytics";
import Header from "@/components/dashboard/Header";
import LoadingSkeleton from "@/components/dashboard/LoadingSkeleton";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import DeferredMount from "@/components/shared/DeferredMount";
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
  const { data, loading, error, refresh } = useAdminDashboard();

  if (loading) {
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

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="pb-5"
      >
        <Header description="Unable to load the school overview." />
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white hover:bg-[#246f54]"
          >
            Retry
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
      <Header description={data?.welcomeDescription} />

      <AdminAcademicAnalytics
        schoolYear={data?.schoolYear}
        stats={stats}
        academicPerformance={academicPerformance}
        riskDistribution={riskDistribution}
        weakSubjects={weakSubjects}
        recentActivity={recentActivity}
        priorityLearners={priorityLearners}
      />

      <div className="mt-3 border-t border-slate-100 pt-3">
        <DeferredMount
          delayMs={100}
          fallback={
            <p className="py-4 text-center text-[12px] text-slate-400">
              Loading attendance analytics…
            </p>
          }
        >
          <AttendanceMonitoringPanel showUpload={false} compact />
        </DeferredMount>
        <p className="mt-2 text-[11px] text-slate-400">
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
