"use client";

import EcrRecordPage from "@/components/teacher/e-record/EcrRecordPage";
import { use } from "react";

export default function TeacherEcrRoute({ params }) {
  const { classId } = use(params);
  return <EcrRecordPage classId={classId} />;
}
