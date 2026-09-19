"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, Layers3, RefreshCw, Upload } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import LessonPlanFilters from "@/components/teacher/lesson-plans/LessonPlanFilters";
import LessonPlanStats from "@/components/teacher/lesson-plans/LessonPlanStats";
import LessonPlanTable from "@/components/teacher/lesson-plans/LessonPlanTable";
import TeacherLessonPlanDrawer from "@/components/teacher/lesson-plans/TeacherLessonPlanDrawer";
import { useTeacherLessonPlans } from "@/hooks/teacher/useLessonPlans";
import { getLessonPlanSignedUrl } from "@/lib/supabase/queries/lessonPlans";
import { lessonPlansData } from "@/data/teacher/lessonPlans";
import { TERM_ALL_LABEL, TERM_OPTIONS } from "@/lib/academic/termLabels";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import { createDeleteRequest } from "@/lib/supabase/queries/deleteRequests";

const ALL_SCHOOL_YEARS = "All School Years";
const TERM_FILTER_OPTIONS = [TERM_ALL_LABEL, ...TERM_OPTIONS.map((t) => t.label)];

export default function LessonPlansDashboard() {
  const { filters } = lessonPlansData;
  const { plans, kpis, loading, refreshing, error, refresh, resubmit, remove } =
    useTeacherLessonPlans();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All Status");
  const [subject, setSubject] = useState("All Subjects");
  const [quarter, setQuarter] = useState(TERM_ALL_LABEL);
  const [schoolYear, setSchoolYear] = useState(ALL_SCHOOL_YEARS);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const deepLinkHandled = useRef(false);

  const subjectOptions = useMemo(() => {
    return [
      "All Subjects",
      ...new Set(plans.map((plan) => plan.subject).filter(Boolean)),
    ];
  }, [plans]);

  const schoolYearOptions = useMemo(() => {
    const years = [
      ...new Set(plans.map((plan) => plan.schoolYear).filter(Boolean)),
    ].sort((a, b) => b.localeCompare(a));
    return [ALL_SCHOOL_YEARS, ...years];
  }, [plans]);

  const filtered = useMemo(() => {
    return plans.filter((plan) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        String(plan.lessonTitle || "")
          .toLowerCase()
          .includes(query) ||
        String(plan.subject || "")
          .toLowerCase()
          .includes(query);
      const matchesStatus = status === "All Status" || plan.status === status;
      const matchesSubject =
        subject === "All Subjects" || plan.subject === subject;
      const matchesQuarter =
        quarter === TERM_ALL_LABEL || plan.quarter === quarter;
      const matchesYear =
        schoolYear === ALL_SCHOOL_YEARS || plan.schoolYear === schoolYear;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesSubject &&
        matchesQuarter &&
        matchesYear
      );
    });
  }, [plans, search, status, subject, quarter, schoolYear]);

  function clearFilters() {
    setSearch("");
    setStatus("All Status");
    setSubject("All Subjects");
    setQuarter(TERM_ALL_LABEL);
    setSchoolYear(ALL_SCHOOL_YEARS);
  }

  async function openPlan(plan) {
    setSelectedPlan(plan);
    setDrawerOpen(true);
    setFileUrl(null);
    setLoadingUrl(true);
    const signed = await getLessonPlanSignedUrl(plan.filePath);
    setFileUrl(signed.data);
    setLoadingUrl(false);
  }

  // ?plan=<id> deep link, used by lesson plan notifications.
  useEffect(() => {
    if (deepLinkHandled.current || loading || !plans.length) return;
    const planId = new URLSearchParams(window.location.search).get("plan");
    if (!planId) return;

    deepLinkHandled.current = true;
    const target = plans.find((plan) => plan.id === planId);
    if (target) openPlan(target);
  }, [plans, loading]);

  // Keep open drawer in sync when list refreshes (admin review / resubmit).
  useEffect(() => {
    if (!selectedPlan?.id) return;
    const latest = plans.find((p) => p.id === selectedPlan.id);
    if (
      latest &&
      (latest.status !== selectedPlan.status ||
        latest.filePath !== selectedPlan.filePath ||
        latest.remarks !== selectedPlan.remarks ||
        latest.reviewedAt !== selectedPlan.reviewedAt)
    ) {
      setSelectedPlan(latest);
    }
  }, [plans, selectedPlan]);

  async function downloadPlan(plan) {
    if (!plan?.filePath) return;
    const signed = await getLessonPlanSignedUrl(plan.filePath);
    if (signed.data) {
      window.open(signed.data, "_blank", "noopener,noreferrer");
    }
  }

  async function handleResubmit(plan, file) {
    setResubmitting(true);
    setActionError("");
    const result = await resubmit({
      id: plan.id,
      file,
      previousFilePath: plan.filePath,
      schoolYear: plan.schoolYear,
    });
    setResubmitting(false);

    if (result.ok && result.plan) {
      setSelectedPlan(result.plan);
      setFileUrl(null);
      setLoadingUrl(true);
      const signed = await getLessonPlanSignedUrl(result.plan.filePath);
      setFileUrl(signed.data);
      setLoadingUrl(false);
    }

    return result;
  }

  async function handleDelete(plan) {
    if (!plan?.id) return { ok: false, error: new Error("Missing plan.") };
    const isDraft =
      plan.dbStatus === "Pending Review" || plan.status === "Pending";
    setDeleteConfirm({
      plan,
      isDraft,
      title: isDraft ? "Delete lesson plan" : "Request delete lesson plan",
      itemLabel: plan.lessonTitle || "this lesson plan",
      consequence: isDraft
        ? "This file will be removed. This cannot be undone."
        : "The head teacher must approve before this submitted file is removed.",
      confirmLabel: isDraft ? "Delete" : "Send request",
      tone: isDraft ? "danger" : "request",
    });
    return { ok: true, pending: true };
  }

  async function runDeleteConfirm() {
    const plan = deleteConfirm?.plan;
    if (!plan?.id) return;
    setDeleting(true);
    setActionError("");

    if (deleteConfirm.isDraft) {
      const result = await remove(plan);
      setDeleting(false);
      setDeleteConfirm(null);
      if (!result.ok) {
        setActionError(result.error?.message ?? "Unable to delete lesson plan.");
        return result;
      }
      if (selectedPlan?.id === plan.id) {
        setDrawerOpen(false);
        setSelectedPlan(null);
        setFileUrl(null);
      }
      return result;
    }

    const result = await createDeleteRequest({
      targetType: "lesson_plan",
      targetId: plan.id,
      label: plan.lessonTitle || "Lesson plan",
    });
    setDeleting(false);
    setDeleteConfirm(null);
    if (result.error) {
      setActionError(result.error.message);
      return { ok: false, error: result.error };
    }
    setActionError("");
    return { ok: true };
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium text-slate-400">
              <Link href="/teacher/dashboard" className="hover:text-slate-600">
                Home
              </Link>
              <span className="text-slate-300"> &gt; </span>
              <span className="font-semibold text-slate-600">Lesson Plans</span>
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              Lesson Plans
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Manage and submit lesson plans for Head Teacher review.
            </p>
          </div>

          <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AppSelect
            label="School Year"
            value={schoolYear}
            onChange={setSchoolYear}
            options={schoolYearOptions}
            icon={CalendarDays}
            size="pill"
            align="end"
          />

          <AppSelect
            label="Term"
            value={quarter}
            onChange={setQuarter}
            options={TERM_FILTER_OPTIONS}
            icon={Layers3}
            size="pill"
            align="end"
          />

          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"
          >
            <RefreshCw
              size={12}
              className={refreshing || loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            href="/teacher/lesson-plans/upload?fresh=1"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Upload size={12} />
            Upload New
          </Link>
        </div>
      </header>

      {error || actionError ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {actionError || error}
        </div>
      ) : null}

      <LessonPlanStats kpis={kpis} />

      <div className="mt-4">
        <LessonPlanFilters
          filters={{
            ...filters,
            subjects: subjectOptions,
            quarters: TERM_FILTER_OPTIONS,
            statuses: [
              "All Status",
              "Pending Review",
              "Under Review",
              "Approved",
              "Needs Revision",
            ],
          }}
          search={search}
          status={status}
          subject={subject}
          quarter={quarter}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onSubjectChange={setSubject}
          onQuarterChange={setQuarter}
          onClear={clearFilters}
          resultCount={filtered.length}
          totalCount={plans.length}
        />
      </div>

      <div className="mt-4">
        {loading && plans.length === 0 ? (
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-500">
            Loading lesson plans...
          </div>
        ) : (
          <LessonPlanTable
            plans={filtered}
            onView={openPlan}
            onDownload={downloadPlan}
            onResubmit={handleResubmit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <TeacherLessonPlanDrawer
        open={drawerOpen}
        plan={selectedPlan}
        fileUrl={fileUrl}
        loadingUrl={loadingUrl}
        resubmitting={resubmitting}
        deleting={deleting}
        onClose={() => setDrawerOpen(false)}
        onDownload={downloadPlan}
        onResubmit={handleResubmit}
        onDelete={handleDelete}
      />

      <DeleteConfirmModal
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.title}
        itemLabel={deleteConfirm?.itemLabel}
        consequence={deleteConfirm?.consequence}
        confirmLabel={deleteConfirm?.confirmLabel}
        confirming={deleting}
        confirmingLabel={deleteConfirm?.isDraft ? "Deleting…" : "Sending…"}
        tone={deleteConfirm?.tone}
        icon={deleteConfirm?.isDraft ? "delete" : "request"}
        onCancel={() => !deleting && setDeleteConfirm(null)}
        onConfirm={runDeleteConfirm}
      />
    </motion.div>
  );
}
