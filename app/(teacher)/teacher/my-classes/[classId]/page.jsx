"use client";

import ClassOverview from "@/components/teacher/my-classes/ClassOverview";
import { use } from "react";

export default function ClassOverviewPage({ params }) {
  const { classId } = use(params);
  return <ClassOverview classId={classId} />;
}
