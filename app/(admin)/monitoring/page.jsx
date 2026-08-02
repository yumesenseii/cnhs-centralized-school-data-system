import { Suspense } from "react";
import AdminMonitoringPage from "@/components/admin/monitoring/AdminMonitoringPage";

export const metadata = {
  title: "Student Monitoring | CNHS Admin",
  description:
    "View at-risk students, ARAL Learners and remediation recommendations, and teacher monitoring progress.",
};

export default function AdminMonitoringRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          Loading monitoring…
        </div>
      }
    >
      <AdminMonitoringPage />
    </Suspense>
  );
}
