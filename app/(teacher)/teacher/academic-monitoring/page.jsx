import { Suspense } from "react";
import MonitoringDashboard from "@/components/teacher/monitoring/MonitoringDashboard";

export const metadata = {
  title: "Academic Monitoring | CNHS Learn",
  description:
    "Monitor learner performance and identify students who need academic support.",
};

export default function TeacherAcademicMonitoringPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading Academic Monitoring…
        </div>
      }
    >
      <MonitoringDashboard />
    </Suspense>
  );
}
