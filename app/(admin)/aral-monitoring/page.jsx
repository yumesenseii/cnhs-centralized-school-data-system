import { Suspense } from "react";
import AdminAralMonitoringDashboard from "@/components/admin/monitoring/AdminAralMonitoringDashboard";

export const metadata = {
  title: "Reading Intervention | CNHS Learn",
  description:
    "Principal oversight of Phil-IRI reading intervention endorsements, facilitator assignments, learning progress, and EOSY summer eligibility.",
};

export default function AdminAralMonitoringRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          Loading Reading Intervention…
        </div>
      }
    >
      <AdminAralMonitoringDashboard />
    </Suspense>
  );
}
