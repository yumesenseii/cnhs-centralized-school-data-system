import { Suspense } from "react";
import PreviewLessonPlanFlow from "@/components/teacher/lesson-plans/PreviewLessonPlanFlow";

export const metadata = {
  title: "Preview Lesson Plan | CNHS Teacher Portal",
  description: "Review and submit your lesson plan to the Head Teacher.",
};

export default function PreviewLessonPlanPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading preview...
        </div>
      }
    >
      <PreviewLessonPlanFlow />
    </Suspense>
  );
}
