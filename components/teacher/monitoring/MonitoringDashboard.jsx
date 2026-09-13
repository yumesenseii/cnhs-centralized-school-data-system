"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassReportFilesTable from "@/components/teacher/monitoring/ClassReportFilesTable";
import ClassReportFileModal from "@/components/teacher/monitoring/ClassReportFileModal";
import InterventionDetailPanel from "@/components/teacher/monitoring/InterventionDetailPanel";
import TeacherInterventionCaseload from "@/components/teacher/monitoring/TeacherInterventionCaseload";
import { isInterventionCandidate, buildRecordedProgress } from "@/lib/monitoring/interventionLifecycle";
import { listAralAssessmentScoresForStudents } from "@/lib/supabase/queries/aralProgram";
import { cn } from "@/lib/utils";
import { useTeacherMonitoring } from "@/hooks/teacher/useMonitoring";
import {
  buildClassReportFiles,
} from "@/lib/monitoring/classReportFiles";
import {
  exportAralRecommendedExcel,
  filterAralRecommendedLearners,
} from "@/lib/reports/aralRecommendedExport";
import { formatPersonName } from "@/lib/teacher/monitoringMappers";
import { submitClassReportForHtReview } from "@/lib/supabase/queries/aralApprovals";

const DATE_FILTER = {
  ALL: "All dates",
  NEWEST: "Newest first",
  OLDEST: "Oldest first",
};

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
  } = useTeacherMonitoring();

  const [workspace, setWorkspace] = useState("caseload");
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [progressByStudent, setProgressByStudent] = useState({});
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All grades");
  const [section, setSection] = useState("All sections");
  const [dateFilter, setDateFilter] = useState(DATE_FILTER.ALL);
  const [exportingAral, setExportingAral] = useState(false);
  const [submittingFileId, setSubmittingFileId] = useState("");
  const [modalFile, setModalFile] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [metaTick, setMetaTick] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  function clearToastTimer() {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }

  function showToast({ title, message, tone = "success" }) {
    clearToastTimer();
    setToast({ title, message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  }

  function dismissToast() {
    clearToastTimer();
    setToast(null);
  }

  useEffect(() => () => clearToastTimer(), []);

  const loadProgress = useCallback(async () => {
    const ids = students
      .filter(isInterventionCandidate)
      .map((s) => s.studentId)
      .filter(Boolean);
    if (!ids.length) {
      setProgressByStudent({});
      return;
    }
    const result = await listAralAssessmentScoresForStudents(ids);
    if (result.error) return;
    const byStudent = new Map();
    for (const row of result.data ?? []) {
      const list = byStudent.get(row.studentId) ?? [];
      list.push(row);
      byStudent.set(row.studentId, list);
    }
    const next = {};
    for (const [studentId, list] of byStudent) {
      next[studentId] = buildRecordedProgress(list);
    }
    setProgressByStudent(next);
  }, [students]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

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

  const gradeOptions = useMemo(() => {
    const set = new Set(
      files
        .map((f) => (f.gradeLevel != null ? `Grade ${f.gradeLevel}` : null))
        .filter(Boolean)
    );
    return ["All grades", ...[...set].sort()];
  }, [files]);

  const sectionOptions = useMemo(() => {
    const set = new Set(files.map((f) => f.sectionName).filter(Boolean));
    return ["All sections", ...[...set].sort()];
  }, [files]);

  const filtered = useMemo(() => {
    let list = files.filter((file) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        file.fileName.toLowerCase().includes(q) ||
        String(file.uploadedBy || "")
          .toLowerCase()
          .includes(q) ||
        String(file.subject || "")
          .toLowerCase()
          .includes(q);
      const gradeLabel =
        file.gradeLevel != null ? `Grade ${file.gradeLevel}` : "";
      const matchesGrade = grade === "All grades" || gradeLabel === grade;
      const matchesSection =
        section === "All sections" || file.sectionName === section;
      return matchesSearch && matchesGrade && matchesSection;
    });

    if (dateFilter === DATE_FILTER.NEWEST) {
      list = [...list].sort((a, b) => {
        const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return tb - ta;
      });
    } else if (dateFilter === DATE_FILTER.OLDEST) {
      list = [...list].sort((a, b) => {
        const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return ta - tb;
      });
    }

    return list;
  }, [files, search, grade, section, dateFilter]);

  // Deep link: /teacher/monitoring?classId=...
  useEffect(() => {
    const classId = searchParams?.get("classId");
    if (!classId || loading) return;
    // Prefer generated list; if deep-linked after generate, refresh meta and find file
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

  // Keep open modal in sync after grade save / roster refresh
  useEffect(() => {
    if (!modalFile?.id) return;
    const next = files.find((f) => f.id === modalFile.id);
    if (next) setModalFile(next);
  }, [files, modalFile?.id]);

  const aralExportCount = useMemo(
    () => filterAralRecommendedLearners(students).length,
    [students]
  );

  async function handleExportAral() {
    if (exportingAral || !filterOptions.hasAralClass) return;
    setExportingAral(true);
    try {
      await exportAralRecommendedExcel({
        learners: students,
        schoolYear: controls.schoolYear,
        quarter: controls.quarter,
        periodLabel: controls.quarter,
        generatedBy: teacherDisplayName,
        scopeLabel: "My Eng/Fil classes",
        includeTeacherColumn: false,
      });
    } catch (err) {
      console.error(err);
      showToast({
        title: "Export failed",
        message: "Unable to export ARAL recommended list.",
        tone: "error",
      });
    } finally {
      setExportingAral(false);
    }
  }

  async function handleSubmitToHt(file) {
    setSubmittingFileId(file.id);
    try {
      const result = await submitClassReportForHtReview({
        learners: file.learners,
        schoolYear: file.schoolYear,
        quarter: file.quarterNumber,
        profileId: profile?.id ?? null,
      });
      if (result.error) {
        showToast({
          title: "Could not send",
          message: result.error.message || "Unable to send file to HT.",
          tone: "error",
        });
        return;
      }
      showToast({
        title: "Sent to HT",
        message: `Sent ${result.data.submitted} ARAL recommendation(s) from “${file.fileName}” to the Head Teacher.`,
        tone: "success",
      });
      await refresh();
      setMetaTick((n) => n + 1);
    } catch (err) {
      console.error(err);
      showToast({
        title: "Could not send",
        message: "Unable to send file to HT.",
        tone: "error",
      });
    } finally {
      setSubmittingFileId("");
    }
  }

  function openModal(file, mode) {
    setModalFile(file);
    setModalMode(mode);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium text-slate-400">
                  <Link href="/teacher/dashboard" className="hover:text-slate-600">
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
                  {controls.schoolYear} · {controls.quarter}
                  {" · "}
                  {teacherDisplayName}
                </p>
              </div>

              <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
                {(close) => <TeacherSidebar mobile onNavigate={close} />}
              </MobileNavSheet>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filterOptions.hasAralClass ? (
              <button
                type="button"
                onClick={handleExportAral}
                disabled={loading || exportingAral}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-cnhs-green-dark transition-colors hover:bg-emerald-100 disabled:opacity-60"
              >
                {exportingAral ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={13} />
                )}
                Export ARAL
                {aralExportCount > 0 ? (
                  <span className="rounded-full bg-white/80 px-1.5 text-[10px] font-bold">
                    {aralExportCount}
                  </span>
                ) : null}
              </button>
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
              Refresh
            </button>
            <Link
              href="/teacher/my-classes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Generate
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div
        role="tablist"
        className="mb-3 flex flex-wrap gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-1"
      >
        {[
          { id: "caseload", label: "Intervention caseload" },
          { id: "files", label: "Class reports" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={workspace === item.id}
            onClick={() => setWorkspace(item.id)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-[11px] font-semibold",
              workspace === item.id
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:bg-white/70"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && files.length === 0 && classSummaries.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading academic monitoring…
        </div>
      ) : workspace === "caseload" ? (
        <TeacherInterventionCaseload
          students={students}
          progressByStudent={progressByStudent}
          onOpen={setSelectedLearner}
          teacherName={teacherDisplayName}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search files</span>
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files by name or uploader..."
                className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
              />
            </label>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                aria-label="Filter by section"
                className="h-9 min-w-[8.5rem] cursor-pointer rounded-full border border-slate-200 bg-white px-3 pr-7 text-[11px] font-semibold text-slate-600 outline-none focus:border-cnhs-green"
              >
                {sectionOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>

              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                aria-label="Filter by grade level"
                className="h-9 min-w-[8rem] cursor-pointer rounded-full border border-slate-200 bg-white px-3 pr-7 text-[11px] font-semibold text-slate-600 outline-none focus:border-cnhs-green"
              >
                {gradeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "All grades" ? "Grade lvl" : opt}
                  </option>
                ))}
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Sort by date"
                className="h-9 min-w-[8.5rem] cursor-pointer rounded-full border border-slate-200 bg-white px-3 pr-7 text-[11px] font-semibold text-slate-600 outline-none focus:border-cnhs-green"
              >
                <option value={DATE_FILTER.ALL}>Date</option>
                <option value={DATE_FILTER.NEWEST}>Newest first</option>
                <option value={DATE_FILTER.OLDEST}>Oldest first</option>
              </select>
            </div>
          </div>

          <ClassReportFilesTable
            files={filtered}
            emptyMessage={
              files.length === 0
                ? "No class reports yet. Generate a report from My Classes to create a class file here."
                : "No generated reports match your filters."
            }
            onView={(f) => openModal(f, "view")}
            onEdit={(f) => openModal(f, "edit")}
            onSubmitToHt={handleSubmitToHt}
            submittingFileId={submittingFileId}
            showHtActions={Boolean(filterOptions.hasAralClass)}
          />
        </>
      )}

      {selectedLearner ? (
        <InterventionDetailPanel
          learner={selectedLearner}
          canWrite={Boolean(teacherId)}
          teacherId={teacherId}
          onClose={() => setSelectedLearner(null)}
          onSaved={async () => {
            await refresh();
            await loadProgress();
          }}
        />
      ) : null}

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
          onSubmitToHt={handleSubmitToHt}
          submitting={submittingFileId === modalFile.id}
          teacherId={teacherId}
          onSaved={async () => {
            await refresh();
          }}
          showHtActions={Boolean(filterOptions.hasAralClass)}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className={
            toast.tone === "error"
              ? "fixed top-5 right-5 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg"
              : "fixed top-5 right-5 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-lg"
          }
        >
          <div className="min-w-0 flex-1">
            <p
              className={
                toast.tone === "error"
                  ? "text-[12px] font-semibold text-red-800"
                  : "text-[12px] font-semibold text-cnhs-green-dark"
              }
            >
              {toast.title}
            </p>
            <p
              className={
                toast.tone === "error"
                  ? "mt-0.5 text-[11px] leading-snug text-red-700"
                  : "mt-0.5 text-[11px] leading-snug text-emerald-900/80"
              }
            >
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissToast}
            className={
              toast.tone === "error"
                ? "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-red-500 hover:bg-red-100"
                : "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-cnhs-green-dark/70 hover:bg-green-100"
            }
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}
