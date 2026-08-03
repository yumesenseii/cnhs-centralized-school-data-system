import MonitoringDashboard from "@/components/teacher/monitoring/MonitoringDashboard";

export const metadata = {
  title: "Academic Monitoring | CNHS Teacher Portal",
  description:
    "Monitor flagged learners, conduct classroom remediation, and submit observations to the Head Teacher.",
};

export default function TeacherMonitoringPage() {
  return <MonitoringDashboard />;
}
