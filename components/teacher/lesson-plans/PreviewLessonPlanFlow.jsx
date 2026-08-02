"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Layers3 } from "lucide-react";
import PreviewSubmission from "@/components/teacher/lesson-plans/PreviewSubmission";
import UploadShell from "@/components/teacher/lesson-plans/UploadShell";
import { useLessonPlanUpload } from "@/components/teacher/lesson-plans/useLessonPlanUpload";

export default function PreviewLessonPlanFlow() {
  const router = useRouter();
  const {
    state,
    hydrated,
    ready,
    update,
    submitLessonPlan,
    selectedClass,
    submitting,
    submitError,
  } = useLessonPlanUpload();

  useEffect(() => {
    if (!hydrated) return;
    if (!state.information.lessonTitle || !state.file) {
      router.replace("/teacher/lesson-plans/upload");
      return;
    }
    if (state.step !== 3) update({ step: 3 });
  }, [
    hydrated,
    state.information.lessonTitle,
    state.file,
    state.step,
    router,
    update,
  ]);

  useEffect(() => {
    if (!ready || selectedClass) return;
    router.replace("/teacher/lesson-plans/upload");
  }, [ready, selectedClass, router]);

  if (!ready || !selectedClass) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading preview...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <UploadShell
        currentStep={3}
        selectedClass={selectedClass}
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
              <CalendarDays size={12} className="text-slate-400" />
              {selectedClass?.schoolYear}
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
              <Layers3 size={12} className="text-slate-400" />
              {selectedClass?.quarter}
            </span>
          </div>
        }
      >
        <PreviewSubmission
          selectedClass={selectedClass}
          information={state.information}
          file={state.file}
          submitting={submitting}
          submitError={submitError}
          onSubmit={submitLessonPlan}
          onBack={() => {
            update({ step: 2 });
            router.push("/teacher/lesson-plans/upload");
          }}
        />
      </UploadShell>
    </motion.div>
  );
}
