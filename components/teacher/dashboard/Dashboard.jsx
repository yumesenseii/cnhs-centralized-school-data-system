"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import DashboardHeader from "@/components/teacher/dashboard/DashboardHeader";
import TeacherAcademicAnalytics from "@/components/teacher/dashboard/TeacherAcademicAnalytics";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import DeferredMount from "@/components/shared/DeferredMount";
import { useTeacherDashboard } from "@/hooks/teacher/useTeacherDashboard";

function formatCurrentDate() {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

  // Client-only date — avoids React hydration #418 (server vs browser locale/TZ).
  const [currentDate, setCurrentDate] = useState("");
  useEffect(() => {
    setCurrentDate(formatCurrentDate());
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <DashboardHeader
        controls={{
          ...(data?.controls ?? {}),
          schoolYear,
          schoolYears: schoolYears.length
            ? schoolYears
            : schoolYear
              ? [schoolYear]
              : [],
          quarterValue: quarter,
          quarters: quarters.length ? quarters : ["1"],
          currentDate: currentDate || data?.controls?.currentDate || "\u00a0",
          onSchoolYearChange: setSchoolYear,
          onQuarterChange: setQuarter,
        }}
      />

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading dashboard…
        </div>
      ) : data ? (
        <>
          <TeacherAcademicAnalytics
            schoolYear={schoolYear}
            stats={data.stats ?? []}
            classes={data.classes}
            recentActivities={data.recentActivities}
            learnersAttention={data.learnersAttention}
            todaysTasks={data.todaysTasks}
            quickActions={data.quickActions}
            upcomingDeadlines={data.upcomingDeadlines}
            monitoringProgress={data.monitoringProgress}
            systemRecommendations={data.systemRecommendations}
          />

          <div className="mt-3 border-t border-slate-100 pt-3">
            <DeferredMount delayMs={120}>
              <AttendanceMonitoringPanel
                title="Attendance Analytics"
                showUpload={false}
                compact
              />
            </DeferredMount>
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
