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
              summary="School-wide attendance from teachers’ daily Morning and Afternoon marks."
              steps={[
                "Filter by school year, month, and grade, then Apply.",
                "Present and absent counts are Morning plus Afternoon marks, not unique students.",
                "PDF / Excel open a preview first, then download. Working report only — not the official SF2.",
                "Advisers record daily marks on the teacher attendance page.",
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
      <AdminAttendancePanel
        refreshToken={refreshToken}
        onRefreshingChange={setRefreshing}
      />
    </motion.div>
  );
}
