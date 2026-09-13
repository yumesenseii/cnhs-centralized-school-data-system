import AdminAttendancePage from "@/components/admin/attendance/AdminAttendancePage";

export const metadata = {
  title: "Attendance Monitoring | CNHS Learn",
  description:
    "School-wide Morning and Afternoon attendance from daily records. Independent from academic prediction.",
};

export default function Page() {
  return <AdminAttendancePage />;
}
