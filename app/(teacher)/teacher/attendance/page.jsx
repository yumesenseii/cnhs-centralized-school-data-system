import TeacherAttendancePage from "@/components/teacher/attendance/TeacherAttendancePage";

export const metadata = {
  title: "Attendance Monitoring | CNHS Learn",
  description:
    "Record Morning and Afternoon attendance. Totals come from daily records.",
};

export default function Page() {
  return <TeacherAttendancePage />;
}
