"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import Header from "@/components/layout/Header";

export default function AdminAttendancePage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home > Attendance Monitoring"
        title="Attendance Monitoring"
        description="Track SF2 attendance, monthly rates, and learners near the 20% absence threshold. Independent from academic risk prediction."
        controls={
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={refreshing}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={13}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
        }
      />
      <AttendanceMonitoringPanel
        refreshToken={refreshToken}
        onRefreshingChange={setRefreshing}
      />
    </motion.div>
  );
}
