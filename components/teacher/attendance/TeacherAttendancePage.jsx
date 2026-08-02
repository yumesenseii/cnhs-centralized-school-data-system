"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function TeacherAttendancePage() {
  const [menuOpen, setMenuOpen] = useState(false);

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

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="Open teacher menu"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
              />
            }
          >
            <Menu size={18} />
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className={SIDEBAR_SHEET_CLASS}
          >
            <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
            <TeacherSidebar mobile onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <AttendanceMonitoringPanel />
    </motion.div>
  );
}
