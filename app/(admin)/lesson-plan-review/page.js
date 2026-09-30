"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, RefreshCw } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import FilterDropdown from "@/components/lesson-plan/FilterDropdown";
import LessonDrawer from "@/components/lesson-plan/LessonDrawer";
import LessonPlanTable from "@/components/lesson-plan/LessonPlanTable";
import SearchBar from "@/components/lesson-plan/SearchBar";
import SummaryCards from "@/components/lesson-plan/SummaryCards";
import Header from "@/components/layout/Header";
import { useAdminLessonPlanReview } from "@/hooks/teacher/useLessonPlans";

function HeaderControls({
  schoolYear,
  quarter,
  schoolYears,
  quarters,
  onSchoolYearChange,
  onQuarterChange,
  onRefresh,
}) {
  return (
    <>
      <AppSelect
        label="School Year"
        value={schoolYear}
        onChange={onSchoolYearChange}
        options={schoolYears?.length ? schoolYears : ["All School Years"]}
        icon={CalendarDays}
        size="pill"
        align="end"
      />
      <AppSelect
        label="Quarter"
        value={quarter}
        onChange={onQuarterChange}
        options={quarters?.length ? quarters : ["All Terms"]}
        size="pill"
        align="end"
      />
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <RefreshCw size={12} />
        Refresh
      </button>
    </>
  );
}

export default function LessonPlanReviewRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          Loading lesson plan review…
        </div>
      }
    >
      <LessonPlanReviewPage />
    </Suspense>
  );
}

function LessonPlanReviewPage() {
  const searchParams = useSearchParams();
  const planFromUrl = searchParams?.get("plan")?.trim() || null;

  const {
    plans,
    recentActivity,
    summaryCards,
    actionRequired,
    filterOptions,
    schoolYear,
    quarter,
    setSchoolYear,
    setQuarter,
    loading,
    error,
    refresh,
    submitDecision,
    markUnderReview,
    reviewerName,
  } = useAdminLessonPlanReview();

  const [drawerLesson, setDrawerLesson] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teacher, setTeacher] = useState("All Teachers");
  const [learningArea, setLearningArea] = useState("All Learning Areas");
  const [grade, setGrade] = useState("All Grades");
  const [status, setStatus] = useState("All Status");
  const [openedFromUrl, setOpenedFromUrl] = useState(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter((lesson) => {
      const matchesSearch =
        !query ||
        lesson.lessonTitle.toLowerCase().includes(query) ||
        lesson.teacher.toLowerCase().includes(query) ||
        lesson.learningArea.toLowerCase().includes(query);
      const matchesTeacher =
        teacher === "All Teachers" || lesson.teacher === teacher;
      const matchesArea =
        learningArea === "All Learning Areas" ||
        lesson.learningArea === learningArea;
      const matchesGrade =
        grade === "All Grades" ||
        lesson.gradeSection?.toLowerCase().includes(grade.toLowerCase());
      const matchesStatus =
        status === "All Status" ||
        lesson.status === status ||
        lesson.dbStatus === status;
      return (
        matchesSearch &&
        matchesTeacher &&
        matchesArea &&
        matchesGrade &&
        matchesStatus
      );
    });
  }, [plans, search, teacher, learningArea, grade, status]);

  useEffect(() => {
    if (!drawerLesson?.id) return;
    const latest = plans.find((p) => p.id === drawerLesson.id);
    if (
      latest &&
      (latest.dbStatus !== drawerLesson.dbStatus ||
        latest.status !== drawerLesson.status)
    ) {
      setDrawerLesson(latest);
    }
  }, [plans, drawerLesson]);

  useEffect(() => {
    if (!planFromUrl || loading || !plans.length) return;
    if (openedFromUrl === planFromUrl) return;
    const match = plans.find((p) => p.id === planFromUrl);
    if (!match) return;
    setDrawerLesson(match);
    setDrawerOpen(true);
    setOpenedFromUrl(planFromUrl);
  }, [planFromUrl, plans, loading, openedFromUrl]);

  function openDrawer(lesson) {
    setDrawerLesson(lesson);
    setDrawerOpen(true);
  }

  async function handleOpenedPending(lesson) {
    const result = await markUnderReview(lesson);
    if (result?.ok && result.plan) {
      setDrawerLesson(result.plan);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / Lesson Plan Review"
        title="Lesson Plan Review"
        controls={
          <HeaderControls
            schoolYear={schoolYear}
            quarter={quarter}
            schoolYears={filterOptions.schoolYears}
            quarters={filterOptions.quarters}
            onSchoolYearChange={setSchoolYear}
            onQuarterChange={setQuarter}
            onRefresh={() => refresh()}
          />
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <SummaryCards cards={summaryCards} />

      <section className="mt-2.5 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center">
          <SearchBar value={search} onChange={setSearch} />
          <FilterDropdown
            label="Teacher"
            options={filterOptions.teachers}
            value={teacher}
            onChange={setTeacher}
          />
          <FilterDropdown
            label="Learning Area"
            options={filterOptions.learningAreas}
            value={learningArea}
            onChange={setLearningArea}
          />
          <FilterDropdown
            label="Grade Level"
            options={filterOptions.grades}
            value={grade}
            onChange={setGrade}
          />
          <FilterDropdown
            label="Status"
            options={filterOptions.statuses}
            value={status}
            onChange={setStatus}
          />
        </div>
      </section>

      <div className="mt-2.5">
        {loading ? (
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Loading lesson plans...
          </div>
        ) : (
          <LessonPlanTable lessons={filtered} onReview={openDrawer} />
        )}
      </div>

      <LessonDrawer
        open={drawerOpen}
        lesson={drawerLesson}
        onClose={() => setDrawerOpen(false)}
        onSubmitDecision={submitDecision}
        onOpenedPending={handleOpenedPending}
        reviewerName={reviewerName}
      />
    </motion.div>
  );
}
