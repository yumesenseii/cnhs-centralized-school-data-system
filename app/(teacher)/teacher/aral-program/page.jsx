import { Suspense } from "react";
import TeacherAralMonitoringPage from "@/components/teacher/aral-program/TeacherAralMonitoringPage";

export const metadata = {
  title: "ARAL Monitoring | CNHS Learn",
  description:
    "Specialized reading intervention monitoring, Phil-IRI diagnostic evidence, and milestone tracking.",
};

export default function AralProgramRoute() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading ARAL Monitoring…
        </div>
      }
    >
      <TeacherAralMonitoringPage />
    </Suspense>
  );
}
