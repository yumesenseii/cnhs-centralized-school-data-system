"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassReportFileModal from "@/components/teacher/monitoring/ClassReportFileModal";
import ClassRemedialsSection from "@/components/teacher/monitoring/ClassRemedialsSection";
import StudentMonitoringSidePanel from "@/components/teacher/monitoring/StudentMonitoringSidePanel";
import { useTeacherMonitoring } from "@/hooks/teacher/useMonitoring";
import { buildClassReportFiles } from "@/lib/monitoring/classReportFiles";
import { formatPersonName } from "@/lib/teacher/monitoringMappers";
import PageHelp from "@/components/shared/PageHelp";
import { useAppToast } from "@/components/shared/AppToast";

export default function MonitoringDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    students,
    classSummaries,
    filterOptions,
    controls,
    teacher,
    profile,
    teacherId,
    loading,
    refreshing,
    error,
    refresh,
    applyLocalStudentPatches,
  } = useTeacherMonitoring();

  const [selectedLearner, setSelectedLearner] = useState(null);
  const [modalFile, setModalFile] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [metaTick, setMetaTick] = useState(0);
  const { showToast } = useAppToast();

  const teacherDisplayName = useMemo(() => {
    const named = formatPersonName(teacher);
    if (named && named !== "—") return named;
    return profile?.email || "Teacher";
  }, [teacher, profile]);

  const files = useMemo(() => {
    void metaTick;
    return buildClassReportFiles({
      students,
      classSummaries,
      teacherName: teacherDisplayName,
      onlyGenerated: true,
    });
  }, [students, classSummaries, teacherDisplayName, metaTick]);

  // Deep link support: /teacher/monitoring?classId=...
  useEffect(() => {
    const classId = searchParams?.get("classId");
    if (!classId || loading) return;
    const all = buildClassReportFiles({
      students,
      classSummaries,
      teacherName: teacherDisplayName,
      onlyGenerated: true,
    });
    const hit = all.find((f) => f.classId === classId);
    if (hit) {
      setModalFile(hit);
      setModalMode("view");
      setMetaTick((n) => n + 1);
    }
  }, [searchParams, loading, students, classSummaries, teacherDisplayName]);

  // Keep open file modal in sync after grade save
  useEffect(() => {
    if (!modalFile?.id) return;
    const next = files.find((f) => f.id === modalFile.id);
    if (next) setModalFile(next);
  }, [files, modalFile?.id]);

  // Count official candidates for ARAL badge link
  const aralCandidatesCount = useMemo(() => {
    return students.filter(
      (s) =>
        /english|filipino/i.test(s.subject || "") &&
        s.interventionStatus === "ARAL Candidate"
    ).length;
  }, [students]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-6"
    >
      {/* Page Header */}
      <header className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-slate-400">
                  <Link href="/teacher/dashboard" className="hover:text-slate-600 transition-colors">
                    Home
                  </Link>
                  <span className="text-slate-300"> &gt; </span>
                  <span className="font-semibold text-slate-600">
                    Academic Monitoring
                  </span>
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px]">
                  Academic Monitoring
                </h1>
                <p className="mt-1 text-[13px] text-slate-500">
                  Track learner performance, assessment evidence, identified learning needs, and connected interventions.
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {controls.schoolYear} · {controls.quarter} · {teacherDisplayName}
                </p>
              </div>

              <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
                {(close) => <TeacherSidebar mobile onNavigate={close} />}
              </MobileNavSheet>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <PageHelp
              summary="Centralized learner academic monitoring: Student Performance → Assessment Evidence → Identified Learning Need → Recommended Intervention."
              steps={[
                "Academic records are automatically synced from official E-Records and subject classes.",
                "Phil-IRI screening results provide secondary diagnostic reading evidence.",
                "Identified academic difficulties connect directly to Class Remedial recommendations.",
                "Reading intervention screening connects eligible candidates to ARAL Monitoring.",
                "Click on any learner to open their formal document-style Learner Profile and PLP direction.",
                "AI Pattern Recognition provides secondary academic evidence without overriding official DepEd assessment rules.",
              ]}
            />

            {filterOptions.hasAralClass ? (
              <Link
                href="/teacher/aral-monitoring"
                title="Open dedicated ARAL Monitoring workspace for reading interventions"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[12px] font-semibold text-blue-800 transition-colors hover:bg-blue-100"
              >
                <GraduationCap size={14} />
                <span>ARAL Monitoring</span>
                {aralCandidatesCount > 0 ? (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-900 border border-blue-200">
                    {aralCandidatesCount}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <Link
              href="/teacher/my-classes"
              title="Open My Classes to enter or import grades"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <FileText size={13} />
              <span>My Classes</span>
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {/* Main Content Area: Uncrowded, Focused Academic Monitoring */}
      {loading && students.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-16 text-sm text-slate-500 shadow-sm">
          <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
          <span>Loading academic monitoring…</span>
        </div>
      ) : (
        <ClassRemedialsSection
          students={students}
          currentQuarterNumber={controls.quarterNumber || 1}
          onViewLearner={setSelectedLearner}
          onNavigateToAral={(learner) => {
            router.push(`/teacher/aral-monitoring?studentId=${learner.studentId || learner.id}`);
          }}
        />
      )}

      {/* Continuous Learner Profile Side Panel */}
      <StudentMonitoringSidePanel
        learner={selectedLearner}
        isOpen={Boolean(selectedLearner)}
        onClose={() => setSelectedLearner(null)}
        onRefresh={refresh}
        onNavigateToAral={(learner) => {
          setSelectedLearner(null);
          router.push(`/teacher/aral-monitoring?studentId=${learner.studentId || learner.id}`);
        }}
        isLanguageTeacher={Boolean(filterOptions.hasAralClass)}
        currentQuarterNumber={controls.quarterNumber || 1}
      />

      {/* Class Report File Modal (from deep-links / My Classes integration) */}
      {modalFile ? (
        <ClassReportFileModal
          file={modalFile}
          mode={modalMode}
          onModeChange={setModalMode}
          onClose={() => {
            setModalFile(null);
            setModalMode("view");
            if (searchParams?.get("classId")) {
              router.replace("/teacher/monitoring");
            }
          }}
          teacherId={teacherId}
          onSaved={async (payload) => {
            await applyLocalStudentPatches(payload);
          }}
          showHtActions={Boolean(filterOptions.hasAralClass)}
        />
      ) : null}
    </motion.div>
  );
}
