"use client";

import { motion } from "framer-motion";
import ChartCard from "@/components/dashboard/ChartCard";
import EmptyState from "@/components/dashboard/EmptyState";
import Header from "@/components/dashboard/Header";
import LoadingSkeleton from "@/components/dashboard/LoadingSkeleton";
import PerformanceChart from "@/components/dashboard/PerformanceChart";
import PriorityLearnersTable from "@/components/dashboard/PriorityLearnersTable";
import RecentActivity from "@/components/dashboard/RecentActivity";
import RiskDistributionChart from "@/components/dashboard/RiskDistributionChart";
import StatCard from "@/components/dashboard/StatCard";
import WeakSubjectChart from "@/components/dashboard/WeakSubjectChart";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import { useAdminDashboard } from "@/hooks/admin/useAdminDashboard";

function DashboardLoading() {
  return (
    <div className="pb-4">
      <Header description="Loading school overview…" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingSkeleton key={index} type="card" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
        <LoadingSkeleton type="chart" />
        <LoadingSkeleton type="chart" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
        <LoadingSkeleton type="chart" />
        <LoadingSkeleton type="chart" />
      </div>
      <div className="mt-3">
        <LoadingSkeleton type="table" />
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
  const meta = data?.meta ?? {};
  const emptySchool = !meta.hasStudents && !meta.hasClasses;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header description={data?.welcomeDescription} />

      {emptySchool ? (
        <EmptyState
          title="No school data yet"
          description="Create sections, assign classes, and import E-Class records to populate this overview."
        />
      ) : (
        <>
          <section className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {/* Academic Analytics */}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {/* Risk predictions are based on academic performance (ECR grades)
              only. Attendance is not a prediction input. */}
            </p>
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.id} stat={stat} />
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
            <ChartCard title="Academic Performance by Grade Level">
              {academicPerformance.length ? (
                <PerformanceChart data={academicPerformance} />
              ) : (
                <EmptyState
                  title="No grade averages yet"
                  description="Import E-Class records so grade-level averages can appear here."
                />
              )}
            </ChartCard>
            <ChartCard title="Risk Distribution">
              {riskDistribution.length ? (
                <RiskDistributionChart data={riskDistribution} />
              ) : (
                <EmptyState
                  title="No risk distribution yet"
                  description="Learner risk appears after grades are available for recommendation scoring."
                />
              )}
            </ChartCard>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.08fr_1fr]">
            <ChartCard title="Weak Subject Distribution">
              {weakSubjects.length ? (
                <WeakSubjectChart data={weakSubjects} />
              ) : (
                <EmptyState
                  title="No weak subjects flagged"
                  description="Subjects with learners below the passing grade will show here."
                />
              )}
            </ChartCard>
            <ChartCard title="Recent Activity">
              <RecentActivity activities={recentActivity} />
            </ChartCard>
          </div>

          <div className="mt-3">
            <PriorityLearnersTable learners={priorityLearners} />
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <AttendanceMonitoringPanel
              title="Attendance Analytics"
              showUpload={false}
              compact
            />
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
        </>
      )}
    </motion.div>
  );
}
