"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  Loader2,
  Users,
} from "lucide-react";
import AralClassDropdown from "@/components/teacher/aral-program/AralClassDropdown";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AralLearnerRecordModal from "@/components/teacher/monitoring/AralLearnerRecordModal";
import AralAssessmentFlowModal from "@/components/teacher/monitoring/AralAssessmentFlowModal";
import AralClassGstSpreadsheet from "@/components/teacher/aral-program/AralClassGstSpreadsheet";
import PageHelp from "@/components/shared/PageHelp";
import { useTeacherMonitoring } from "@/hooks/teacher/useMonitoring";
import ExportAralReportModal from "@/components/aral/ExportAralReportModal";
import {
  exportAralRecommendedExcel,
} from "@/lib/reports/aralRecommendedExport";
import { useAppToast } from "@/components/shared/AppToast";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { formatGradeSection, cleanGradeNumber } from "@/lib/monitoring/philIriEvaluation";
import {
  aggregateAralLearners,
} from "@/lib/monitoring/aralLearnerAggregation";
import {
  normalizeTerm,
  filterActiveLearnersForTerm,
} from "@/lib/monitoring/aralProgression";

export default function TeacherAralMonitoringPage() {
  const searchParams = useSearchParams();
  const {
    students,
    controls,
    teacherId,
    loading,
    error,
    refresh,
  } = useTeacherMonitoring();

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [selectedAssessmentLearner, setSelectedAssessmentLearner] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingAral, setExportingAral] = useState(false);
  const { showToast } = useAppToast();
  const { period: aralPeriod } = useAralAssessmentPeriod();

  const effectivePeriod = normalizeTerm(aralPeriod);

  // Deep-link learner selection: ?studentId=...
  useEffect(() => {
    const studentId = searchParams?.get("studentId");
    if (!studentId || loading || !students.length) return;
    const hit = students.find(
      (s) => s.studentId === studentId || s.id === studentId
    );
    if (hit) {
      setSelectedLearner(hit);
    }
  }, [searchParams, loading, students]);

  // 1. Authoritative aggregation of teacher's language learners
  const languageLearners = useMemo(() => {
    return aggregateAralLearners(students, {
      currentTeacherId: teacherId,
      schoolYear: controls.schoolYear,
    });
  }, [students, teacherId, controls.schoolYear]);

  // 2. Group language learners into assigned language classes
  const assignedClassesData = useMemo(() => {
    const classMap = new Map();

    for (const l of languageLearners) {
      const cleanG = cleanGradeNumber(l.grade);
      const cleanS = String(l.section || "").trim();
      const lang = l.language || "English";
      const key = `${cleanG}_${cleanS.toLowerCase()}_${lang.toLowerCase()}`;

      if (!classMap.has(key)) {
        classMap.set(key, {
          classId: key,
          rawClassId: l.classId || key,
          key,
          subject: l.subject || `${lang} ${cleanG}`,
          language: lang,
          grade: cleanG,
          section: cleanS,
          gradeSection: formatGradeSection(cleanG, cleanS),
          schoolYear: l.schoolYear || controls.schoolYear,
          learners: [],
        });
      }
      classMap.get(key).learners.push(l);
    }

    const classesArray = Array.from(classMap.values()).map((c) => ({
      ...c,
      total: c.learners.length,
    }));

    return {
      all: classesArray,
      english: classesArray.filter((c) => c.language === "English"),
      filipino: classesArray.filter((c) => c.language === "Filipino"),
    };
  }, [languageLearners, controls.schoolYear]);

  // Auto-select first class if none selected or if previous selection is invalid
  useEffect(() => {
    if (assignedClassesData.all.length > 0) {
      const exists = assignedClassesData.all.some(
        (c) => c.classId === selectedClassId || c.key === selectedClassId
      );
      if (!selectedClassId || !exists) {
        setSelectedClassId(assignedClassesData.all[0].classId);
      }
    }
  }, [assignedClassesData, selectedClassId]);

  // Active selected class object
  const selectedClass = useMemo(() => {
    if (!selectedClassId) return null;
    return (
      assignedClassesData.all.find(
        (c) => c.classId === selectedClassId || c.key === selectedClassId
      ) || null
    );
  }, [assignedClassesData, selectedClassId]);

  // Active learners filtered for the current term progression
  // Term 1 (BOSY): All enrolled learners in class
  // Term 2 (MOSY): Only learners continuing after Term 1 (excluding Term 1 PASS)
  // Term 3 (EOSY): Only learners continuing after Term 2 (excluding Term 1/2 PASS)
  const activeClassLearners = useMemo(() => {
    if (!selectedClass) return [];
    return filterActiveLearnersForTerm(selectedClass.learners, effectivePeriod);
  }, [selectedClass, effectivePeriod]);

  // Assessment period display string
  const periodDisplay = useMemo(() => {
    if (effectivePeriod === "MOSY") return "Midyear Assessment (MOSY)";
    if (effectivePeriod === "EOSY") return "End-of-Year Assessment (EOSY)";
    return "Beginning Assessment (BOSY)";
  }, [effectivePeriod]);

  // Export summary handler
  async function handleExportAssessmentSummary() {
    if (languageLearners.length === 0) {
      showToast("No reading assessment data available to export.");
      return;
    }
    setExportingAral(true);
    try {
      await exportAralRecommendedExcel(languageLearners, {
        schoolYear: controls.schoolYear || "SY 2026-2027",
        teacherName: "Assigned Subject Teacher",
        quarter: controls.quarter || 1,
      });
      showToast("Reading assessment summary exported successfully.");
    } catch (err) {
      console.error(err);
      showToast("Unable to export reading assessment summary.");
    } finally {
      setExportingAral(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-8"
    >
      {/* 1. HEADER */}
      <header className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400">
                  <Link
                    href="/teacher/dashboard"
                    className="hover:text-slate-600 transition-colors"
                  >
                    Home
                  </Link>
                  <span className="text-slate-300"> &gt; </span>
                  <span className="font-semibold text-slate-600">
                    ARAL Reading Assessment
                  </span>
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px] dark:text-white">
                    ARAL Reading Assessment
                  </h1>
                </div>

                <p className="mt-0.5 text-xs font-semibold text-[#246f54] dark:text-emerald-400">
                  {periodDisplay} · {controls.schoolYear || "SY 2026–2027"}
                </p>
              </div>

              <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
                {(close) => <TeacherSidebar mobile onNavigate={close} />}
              </MobileNavSheet>
            </div>
          </div>

          {/* Secondary Actions: Export & Help */}
          <div className="flex items-center gap-2 shrink-0 sm:self-start">
            <PageHelp
              triggerLabel="Help"
              title="ARAL Reading Assessment Guide"
              summary="ARAL Reading Assessment: Class-based GST entry and monitoring."
              steps={[
                "Select Class: Choose your assigned English or Filipino class from the dropdown.",
                "Encode Scores: Type GST scores (0–40) and press Enter to move down, or paste a column from Excel.",
                "Mark Absent: Check the Absent box to record an absence with score null (does not fail the learner).",
                "Review & Save: Click Review Results to check tallies, then Save All Results to commit.",
                "Learner History: Click any learner's name to view their multi-term reading history.",
                "Continue Reading Assessment: Learners scoring below 28 receive a button to start Form 3.",
              ]}
              className="h-8.5 rounded-lg border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            />

            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              disabled={loading || languageLearners.length === 0}
              title="Export reading assessment and Phil-IRI reports."
              className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
            >
              <FileSpreadsheet size={13} className="text-[#246f54]" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {/* LOADING OR EMPTY STATE */}
      {loading && languageLearners.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-16 text-sm text-slate-500 shadow-2xs dark:border-white/10 dark:bg-slate-900">
          <Loader2 size={16} className="animate-spin text-[#246f54]" />
          <span>Loading assigned reading assessment classes…</span>
        </div>
      ) : assignedClassesData.all.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-900">
          <Users size={32} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            No assigned English or Filipino classes found.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            GST reading assessments are administered by assigned language subject teachers.
          </p>
        </div>
      ) : selectedClass ? (
        /* CLASS WORKSPACE (FAST GST SPREADSHEET) */
        <AralClassGstSpreadsheet
          key={`${selectedClass.key || selectedClass.classId}_${controls.schoolYear}_${effectivePeriod}`}
          classInfo={selectedClass}
          classes={assignedClassesData.all}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          learners={activeClassLearners}
          teacherId={teacherId}
          schoolYear={controls.schoolYear}
          quarter={controls.quarter}
          aralPeriod={effectivePeriod}
          onRefresh={refresh}
          onOpenIra={(l) => setSelectedAssessmentLearner(l)}
          onOpenRecord={(l) => setSelectedLearner(l)}
        />
      ) : null}

      {/* 5. FOCUSED 5-PART LEARNER RECORD MODAL */}
      <AralLearnerRecordModal
        learner={selectedLearner}
        isOpen={Boolean(selectedLearner)}
        onClose={() => setSelectedLearner(null)}
        teacherId={teacherId}
        schoolYear={controls.schoolYear}
        onOpenAssessment={(l) => {
          setSelectedAssessmentLearner(l);
          setSelectedLearner(null);
        }}
        onRefresh={refresh}
      />

      {/* 6. FORM 3 IRA ASSESSMENT FLOW MODAL */}
      <AralAssessmentFlowModal
        learner={selectedAssessmentLearner}
        isOpen={Boolean(selectedAssessmentLearner)}
        onClose={() => setSelectedAssessmentLearner(null)}
        teacherId={teacherId}
        schoolYear={controls.schoolYear}
        quarter={controls.quarter}
        aralPeriod={effectivePeriod}
        onSuccess={refresh}
      />

      {/* 7. EXPORT READING ASSESSMENT MODAL */}
      <ExportAralReportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        schoolYear={controls.schoolYear || "SY 2026-2027"}
        period={effectivePeriod}
        language={selectedClass?.language || "English"}
        scopeLabel={
          selectedClass
            ? `${selectedClass.subject} · ${selectedClass.gradeSection}`
            : "Assigned Reading Classes"
        }
        learners={
          activeClassLearners.length > 0 ? activeClassLearners : languageLearners
        }
        teacherName={controls.teacherName || "Assigned Subject Teacher"}
        initialReportType="assessment_summary"
        allowFormSelection={true}
      />
    </motion.div>
  );
}
