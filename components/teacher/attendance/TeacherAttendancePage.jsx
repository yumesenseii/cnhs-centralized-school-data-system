"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";

export default function TeacherAttendancePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <span className="font-semibold text-slate-600">Attendance</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/teacher/dashboard"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-800">
                Attendance Monitoring
              </h1>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Upload SF2 files and track learners near the 20% absence
                threshold. Not used in academic risk prediction.
              </p>
            </div>
          </div>
        </div>

        <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
          {(close) => <TeacherSidebar mobile onNavigate={close} />}
        </MobileNavSheet>
      </header>

      <AttendanceMonitoringPanel />
    </motion.div>
  );
}
