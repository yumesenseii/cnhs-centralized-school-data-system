"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Layers3 } from "lucide-react";
import SubmissionSuccess from "@/components/teacher/lesson-plans/SubmissionSuccess";
import UploadShell from "@/components/teacher/lesson-plans/UploadShell";
import { useLessonPlanUpload } from "@/components/teacher/lesson-plans/useLessonPlanUpload";
import { lessonPlansData } from "@/data/teacher/lessonPlans";

export default function SuccessLessonPlanFlow() {
  const router = useRouter();
  const { state, hydrated, clearUpload } = useLessonPlanUpload();

  useEffect(() => {
    if (!hydrated) return;
    if (!state.submittedAt) {
      router.replace("/teacher/lesson-plans/upload");
    }
  }, [hydrated, state.submittedAt, router]);

  function handleUploadAnother() {
    clearUpload();
    router.push("/teacher/lesson-plans/upload");
  }

  if (!hydrated || !state.submittedAt) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading submission status...
      </div>
    );
  }

  return (
    <UploadShell
      breadcrumbLabel="Submitted"
      title="Submission Complete"
      showBackLink={false}
      controls={
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
            <CalendarDays size={12} className="text-slate-400" />
            {lessonPlansData.controls.schoolYear}
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
            <Layers3 size={12} className="text-slate-400" />
            {lessonPlansData.controls.quarter}
          </span>
        </div>
      }
    >
      <SubmissionSuccess
        trackingNumber={state.trackingNumber}
        submittedAt={state.submittedAt}
        status={state.status || "Pending Review"}
        timeline={state.timeline}
        onUploadAnother={handleUploadAnother}
      />
    </UploadShell>
  );
}
