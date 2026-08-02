"use client";

import { use } from "react";
import StudentMonitoringDetails from "@/components/teacher/monitoring/StudentMonitoringDetails";

export default function TeacherStudentMonitoringPage({ params }) {
  const { classId, studentId } = use(params);
  return (
    <StudentMonitoringDetails classId={classId} studentId={studentId} />
  );
}
