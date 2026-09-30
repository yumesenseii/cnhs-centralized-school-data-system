"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import DashboardHeader from "@/components/teacher/dashboard/DashboardHeader";
import StatCard from "@/components/dashboard/StatCard";
import WhatNeedsAttention from "@/components/teacher/dashboard/WhatNeedsAttention";
import MyClassesTable from "@/components/teacher/dashboard/MyClassesTable";
import AttendanceOverview from "@/components/teacher/dashboard/AttendanceOverview";
import TodaysTasks from "@/components/teacher/dashboard/TodaysTasks";
import RecentActivities from "@/components/teacher/dashboard/RecentActivities";
import GuidedTour from "@/components/shared/GuidedTour";
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
      className="pb-8"
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

      <GuidedTour role="teacher" />

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-12 text-sm text-slate-500 shadow-sm">
          <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
          Loading dashboard…
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Top 4 Summary Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(data.topStats || []).map((stat) => (
              <StatCard key={stat.id} stat={stat} />
            ))}
          </div>

          {/* What Needs Your Attention */}
          <WhatNeedsAttention items={data.attentionItems || []} />

          {/* My Classes */}
          <MyClassesTable classes={data.classes || []} />

          {/* Attendance Overview */}
          <AttendanceOverview summary={data.attendanceSummary} />

          {/* Two-Column Grid: To Do + Recent Activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TodaysTasks tasks={data.todaysTasks || { items: [] }} />
            <RecentActivities activities={data.recentActivities || []} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 bg-white py-10 text-center text-sm text-slate-500 shadow-sm">
          No assigned classes are available for this dashboard.
        </div>
      )}
    </motion.div>
  );
}
