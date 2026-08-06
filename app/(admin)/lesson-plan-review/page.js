"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, RefreshCw } from "lucide-react";
import FilterDropdown from "@/components/lesson-plan/FilterDropdown";
import LessonDrawer from "@/components/lesson-plan/LessonDrawer";
import LessonPlanTable from "@/components/lesson-plan/LessonPlanTable";
import ReviewContextAccordion from "@/components/lesson-plan/ReviewContextAccordion";
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
      <label className="relative">
        <span className="sr-only">School Year</span>
        <CalendarDays
          size={12}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <select
          value={schoolYear}
          onChange={(e) => onSchoolYearChange(e.target.value)}
          className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green"
        >
          {(schoolYears?.length ? schoolYears : ["All School Years"]).map(
            (option) => (
              <option key={option} value={option}>
                {option}
              </option>
            )
          )}
        </select>
      </label>
      <label>
        <span className="sr-only">Quarter</span>
        <select
          value={quarter}
          onChange={(e) => onQuarterChange(e.target.value)}
          className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white px-4 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green"
        >
          {(quarters?.length ? quarters : ["All Terms"]).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
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

export default function LessonPlanReviewPage() {
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
  } = useAdminLessonPlanReview();

  const [drawerLesson, setDrawerLesson] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [teacher, setTeacher] = useState("All Teachers");
  const [learningArea, setLearningArea] = useState("All Learning Areas");
  const [grade, setGrade] = useState("All Grades");
  const [status, setStatus] = useState("All Status");

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

  const quarterSummary = useMemo(() => {
    const total = plans.length || 1;
    const approved = plans.filter((p) => p.dbStatus === "Approved").length;
    const pending = plans.filter(
      (p) =>
        p.dbStatus === "Pending Review" || p.dbStatus === "Under Review"
    ).length;
    const revision = plans.filter((p) => p.dbStatus === "Needs Revision").length;
    return [
      {
        label: "Approved",
        value: approved,
        percent: Math.round((approved / total) * 100),
        tone: "green",
      },
      {
        label: "Pending",
        value: pending,
        percent: Math.round((pending / total) * 100),
        tone: "orange",
      },
      {
        label: "Needs Revision",
        value: revision,
        percent: Math.round((revision / total) * 100),
        tone: "red",
      },
    ];
  }, [plans]);

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

      <ReviewContextAccordion
        recentActivity={recentActivity}
        quarterSummary={quarterSummary}
        actionRequired={actionRequired}
      />

      <LessonDrawer
        open={drawerOpen}
        lesson={drawerLesson}
        onClose={() => setDrawerOpen(false)}
        onSubmitDecision={submitDecision}
        onOpenedPending={handleOpenedPending}
      />
    </motion.div>
  );
}
