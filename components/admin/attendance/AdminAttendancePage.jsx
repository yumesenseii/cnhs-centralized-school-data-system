"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import AdminAttendancePanel from "@/components/admin/attendance/AdminAttendancePanel";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";

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
        controls={
          <>
            <PageHelp
              summary="School-wide attendance monitoring from teachers’ daily Morning and Afternoon records."
              steps={[
                "Select school year, month, and grade level to monitor daily attendance.",
                "Review section submission status and attendance rates across the school.",
                "Click View on any section to inspect learners needing attendance follow-up.",
                "Formal attendance reports and printable summaries are available under Reports → Attendance.",
                "Attendance Monitoring does not replace the official SF2.",
              ]}
            />
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
          </>
        }
      />
      <div className="mb-3 px-0.5">
        <p className="text-[12px] font-medium text-slate-500">
          For attendance monitoring only. This does not replace the official SF2.
        </p>
      </div>
      <AdminAttendancePanel
        refreshToken={refreshToken}
        onRefreshingChange={setRefreshing}
      />
    </motion.div>
  );
}
