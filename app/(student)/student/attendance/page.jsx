import StudentAttendancePage from "@/components/student/attendance/StudentAttendancePage";

export const metadata = {
  title: "My Attendance | CNHS Learn",
  description: "View your school attendance summary and monthly SF2 records.",
};

export default function Page() {
  return <StudentAttendancePage />;
}
