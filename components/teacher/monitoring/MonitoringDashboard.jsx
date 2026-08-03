"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Layers3, Loader2, Menu, RefreshCw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassMonitoringCards from "@/components/teacher/monitoring/ClassMonitoringCards";
import LearnersInterventionTable from "@/components/teacher/monitoring/LearnersInterventionTable";
import MonitoringFilters from "@/components/teacher/monitoring/MonitoringFilters";
import MonitoringStats from "@/components/teacher/monitoring/MonitoringStats";
import { PAGE_SIZE } from "@/components/teacher/monitoring/MonitoringTablePagination";
import { useTeacherMonitoring } from "@/hooks/teacher/useMonitoring";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function MonitoringDashboard() {
  const router = useRouter();
  const {
    students,
    classSummaries,
    kpis,
    filterOptions,
    controls,
    loading,
    error,
    refresh,
  } = useTeacherMonitoring();

  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [subject, setSubject] = useState("All Subjects");
  const [intervention, setIntervention] = useState("All Recommendations");
  const [status, setStatus] = useState("All Status");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    // Sorting is preserved from buildMonitoringRoster (at-risk first, then name).
    return students.filter((learner) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        learner.name.toLowerCase().includes(query) ||
        learner.studentNumber.toLowerCase().includes(query);
      const matchesGrade = grade === "All Grades" || learner.grade === grade;
      const matchesSection =
        section === "All Sections" || learner.section === section;
      const matchesSubject =
        subject === "All Subjects" || learner.subject === subject;
      const matchesIntervention =
        intervention === "All Recommendations" ||
        learner.recommendation === intervention;
      const matchesStatus =
        status === "All Status" || learner.monitoringStatus === status;
      return (
        matchesSearch &&
        matchesGrade &&
        matchesSection &&
        matchesSubject &&
        matchesIntervention &&
        matchesStatus
      );
    });
  }, [students, search, grade, section, subject, intervention, status]);

  // Reset to page 1 whenever any filter changes (or the source roster refreshes).
  useEffect(() => {
    setPage(1);
  }, [search, grade, section, subject, intervention, status, students]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pagedLearners = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  function clearFilters() {
    setSearch("");
    setGrade("All Grades");
    setSection("All Sections");
    setSubject("All Subjects");
    setIntervention("All Recommendations");
    setStatus("All Status");
    setPage(1);
  }

  function handleViewMonitoring(learner) {
    router.push(
      `/teacher/monitoring/${learner.classId}/students/${learner.studentId}`
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start justify-between gap-4">
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
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              Academic Monitoring
            </h1>
            <p className="mt-1 max-w-xl text-[12px] text-slate-500">
              {filterOptions.hasAralClass
                ? "Review assigned classes, identify learners needing ARAL Learners, check class-level Classroom Remedial, and track monitoring progress."
                : "Review assigned classes, check class-level Classroom Remedial, and track monitoring progress."}
            </p>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
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
              <TeacherSidebar mobile onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
            <CalendarDays size={12} className="text-slate-400" />
            {controls.schoolYear}
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
            <Layers3 size={12} className="text-slate-400" />
            {controls.quarter}
          </span>
          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading monitoring data…
        </div>
      ) : (
        <>
          <MonitoringStats kpis={kpis.slice(0, 4)} />

          <div className="mt-3">
            <ClassMonitoringCards classSummaries={classSummaries} />
          </div>

          <div className="mt-3">
            <MonitoringFilters
              filters={filterOptions}
              search={search}
              grade={grade}
              section={section}
              subject={subject}
              intervention={intervention}
              status={status}
              onSearchChange={setSearch}
              onGradeChange={setGrade}
              onSectionChange={setSection}
              onSubjectChange={setSubject}
              onInterventionChange={setIntervention}
              onStatusChange={setStatus}
              onClear={clearFilters}
            />
          </div>

          <div className="mt-3">
            <LearnersInterventionTable
              learners={pagedLearners}
              totalCount={filtered.length}
              atRiskCount={filtered.filter((l) => l.atRisk).length}
              page={safePage}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              schoolYear={controls.schoolYear}
              quarter={controls.quarter}
              onViewMonitoring={handleViewMonitoring}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}
