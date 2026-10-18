import { Suspense } from "react";
import TeacherAralMonitoringPage from "@/components/teacher/aral-program/TeacherAralMonitoringPage";

export const metadata = {
  title: "ARAL Reading Assessment | CNHS Learn",
  description:
    "DepEd Phil-IRI reading assessment for assigned English and Filipino classes.",
};

export default function AralMonitoringRoute() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading ARAL Reading Assessment…
        </div>
      }
    >
      <TeacherAralMonitoringPage />
    </Suspense>
  );
}
