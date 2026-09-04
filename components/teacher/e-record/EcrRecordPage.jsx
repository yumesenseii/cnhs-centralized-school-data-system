"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Search,
  Send,
  Upload,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import EcrDepedHeader from "@/components/teacher/e-record/EcrDepedHeader";
import EcrGrid from "@/components/teacher/e-record/EcrGrid";
import EcrSummary from "@/components/teacher/e-record/EcrSummary";
import EcrTermTabs from "@/components/teacher/e-record/EcrTermTabs";
import { useEcrRecord } from "@/hooks/teacher/useEcrRecord";
import { exportEcrTermExcel } from "@/lib/ecr/exportTermSheet";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { termLabel } from "@/lib/academic/termLabels";

function formatSavedAt(date) {
  if (!date) return null;
  try {
    return date.toLocaleTimeString("en-PH", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function EcrRecordPage({ classId }) {
  const {
    loading,
    error,
    classItem,
    students,
    activeTerm,
    setActiveTerm,
    config,
    studentScores,
    computedByStudent,
    summaryRows,
    gradedProgress,
    dirty,
    autoSaving,
    lastSavedAt,
    setScore,
    updateConfig,
    saveDraft,
    publishGrades,
    publishAve,
    loadAllTermDataForExport,
    refresh,
  } = useEcrRecord(classId);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  async function openImport() {
    const session = await getCurrentTeacherSession();
    setTeacherId(session.data?.teacherId ?? null);
    setUploadOpen(true);
  }

  async function handleSaveDraft() {
    setSaving(true);
    const result = await saveDraft();
    setSaving(false);
    setToast(result.ok ? "Draft saved." : "Unable to save draft.");
  }

  async function handlePublish() {
    setPublishing(true);
    if (activeTerm === "summary") {
      const result = await publishAve();
      setPublishing(false);
      setToast(
        result.ok
          ? "Final grades published to class records."
          : "Unable to publish final grades."
      );
      return;
    }
    const result = await publishGrades();
    setPublishing(false);
    setToast(
      result.ok
        ? `${termLabel(activeTerm)} grades published.`
        : "Unable to publish grades."
    );
  }

  async function handleExport() {
    setExporting(true);
    setToast("Preparing Class Record Excel…");
    try {
      if (dirty && activeTerm !== "summary") {
        const saved = await saveDraft();
        if (!saved.ok) {
          setToast("Unable to save draft before export.");
          return;
        }
      }

      const termDataByTerm = await loadAllTermDataForExport();
      if (activeTerm !== "summary") {
        termDataByTerm[activeTerm] = {
          config,
          studentScores,
          computedByStudent,
        };
      }

      await exportEcrTermExcel({
        classItem,
        term: activeTerm,
        students,
        config,
        studentScores,
        computedByStudent,
        termDataByTerm,
      });
      setToast("Class Record Excel downloaded.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export Excel.");
    } finally {
      setExporting(false);
    }
  }

  const title = classItem
    ? `${classItem.subject} · Grade ${classItem.gradeLevel} ${classItem.section}`
    : "E-Record";

  const savedLabel = formatSavedAt(lastSavedAt);
  const rosterLabel = students.length
    ? `${students.length} learner${students.length === 1 ? "" : "s"}`
    : "No roster";

  const gridSection = (
    <>
      {activeTerm !== "summary" ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {rosterLabel}
            </span>
            <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {gradedProgress.graded}/{gradedProgress.total} with scores
            </span>
            {dirty ? (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                {autoSaving ? "Auto-saving…" : "Unsaved changes"}
              </span>
            ) : savedLabel ? (
              <span className="text-[11px] text-slate-400">
                Saved {savedLabel}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search learner or LRN…"
                className="h-8 w-48 rounded-full border border-slate-200 bg-white pl-8 pr-3 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-cnhs-green focus:outline-none focus:ring-2 focus:ring-cnhs-green/20"
              />
            </div>
            <button
              type="button"
              onClick={() => setFullscreen((value) => !value)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              title={fullscreen ? "Exit fullscreen" : "Expand grid"}
            >
              {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              {fullscreen ? "Exit" : "Expand"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-16 text-center text-sm text-slate-400">
          Loading E-Record…
        </div>
      ) : activeTerm === "summary" ? (
        <EcrSummary rows={summaryRows} />
      ) : (
        <EcrGrid
          students={students}
          config={config}
          studentScores={studentScores}
          computedByStudent={computedByStudent}
          onScoreChange={setScore}
          onConfigUpdate={updateConfig}
          searchQuery={searchQuery}
          onImportClick={openImport}
        />
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={fullscreen ? "fixed inset-0 z-50 overflow-auto bg-slate-50 p-4" : "pb-6"}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/teacher/my-classes/${classId}`}
            className="mb-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-cnhs-green-dark"
          >
            <ArrowLeft size={14} />
            Back to class
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <MobileNavSheet sidebar={<TeacherSidebar />} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">E-Record</h1>
          <p className="text-[12px] text-slate-500">
            {title}
            {classItem?.schoolYear ? ` · ${classItem.schoolYear}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || loading || activeTerm === "summary"}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-60"
          >
            {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {activeTerm === "summary" ? "Publish Final" : "Publish Grades"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || exporting}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Export Excel
          </button>
          <button
            type="button"
            onClick={openImport}
            disabled={loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
          >
            <Upload size={13} />
            Import ECR
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </div>
      ) : null}

      {toast ? (
        <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          {toast}
        </div>
      ) : null}

      <EcrDepedHeader classItem={classItem} activeTerm={activeTerm} />

      <div className="mb-3">
        <EcrTermTabs activeTerm={activeTerm} onChange={setActiveTerm} />
      </div>

      {gridSection}

      <EClassUploadDialog
        open={uploadOpen}
        classItem={
          classItem
            ? {
                id: classItem.id,
                subject: classItem.subject,
                gradeSection: `Grade ${classItem.gradeLevel} ${classItem.section}`,
                schoolYear: classItem.schoolYear,
                teacher: classItem.teacherName ?? "",
                subjectId: classItem.subjectId,
                sectionId: classItem.sectionId,
                quarter: classItem.quarter,
              }
            : null
        }
        teacherId={teacherId}
        onClose={() => setUploadOpen(false)}
        onSuccess={async (result) => {
          setToast(
            `Imported ${result?.imported ?? 0} learner(s). E-Record synced.`
          );
          setUploadOpen(false);
          await refresh();
        }}
      />
    </motion.div>
  );
}
