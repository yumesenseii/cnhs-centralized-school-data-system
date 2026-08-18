import { Suspense } from "react";
import SuccessLessonPlanFlow from "@/components/teacher/lesson-plans/SuccessLessonPlanFlow";

export const metadata = {
  title: "Submission Complete | CNHS Learn",
  description: "Lesson plan successfully submitted for Head Teacher review.",
};

export default function LessonPlanSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading submission status...
        </div>
      }
    >
      <SuccessLessonPlanFlow />
    </Suspense>
  );
}
