"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import DashboardHeader from "@/components/teacher/dashboard/DashboardHeader";
import KPICards from "@/components/teacher/dashboard/KPICards";
import LearnersAttention from "@/components/teacher/dashboard/LearnersAttention";
import MonitoringProgress from "@/components/teacher/dashboard/MonitoringProgress";
import MyClassesTable from "@/components/teacher/dashboard/MyClassesTable";
import QuickActions from "@/components/teacher/dashboard/QuickActions";
import RecentActivities from "@/components/teacher/dashboard/RecentActivities";
import SystemRecommendations from "@/components/teacher/dashboard/SystemRecommendations";
import TodaysTasks from "@/components/teacher/dashboard/TodaysTasks";
import UpcomingDeadlines from "@/components/teacher/dashboard/UpcomingDeadlines";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import { useTeacherDashboard } from "@/hooks/teacher/useTeacherDashboard";

export default function Dashboard() {
  const {
    data,
    schoolYear,
    quarter,
    schoolYears,
    quarters,
    setSchoolYear,
    setQuarter,
    loading,
    error,
  } = useTeacherDashboard();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-4"
    >
      <DashboardHeader
        controls={{
          ...(data?.controls ?? {
            schoolYear,
            currentDate: new Date().toLocaleDateString("en-PH", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
          }),
          schoolYear,
          schoolYears,
          quarterValue: quarter,
          quarters,
          onSchoolYearChange: setSchoolYear,
          onQuarterChange: setQuarter,
        }}
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading dashboard…
        </div>
      ) : data ? (
        <>
          <section className="mb-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Academic Analytics
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Risk predictions are based on academic performance (ECR grades)
              only.
            </p>
          </section>

          <KPICards kpis={data.kpis} />

          <div className="mt-3">
            <TodaysTasks tasks={data.todaysTasks} />
          </div>

          <div className="mt-3">
            <MyClassesTable classes={data.classes} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <RecentActivities activities={data.recentActivities} />
            <LearnersAttention learners={data.learnersAttention} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1.15fr]">
            <MonitoringProgress monitoring={data.monitoringProgress} />
            <SystemRecommendations recommendations={data.systemRecommendations} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <QuickActions actions={data.quickActions} />
            <UpcomingDeadlines deadlines={data.upcomingDeadlines} />
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <AttendanceMonitoringPanel
              title="Attendance Analytics"
              showUpload={false}
              compact
            />
            <p className="mt-2 text-[11px] text-slate-400">
              Manage SF2 uploads on{" "}
              <a
                href="/teacher/attendance"
                className="font-semibold text-cnhs-green-dark hover:underline"
              >
                Attendance Monitoring
              </a>
              .
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-white py-10 text-center text-sm text-slate-500">
          No assigned classes are available for this dashboard.
        </div>
      )}
    </motion.div>
  );
}
