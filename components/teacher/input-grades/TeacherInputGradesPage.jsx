"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import InputGradesConfirmClassStep from "@/components/teacher/input-grades/InputGradesConfirmClassStep";
import InputGradesPreviewStep from "@/components/teacher/input-grades/InputGradesPreviewStep";
import InputGradesShell from "@/components/teacher/input-grades/InputGradesShell";
import InputGradesUploadStep from "@/components/teacher/input-grades/InputGradesUploadStep";
import { useTeacherClasses } from "@/hooks/teacher/useMyClasses";
import { findBestMatchingClass } from "@/lib/eclass/matchAssignedClass";

const INITIAL = {
  step: 1,
  file: null,
  arrayBuffer: null,
  fileMeta: null,
  metadata: null,
  learnerCount: 0,
  selectedClassId: "",
  importResult: null,
};

export default function TeacherInputGradesPage() {
  const { classes, teacherId, loading, error, refresh } = useTeacherClasses();
  const [state, setState] = useState(INITIAL);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === state.selectedClassId) ?? null,
    [classes, state.selectedClassId]
  );

  useEffect(() => {
    if (!state.metadata || state.selectedClassId || !classes.length) return;
    const match = findBestMatchingClass(classes, state.metadata);
    if (match) {
      setState((prev) => ({ ...prev, selectedClassId: match.id }));
    }
  }, [classes, state.metadata, state.selectedClassId]);

  function resetFlow() {
    setState(INITIAL);
  }

  function handleParsed({ file, fileMeta, metadata, learnerCount, arrayBuffer }) {
    const match = findBestMatchingClass(classes, metadata);
    setState((prev) => ({
      ...prev,
      file,
      arrayBuffer: arrayBuffer ?? null,
      fileMeta,
      metadata,
      learnerCount,
      selectedClassId: match?.id || "",
      importResult: null,
    }));
  }

  function handleClearFile() {
    setState((prev) => ({
      ...prev,
      step: 1,
      file: null,
      arrayBuffer: null,
      fileMeta: null,
      metadata: null,
      learnerCount: 0,
      selectedClassId: "",
      importResult: null,
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="mb-2 flex justify-end lg:hidden">
        <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
          {(close) => <TeacherSidebar mobile onNavigate={close} />}
        </MobileNavSheet>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {state.importResult ? (
        <InputGradesShell
          currentStep={3}
          selectedClass={selectedClass}
          subtitle="E-Class Record imported successfully."
        >
          <section className="rounded-xl border border-green-100 bg-white p-5 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-cnhs-green-dark">
              <CheckCircle2 size={24} />
            </span>
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              Import complete
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              Imported {state.importResult.imported ?? 0} learner
              {(state.importResult.imported ?? 0) === 1 ? "" : "s"}
              {state.importResult.gradesUpserted
                ? ` and ${state.importResult.gradesUpserted} grade record${
                    state.importResult.gradesUpserted === 1 ? "" : "s"
                  }`
                : ""}
              .
            </p>
            <button
              type="button"
              onClick={resetFlow}
              className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
            >
              Upload another ECR
            </button>
          </section>
        </InputGradesShell>
      ) : (
        <InputGradesShell
          currentStep={state.step}
          selectedClass={selectedClass}
          subtitle={
            state.step === 1
              ? "Upload the Official DepEd E-Class Record first. Grade and section are read from the file."
              : state.step === 2
                ? "Confirm the assigned class using the dropdown."
                : "Review details, then import learners and grades."
          }
        >
          {state.step === 1 ? (
            <InputGradesUploadStep
              file={state.file}
              fileMeta={state.fileMeta}
              onParsed={handleParsed}
              onClear={handleClearFile}
              onContinue={() =>
                setState((prev) => ({ ...prev, step: 2 }))
              }
            />
          ) : null}

          {state.step === 2 ? (
            <InputGradesConfirmClassStep
              metadata={state.metadata}
              learnerCount={state.learnerCount}
              classes={classes}
              selectedClass={selectedClass}
              loadingClasses={loading}
              onClassChange={(classId) =>
                setState((prev) => ({ ...prev, selectedClassId: classId }))
              }
              onBack={() => setState((prev) => ({ ...prev, step: 1 }))}
              onContinue={() =>
                setState((prev) => ({ ...prev, step: 3 }))
              }
            />
          ) : null}

          {state.step === 3 ? (
            <InputGradesPreviewStep
              file={state.file}
              arrayBuffer={state.arrayBuffer}
              fileMeta={state.fileMeta}
              metadata={state.metadata}
              learnerCount={state.learnerCount}
              selectedClass={selectedClass}
              teacherId={teacherId}
              onBack={() => setState((prev) => ({ ...prev, step: 2 }))}
              onSuccess={async (result) => {
                setState((prev) => ({
                  ...prev,
                  importResult: result,
                }));
                await refresh?.();
              }}
            />
          ) : null}
        </InputGradesShell>
      )}
    </motion.div>
  );
}
