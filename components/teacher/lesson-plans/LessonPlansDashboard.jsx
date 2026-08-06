"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, Layers3, Menu, RefreshCw, Upload } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import LessonPlanFilters from "@/components/teacher/lesson-plans/LessonPlanFilters";
import LessonPlanStats from "@/components/teacher/lesson-plans/LessonPlanStats";
import LessonPlanTable from "@/components/teacher/lesson-plans/LessonPlanTable";
import TeacherLessonPlanDrawer from "@/components/teacher/lesson-plans/TeacherLessonPlanDrawer";
import { useTeacherLessonPlans } from "@/hooks/teacher/useLessonPlans";
import { getLessonPlanSignedUrl } from "@/lib/supabase/queries/lessonPlans";
import { lessonPlansData } from "@/data/teacher/lessonPlans";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import { TERM_ALL_LABEL, TERM_OPTIONS } from "@/lib/academic/termLabels";

const ALL_SCHOOL_YEARS = "All School Years";
const TERM_FILTER_OPTIONS = [TERM_ALL_LABEL, ...TERM_OPTIONS.map((t) => t.label)];

export default function LessonPlansDashboard() {
  const { filters } = lessonPlansData;
  const { plans, kpis, loading, refreshing, error, refresh, resubmit } =
    useTeacherLessonPlans();
  const [open, setOpen] = useState(false);
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

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open teacher menu"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                />
              }
            >
              <Menu size={18} />
            </SheetTrigger>
            <SheetContent
              side="left"
              showCloseButton={false}
              className={SIDEBAR_SHEET_CLASS}
            >
              <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
              <TeacherSidebar mobile onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <label className="relative">
            <span className="sr-only">School Year</span>
            <CalendarDays
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none hover:bg-slate-50 focus:border-cnhs-green"
            >
              {schoolYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <span className="sr-only">Term</span>
            <Layers3
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none hover:bg-slate-50 focus:border-cnhs-green"
            >
              {TERM_FILTER_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw
              size={12}
              className={refreshing || loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            href="/teacher/lesson-plans/upload"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Upload size={12} />
            Upload New
          </Link>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
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
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
            Loading lesson plans...
          </div>
        ) : (
          <LessonPlanTable
            plans={filtered}
            onView={openPlan}
            onDownload={downloadPlan}
            onResubmit={handleResubmit}
          />
        )}
      </div>

      <TeacherLessonPlanDrawer
        open={drawerOpen}
        plan={selectedPlan}
        fileUrl={fileUrl}
        loadingUrl={loadingUrl}
        resubmitting={resubmitting}
        onClose={() => setDrawerOpen(false)}
        onDownload={downloadPlan}
        onResubmit={handleResubmit}
      />
    </motion.div>
  );
}
