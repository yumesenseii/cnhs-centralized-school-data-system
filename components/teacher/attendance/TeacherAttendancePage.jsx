"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import TeacherAttendancePanel from "@/components/teacher/attendance/TeacherAttendancePanel";
import PageHelp from "@/components/shared/PageHelp";

export default function TeacherAttendancePage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[10px] font-medium text-slate-400">
          <Link href="/teacher/dashboard" className="hover:text-slate-600">
            Home
          </Link>
          <span className="text-slate-300"> &gt; </span>
          <span className="font-semibold text-slate-600">
            Attendance Monitoring
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <PageHelp
            summary="Daily Morning and Afternoon attendance from saved records."
            steps={[
              "Select school year, section, and date. Advisers mark Present or Absent for Morning and Afternoon.",
              "Save each session after roll call. Unsaved Present defaults are on-screen only until you Save.",
              "Review section totals below. Month close (adviser) unlocks ADA / % for that month.",
              "PDF or Excel opens a preview first — Cancel creates no file.",
              "From saved Morning and Afternoon marks. Check this copy before signing the official SF2.",
            ]}
          />
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={refreshing}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-transparent px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/6"
          >
            <RefreshCw
              size={13}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <MobileNavSheet
            ariaLabel="Open teacher menu"
            title="Teacher navigation"
          >
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>
      </header>

      <TeacherAttendancePanel
        refreshToken={refreshToken}
        onRefreshingChange={setRefreshing}
      />
    </motion.div>
  );
}
