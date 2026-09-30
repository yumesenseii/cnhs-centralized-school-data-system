"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Layers3 } from "lucide-react";
import LessonInformationForm from "@/components/teacher/lesson-plans/LessonInformationForm";
import UploadLessonFile from "@/components/teacher/lesson-plans/UploadLessonFile";
import UploadShell from "@/components/teacher/lesson-plans/UploadShell";
import { useLessonPlanUpload } from "@/components/teacher/lesson-plans/useLessonPlanUpload";
import { lessonPlansData } from "@/data/teacher/lessonPlans";

export default function UploadLessonPlanFlow() {
  const {
    state,
    hydrated,
    update,
    updateInformation,
    setFile,
    selectedClass,
    classes,
    setSelectedClassId,
    loadingClasses,
    classError,
  } = useLessonPlanUpload();
  const step = state.step <= 1 ? 1 : 2;

  useEffect(() => {
    if (!hydrated) return;
    if (state.step > 2) {
      update({ step: 2 });
    }
  }, [hydrated, state.step, update]);

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading upload form...
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
        currentStep={step}
        selectedClass={selectedClass}
        subtitle={
          step === 1
            ? "Submit a lesson plan for Principal review."
            : undefined
        }
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
              <CalendarDays size={12} className="text-slate-400" />
              {selectedClass?.schoolYear || lessonPlansData.controls.schoolYear}
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
              <Layers3 size={12} className="text-slate-400" />
              {selectedClass?.quarter || lessonPlansData.controls.quarter}
            </span>
          </div>
        }
      >
        {step === 1 ? (
          <LessonInformationForm
            selectedClass={selectedClass}
            classes={classes}
            information={state.information}
            onChange={updateInformation}
            onClassChange={setSelectedClassId}
            loadingClasses={loadingClasses}
            classError={classError}
            onContinue={() => update({ step: 2 })}
          />
        ) : (
          <UploadLessonFile
            file={state.file}
            onFileChange={setFile}
            onBack={() => update({ step: 1 })}
            onPreview={() => update({ step: 3 })}
          />
        )}
      </UploadShell>
    </motion.div>
  );
}
