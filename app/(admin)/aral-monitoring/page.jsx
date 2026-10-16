import { Suspense } from "react";
import AdminAralMonitoringDashboard from "@/components/admin/monitoring/AdminAralMonitoringDashboard";

export const metadata = {
  title: "ARAL Monitoring | CNHS Learn",
  description:
    "Principal oversight of ARAL referrals, facilitator assignments, assessment progress, and learner outcomes under RA 12028.",
};

export default function AdminAralMonitoringRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          Loading ARAL Monitoring…
        </div>
      }
    >
      <AdminAralMonitoringDashboard />
    </Suspense>
  );
}
