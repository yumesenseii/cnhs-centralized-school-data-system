import { Suspense } from "react";
import MonitoringDashboard from "@/components/teacher/monitoring/MonitoringDashboard";

export const metadata = {
  title: "Academic Monitoring | CNHS Teacher Portal",
  description:
    "Class report files for monitoring — generate in My Classes, review Passing/Failing tabs, and send ARAL recommendations to the Head Teacher.",
};

export default function TeacherMonitoringPage() {
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
