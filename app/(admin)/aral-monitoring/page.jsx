import { Suspense } from "react";
import AdminAralMonitoringDashboard from "@/components/admin/monitoring/AdminAralMonitoringDashboard";

export const metadata = {
  title: "ARAL Reading Assessment | CNHS Learn",
  description:
    "Principal oversight of Phil-IRI reading assessment progress, term outcomes, and end-of-year review.",
};

export default function AdminAralMonitoringRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          Loading ARAL Reading Assessment…
        </div>
      }
    >
      <AdminAralMonitoringDashboard />
    </Suspense>
  );
}
