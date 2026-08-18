import { Suspense } from "react";
import UploadLessonPlanFlow from "@/components/teacher/lesson-plans/UploadLessonPlanFlow";

export const metadata = {
  title: "Upload Lesson Plan | CNHS Learn",
  description: "Submit a lesson plan for Head Teacher review.",
};

export default function UploadLessonPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading upload form...
        </div>
      }
    >
      <UploadLessonPlanFlow />
    </Suspense>
  );
}
