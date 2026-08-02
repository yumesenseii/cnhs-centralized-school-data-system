"use client";

import StudentProfile from "@/components/teacher/my-classes/StudentProfile";
import { use } from "react";

export default function StudentProfilePage({ params }) {
  const { classId, studentId } = use(params);
  return <StudentProfile classId={classId} studentId={studentId} />;
}
