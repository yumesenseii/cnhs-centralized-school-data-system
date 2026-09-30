"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  CloudUpload,
  Download,
  FileCheck,
  FileText,
  Filter,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import Header from "@/components/layout/Header";
import AppSelect from "@/components/shared/AppSelect";
import StatusBadge from "@/components/teacher/lesson-plans/StatusBadge";
import TeacherLessonPlanDrawer from "@/components/teacher/lesson-plans/TeacherLessonPlanDrawer";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import { useAppToast } from "@/components/shared/AppToast";
import { useTeacherLessonPlans } from "@/hooks/teacher/useLessonPlans";
import {
  createLessonPlan,
  getLessonPlanSignedUrl,
  uploadLessonPlanFile,
} from "@/lib/supabase/queries/lessonPlans";
import {
  downloadFileFromUrl,
  downloadLessonPlanDocx,
  formatLessonPlanDownloadName,
} from "@/lib/lesson-plan/docxExport";
import { getCurrentTeacherSession, getTeacherClasses } from "@/lib/supabase/queries/myClasses";
import { createDeleteRequest } from "@/lib/supabase/queries/deleteRequests";
import {
  parseTermNumber,
  termLabel,
  termShortLabel,
  TERM_ALL_LABEL,
  TERM_OPTIONS,
} from "@/lib/academic/termLabels";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".docx", ".doc", ".pdf"];
const MAX_FILE_SIZE_MB = 25;

const WEEK_OPTIONS = [
  "Week 1",
  "Week 2",
  "Week 3",
  "Week 4",
  "Week 5",
  "Week 6",
  "Week 7",
  "Week 8",
  "Week 9",
  "Week 10",
];

export default function TeacherLessonPlanHub() {
  const router = useRouter();
  const { showToast } = useAppToast();

  const {
    plans,
    kpis,
    loading,
    refreshing,
    error,
    refresh,
    resubmit,
    remove,
  } = useTeacherLessonPlans();

  // Filter & Search State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedTerm, setSelectedTerm] = useState(TERM_ALL_LABEL);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("All School Years");

  // Right column tab: "all" | "pending" | "revision" | "approved"
  const [trackerTab, setTrackerTab] = useState("all");

  // Classes & Session State
  const [classes, setClasses] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Upload Form State
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("Week 1");
  const [lessonTitle, setLessonTitle] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // Drawer / Details State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load teacher session & assigned classes
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoadingClasses(true);
      const sessionResult = await getCurrentTeacherSession();
      if (cancelled) return;

      if (sessionResult.data?.teacher) {
        setTeacher(sessionResult.data.teacher);
        const classesResult = await getTeacherClasses(sessionResult.data.teacher.id);
        if (!cancelled && classesResult.data) {
          setClasses(classesResult.data);
          if (classesResult.data.length > 0) {
            setSelectedClassId(classesResult.data[0].id);
          }
        }
      }
      setLoadingClasses(false);
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // School Year options from plans & classes
  const schoolYearOptions = useMemo(() => {
    const years = [
      ...new Set([
        ...plans.map((p) => p.schoolYear).filter(Boolean),
        ...classes.map((c) => c.school_year).filter(Boolean),
        "SY 2026-2027",
        "SY 2025-2026",
      ]),
    ].sort((a, b) => b.localeCompare(a));
    return ["All School Years", ...years];
  }, [plans, classes]);

  // Class options for AppSelect with Trimester term clarity (e.g. Term 1, Term 2, Term 3)
  const classOptions = useMemo(() => {
    if (!classes.length) return [{ value: "", label: "No assigned classes found" }];
    return classes.map((cls) => {
      const subject = cls.subjects?.subject_name || cls.subject || "Subject";
      const section = cls.sections?.section_name || cls.section || "Section";
      const grade = cls.sections?.grade_level || cls.grade || "7";
      const term = cls.quarter ? ` · ${termLabel(cls.quarter)}` : "";
      return {
        value: cls.id,
        label: `${subject} · ${section} (Grade ${grade})${term}`,
      };
    });
  }, [classes]);

  const weekOptions = useMemo(() => {
    return WEEK_OPTIONS.map((w) => ({ value: w, label: w }));
  }, []);

  const statusOptions = [
    { value: "All Status", label: "All Status" },
    { value: "Pending Review", label: "Pending Review" },
    { value: "Needs Revision", label: "Needs Revision" },
    { value: "Approved", label: "Approved" },
  ];

  // Filtered submissions list
  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(plan.lessonTitle || "").toLowerCase().includes(q) ||
        String(plan.subject || "").toLowerCase().includes(q) ||
        String(plan.gradeSection || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "All Status" || plan.status === statusFilter;
      const parsedFilterTerm = parseTermNumber(selectedTerm);
      const matchesTerm =
        selectedTerm === TERM_ALL_LABEL ||
        plan.quarter === selectedTerm ||
        termLabel(plan.quarter) === selectedTerm ||
        (parsedFilterTerm !== null && Number(plan.quarter) === parsedFilterTerm);
      const matchesYear =
        selectedSchoolYear === "All School Years" ||
        plan.schoolYear === selectedSchoolYear;

      return matchesSearch && matchesStatus && matchesTerm && matchesYear;
    });
  }, [plans, search, statusFilter, selectedTerm, selectedSchoolYear]);

  // Right sidebar tracker items
  const trackerPlans = useMemo(() => {
    if (trackerTab === "pending") {
      return plans.filter(
        (p) => p.status === "Pending Review" || p.status === "Under Review"
      );
    }
    if (trackerTab === "revision") {
      return plans.filter((p) => p.status === "Needs Revision");
    }
    if (trackerTab === "approved") {
      return plans.filter((p) => p.status === "Approved");
    }
    return plans;
  }, [plans, trackerTab]);

  // Counts for tracker pills
  const counts = useMemo(() => {
    const pending = plans.filter(
      (p) => p.status === "Pending Review" || p.status === "Under Review"
    ).length;
    const revision = plans.filter((p) => p.status === "Needs Revision").length;
    const approved = plans.filter((p) => p.status === "Approved").length;
    return { all: plans.length, pending, revision, approved };
  }, [plans]);

  // Handle file selection
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  }

  function validateAndSetFile(file) {
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setUploadError("Only Word (.docx, .doc) or PDF (.pdf) files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadError(`File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setUploadError("");
    setUploadFile(file);
    if (!lessonTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setLessonTitle(cleanName);
    }
  }

  // Handle Drag and Drop
  function onDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  }

  // Submit Lesson Plan
  async function handleSubmitLessonPlan(e) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select or drop a lesson plan file.");
      return;
    }
    if (!selectedClassId) {
      setUploadError("Please select an assigned class.");
      return;
    }
    if (!teacher?.id) {
      setUploadError("Teacher session not found. Please refresh.");
      return;
    }

    const matchedClass = classes.find((c) => c.id === selectedClassId);
    if (!matchedClass) {
      setUploadError("Selected class not found.");
      return;
    }

    setSubmitting(true);
    setUploadError("");

    try {
      // 1. Upload file to Supabase storage
      const uploadResult = await uploadLessonPlanFile({
        teacherId: teacher.id,
        schoolYear: matchedClass.school_year || "SY 2026-2027",
        file: uploadFile,
      });
      if (uploadResult.error) {
        throw new Error(uploadResult.error.message || "Failed to upload file to storage.");
      }

      const filePath = uploadResult.data?.path || uploadResult.data?.Key || uploadFile.name;
      const quarterNumber = matchedClass.quarter ? String(matchedClass.quarter) : "1";

      // 2. Insert record to database
      const createResult = await createLessonPlan({
        teacher_id: teacher.id,
        class_id: matchedClass.id,
        lesson_title: lessonTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, ""),
        week_covered: selectedWeek,
        learning_competency: `${matchedClass.subjects?.subject_name || "General"} · ${selectedWeek}`,
        school_year: matchedClass.school_year || "SY 2026-2027",
        quarter: quarterNumber,
        file_name: uploadFile.name,
        file_path: filePath,
        file_size: uploadFile.size,
        file_type: uploadFile.name.split(".").pop().toLowerCase(),
        status: "Pending Review",
      });

      if (createResult.error) {
        throw new Error(createResult.error.message || "Failed to create lesson plan entry.");
      }

      showToast("Lesson Plan submitted successfully for review!");
      setUploadFile(null);
      setLessonTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      setUploadError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  }

  // Open plan details drawer
  async function openPlanDrawer(plan) {
    setSelectedPlan(plan);
    setDrawerOpen(true);
    setFileUrl(null);
    setLoadingUrl(true);
    const signed = await getLessonPlanSignedUrl(plan.filePath);
    setFileUrl(signed.data);
    setLoadingUrl(false);
  }

  async function handleDownload(plan, e) {
    e?.stopPropagation();
    if (!plan) return;
    try {
      if (plan.filePath) {
        const signed = await getLessonPlanSignedUrl(plan.filePath);
        if (signed.data) {
          const fileName = formatLessonPlanDownloadName(plan);
          await downloadFileFromUrl(signed.data, fileName);
          return;
        }
      }
      // Direct template population export fallback
      await downloadLessonPlanDocx(plan);
    } catch {
      showToast("Unable to download file.");
    }
  }

  return (
    <div className="pb-8">
      {/* Header Controls */}
      <Header
        breadcrumb="Home / Lesson Plans"
        title="Lesson Plans"
        description="Upload, manage, and track DepEd lesson plan submissions (DLP/DLL) for Principal review."
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              label="School Year"
              value={selectedSchoolYear}
              onChange={setSelectedSchoolYear}
              options={schoolYearOptions}
              icon={CalendarDays}
              size="pill"
            />
            <AppSelect
              label="Term"
              value={selectedTerm}
              onChange={setSelectedTerm}
              options={[TERM_ALL_LABEL, ...TERM_OPTIONS.map((t) => t.label)]}
              size="pill"
            />
            <button
              type="button"
              onClick={refresh}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Main Dual-Column Hub Layout */}
      <div className="mt-2 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_390px]">
        {/* LEFT COLUMN: Primary Workspace (Upload Card + Recent Submissions) */}
        <div className="space-y-5">
          {/* 1. Drag & Drop Upload Card */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Upload Lesson Plan
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Submit your Daily Lesson Log (DLL) or Detailed Lesson Plan (DLP)
                </p>
              </div>

              {/* Status Pill Indicator */}
              <div className="flex items-center gap-1.5">
                {counts.revision > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300">
                    <AlertCircle size={11} />
                    {counts.revision} Needs Revision
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <CheckCircle2 size={11} />
                    Ready to Upload
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmitLessonPlan} className="mt-4 space-y-4">
              {/* Class & Week Selection Row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Class <span className="text-red-500">*</span>
                  </label>
                  <AppSelect
                    value={selectedClassId}
                    onChange={setSelectedClassId}
                    options={classOptions}
                    size="field"
                    placeholder="Select class"
                    triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus-visible:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Week Covered <span className="text-red-500">*</span>
                  </label>
                  <AppSelect
                    value={selectedWeek}
                    onChange={setSelectedWeek}
                    options={weekOptions}
                    size="field"
                    placeholder="Select week"
                    triggerClassName="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 focus-visible:border-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Lesson Title Input */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Lesson Title / Topic
                </label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="e.g. Unit 1: Introduction to Literary Elements"
                  className="mt-1 block h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200",
                  dragging
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30"
                    : "border-slate-200 bg-slate-50/40 hover:border-emerald-500/60 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-emerald-500/50",
                  uploadFile && "border-emerald-600/50 bg-emerald-50/20 dark:bg-emerald-950/20"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {uploadFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <FileCheck size={24} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {uploadFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB · Ready to submit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                    >
                      <X size={12} /> Remove file
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-700 shadow-xs ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-emerald-400 dark:ring-slate-700">
                      <CloudUpload size={22} />
                    </div>
                    <p className="mt-2.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                      Drag and drop your lesson plan here
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-400">
                      or{" "}
                      <span className="font-semibold text-emerald-700 underline decoration-emerald-500/30 underline-offset-2 dark:text-emerald-400">
                        Browse Files
                      </span>
                    </p>
                    <span className="mt-2 text-[10px] font-medium text-slate-400 dark:text-slate-400">
                      Supports Word (.docx, .doc) and PDF (.pdf) up to {MAX_FILE_SIZE_MB}MB
                    </span>
                  </>
                )}
              </div>

              {uploadError ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {uploadError}
                </p>
              ) : null}

              {/* Submit Button */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting || !uploadFile}
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-cnhs-green-dark px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Submitting Plan…</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Submit for Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* 2. Recent Submissions List */}
          <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Recent Submissions
                </h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-400">
                  {filteredPlans.length} lesson plan(s) submitted
                </p>
              </div>

              {/* Search & Status Filter */}
              <div className="flex items-center gap-2">
                <div className="relative min-w-[160px] sm:min-w-[200px]">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search plans…"
                    className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-slate-800 outline-none transition focus:border-emerald-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <AppSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
                  size="field"
                  className="min-w-[130px]"
                  triggerClassName="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* List Table */}
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Loader2 size={20} className="mx-auto animate-spin text-emerald-600" />
                  <p className="mt-2">Loading lesson plans…</p>
                </div>
              ) : filteredPlans.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No lesson plans found matching the filters.
                </div>
              ) : (
                filteredPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => openPlanDrawer(plan)}
                    className="group flex cursor-pointer items-center justify-between gap-3 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-xl px-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-emerald-950/60 dark:group-hover:text-emerald-400 transition-colors">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900 group-hover:text-emerald-800 dark:text-slate-100 dark:group-hover:text-emerald-300">
                          {plan.lessonTitle}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-400 dark:text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {plan.subject}
                          </span>
                          <span>•</span>
                          <span>{plan.gradeSection}</span>
                          <span>•</span>
                          <span>{termLabel(plan.quarter)}</span>
                          <span>•</span>
                          <span>{plan.week}</span>
                          <span>•</span>
                          <span>{plan.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={plan.status} />
                      <button
                        type="button"
                        onClick={(e) => handleDownload(plan, e)}
                        title="Download file"
                        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Review & Deadlines Tracker Widget */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            {/* Widget Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Review & Deadlines
                </h3>
                <p className="text-[11px] text-slate-400">
                  From School Principal & Dept Head
                </p>
              </div>
            </div>

            {/* Filter Pills Tabs — Sleek Dark Segmented Control */}
            <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-black/50 dark:border dark:border-white/5">
              <button
                type="button"
                onClick={() => setTrackerTab("all")}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 px-0.5 text-center text-[10.5px] font-semibold transition truncate outline-none focus:outline-none",
                  trackerTab === "all"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 dark:bg-zinc-800 dark:text-white dark:border-zinc-700"
                    : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                All ({counts.all})
              </button>
              <button
                type="button"
                onClick={() => setTrackerTab("pending")}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 px-0.5 text-center text-[10.5px] font-semibold transition truncate outline-none focus:outline-none",
                  trackerTab === "pending"
                    ? "bg-white text-amber-700 shadow-xs border border-amber-200/80 dark:bg-zinc-800 dark:text-amber-300 dark:border-amber-500/20"
                    : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                Pending ({counts.pending})
              </button>
              <button
                type="button"
                onClick={() => setTrackerTab("revision")}
                title={`Needs Revision (${counts.revision})`}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 px-0.5 text-center text-[10.5px] font-semibold transition truncate outline-none focus:outline-none",
                  trackerTab === "revision"
                    ? "bg-white text-red-700 shadow-xs border border-red-200/80 dark:bg-zinc-800 dark:text-red-300 dark:border-red-500/20"
                    : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                Revision ({counts.revision})
              </button>
              <button
                type="button"
                onClick={() => setTrackerTab("approved")}
                className={cn(
                  "cursor-pointer rounded-lg py-1.5 px-0.5 text-center text-[10.5px] font-semibold transition truncate outline-none focus:outline-none",
                  trackerTab === "approved"
                    ? "bg-white text-emerald-700 shadow-xs border border-emerald-200/80 dark:bg-zinc-800 dark:text-emerald-300 dark:border-emerald-500/20"
                    : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                Approved ({counts.approved})
              </button>
            </div>

            {/* Tracker Cards List */}
            <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {trackerPlans.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No lesson plans in this category.
                </div>
              ) : (
                trackerPlans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => openPlanDrawer(plan)}
                    className={cn(
                      "cursor-pointer rounded-xl border p-3 transition-all hover:shadow-xs",
                      plan.status === "Needs Revision"
                        ? "border-red-200 bg-red-50/40 hover:bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20"
                        : plan.status === "Approved"
                        ? "border-emerald-200/80 bg-emerald-50/30 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-slate-200/80 bg-slate-50/40 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                        {plan.lessonTitle}
                      </p>
                      <StatusBadge status={plan.status} />
                    </div>

                    <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
                      {plan.subject} · {plan.gradeSection} · {plan.week}
                    </p>

                    {/* Reviewer & Feedback Notice */}
                    {plan.status === "Needs Revision" && plan.remarks ? (
                      <div className="mt-2 rounded-lg border border-red-200 bg-white p-2 text-[11px] text-red-800 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-300">
                        <span className="font-bold">Principal Note:</span> {plan.remarks}
                      </div>
                    ) : null}

                    {plan.status === "Approved" ? (
                      <p className="mt-2 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Approved by {plan.reviewerName || "Principal"}
                      </p>
                    ) : null}

                    {plan.status === "Pending Review" ? (
                      <p className="mt-2 text-[10.5px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Clock size={12} /> Awaiting review from Principal
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Shared Lesson Details Drawer */}
      <TeacherLessonPlanDrawer
        open={drawerOpen}
        plan={selectedPlan}
        fileUrl={fileUrl}
        loadingUrl={loadingUrl}
        resubmitting={resubmitting}
        onClose={() => setDrawerOpen(false)}
        onDownload={handleDownload}
        onResubmit={async () => {
          setResubmitting(true);
          await resubmit(selectedPlan);
          setResubmitting(false);
          setDrawerOpen(false);
        }}
        onDelete={() => {
          setDrawerOpen(false);
          setDeleteConfirm(selectedPlan);
        }}
      />

      {/* Delete / Request Removal Modal */}
      <DeleteConfirmModal
        open={Boolean(deleteConfirm)}
        title="Delete Lesson Plan"
        itemLabel={deleteConfirm?.lessonTitle}
        consequence={
          deleteConfirm?.status === "Approved"
            ? "Since this lesson plan is already approved, a deletion request will be sent to the Principal for approval."
            : "This lesson plan will be permanently removed."
        }
        confirmLabel={deleteConfirm?.status === "Approved" ? "Send Request" : "Delete"}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          if (deleteConfirm.status === "Approved") {
            const res = await createDeleteRequest({
              targetType: "lesson_plan",
              targetId: deleteConfirm.id,
              targetLabel: deleteConfirm.lessonTitle,
              reason: "Teacher requested deletion of approved plan",
            });
            if (res.error) showToast(res.error.message);
            else showToast("Deletion request sent to Principal.");
          } else {
            await remove(deleteConfirm.id);
            showToast("Lesson plan deleted.");
          }
          setDeleteConfirm(null);
        }}
      />
    </div>
  );
}
