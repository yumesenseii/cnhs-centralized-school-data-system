"use client";

import { motion } from "framer-motion";
import AttendanceMonitoringPanel from "@/components/attendance/AttendanceMonitoringPanel";
import Header from "@/components/layout/Header";

export default function AdminAttendancePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / Attendance Monitoring"
        title="Attendance Monitoring"
        description="SF2 uploads, monthly attendance reports, and 20% absence warnings — separate from academic risk prediction."
      />
      <AttendanceMonitoringPanel />
    </motion.div>
  );
}
