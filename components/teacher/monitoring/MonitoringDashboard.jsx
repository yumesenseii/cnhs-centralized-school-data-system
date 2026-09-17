"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
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
import PageHelp from "@/components/shared/PageHelp";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import { useAppToast } from "@/components/shared/AppToast";

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
    applyLocalStudentPatches,
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
  const { showToast } = useAppToast();

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
      showToast("Unable to export ARAL recommended list.");
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
        showToast(result.error.message || "Unable to send file to HT.");
        return;
      }
      showToast(
        `Sent ${result.data.submitted} ARAL recommendation(s) from “${file.fileName}” to the Head Teacher.`
      );
      await refresh();
      setMetaTick((n) => n + 1);
    } catch (err) {
      console.error(err);
      showToast("Unable to send file to HT.");
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
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

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <PageHelp
              summary="Track recommendations and recorded intervention progress for your classes."
              steps={[
                "Review Intervention and open a learner for details.",
                "Record progress and evaluation without overwriting Weekly ARAL remarks.",
                "Use Class reports to prepare or submit files for Head Teacher review.",
                "Generate new report files from My Classes.",
                "Attendance is separate — it does not drive academic risk.",
              ]}
            />
            {filterOptions.hasAralClass ? (
              <button
                type="button"
                onClick={handleExportAral}
                disabled={loading || exportingAral || aralExportCount === 0}
                title="Download Eng/Fil ARAL-recommended learners (ECR-based list). Not the full intervention caseload Excel."
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-cnhs-green-dark transition-[color,background-color,border-color,opacity,transform] duration-160 hover:bg-emerald-100 disabled:opacity-60"
              >
                {exportingAral ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={13} />
                )}
                Export ARAL list
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
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-[color,background-color,border-color,opacity,transform] duration-160 hover:bg-slate-50"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <Link
              href="/teacher/my-classes"
              title="Open My Classes to generate term class-report files for this Monitoring tab"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-[color,background-color,border-color,opacity,transform] duration-160 hover:bg-slate-50"
            >
              <FileText size={13} />
              Generate report
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
        aria-label="Academic monitoring views"
        className="mb-3 flex flex-wrap gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-1"
      >
        {[
          { id: "caseload", label: "Intervention" },
          { id: "files", label: "Class reports" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={workspace === item.id}
            onClick={() => setWorkspace(item.id)}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-[11px] font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-160 ease-out",
              workspace === item.id
                ? "bg-white text-cnhs-green-dark shadow-sm ring-1 ring-cnhs-green/25"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
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
      ) : (
        <TabSwitchPanel activeKey={workspace}>
          {workspace === "caseload" ? (
            <TeacherInterventionCaseload
              students={students}
              progressByStudent={progressByStudent}
              onOpen={setSelectedLearner}
              teacherName={teacherDisplayName}
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500">
                  View and submit generated class report files. New files are
                  created from My Classes.
                </p>
                <Link
                  href="/teacher/my-classes"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cnhs-green/30 bg-cnhs-green-soft/40 px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-cnhs-green-soft"
                >
                  <FileText size={12} />
                  Generate from My Classes
                </Link>
              </div>
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
                  {sectionOptions.length > 1 ? (
                    <AppSelect
                      label="Filter by section"
                      value={section}
                      onChange={setSection}
                      options={sectionOptions}
                      size="pill"
                      className="min-w-[8.5rem]"
                      triggerClassName="h-9 font-semibold"
                    />
                  ) : null}

                  {gradeOptions.length > 1 ? (
                    <AppSelect
                      label="Filter by grade level"
                      value={grade}
                      onChange={setGrade}
                      options={gradeOptions.map((opt) => ({
                        value: opt,
                        label: opt === "All grades" ? "Grade lvl" : opt,
                      }))}
                      size="pill"
                      className="min-w-[8rem]"
                      triggerClassName="h-9 font-semibold"
                    />
                  ) : null}

                  <AppSelect
                    label="Sort by date"
                    value={dateFilter}
                    onChange={setDateFilter}
                    options={[
                      { value: DATE_FILTER.ALL, label: "Date" },
                      { value: DATE_FILTER.NEWEST, label: "Newest first" },
                      { value: DATE_FILTER.OLDEST, label: "Oldest first" },
                    ]}
                    size="pill"
                    className="min-w-[8.5rem]"
                    triggerClassName="h-9 font-semibold"
                  />
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
        </TabSwitchPanel>
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
          onSaved={async (payload) => {
            await applyLocalStudentPatches(payload);
          }}
          showHtActions={Boolean(filterOptions.hasAralClass)}
        />
      ) : null}
    </motion.div>
  );
}
