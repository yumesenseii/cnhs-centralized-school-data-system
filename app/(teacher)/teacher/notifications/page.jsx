import TeacherNotificationsDashboard from "@/components/teacher/notifications/TeacherNotificationsDashboard";

export const metadata = {
  title: "Notifications | CNHS Teacher Portal",
  description:
    "Personal action items from lesson plan reviews, class assignments, learner recommendations, monitoring, and E-Class Record imports.",
};

export default function TeacherNotificationsPage() {
  return <TeacherNotificationsDashboard />;
}
