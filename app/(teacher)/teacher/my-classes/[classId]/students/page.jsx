"use client";

import StudentTable from "@/components/teacher/my-classes/StudentTable";
import { use } from "react";

export default function ClassStudentsPage({ params }) {
  const { classId } = use(params);
  return <StudentTable classId={classId} />;
}
