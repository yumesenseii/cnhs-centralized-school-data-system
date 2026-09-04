"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import TeacherAttendancePanel from "@/components/teacher/attendance/TeacherAttendancePanel";

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
      <header className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <span className="font-semibold text-slate-600">Attendance</span>
          </p>
          <div className="mt-2 flex items-start gap-2">
            <Link
              href="/teacher/dashboard"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-800">
                My section attendance
              </h1>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Upload your class monthly summary, then review ADA, PA, and
                absences for your section.
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
