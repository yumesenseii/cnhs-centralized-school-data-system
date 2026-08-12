"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Layers3, Menu, Search, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassCard from "@/components/teacher/my-classes/ClassCard";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import GenerateClassReportDialog from "@/components/teacher/my-classes/GenerateClassReportDialog";
import EmptyAssignedClassesState from "@/components/teacher/my-classes/EmptyAssignedClassesState";
import {
  PageBreadcrumb,
  SummaryKpiCards,
} from "@/components/teacher/my-classes/shared";
import { useTeacherClasses } from "@/hooks/teacher/useMyClasses";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import {
  generateClassReportFilesForTerms,
  REPORT_TERM_ALL,
} from "@/lib/monitoring/classReportFiles";
import { formatPersonName } from "@/lib/teacher/monitoringMappers";
import Link from "next/link";

export default function MyClasses() {
  const {
    classes,
    kpis,
    teacherId,
    teacher,
    profile,
    loading,
    refreshing,
    error,
    refresh,
  } = useTeacherClasses();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All Subjects");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [schoolYear, setSchoolYear] = useState("All School Years");
  const [quarter, setQuarter] = useState(TERM_ALL_LABEL);
  const [uploadClass, setUploadClass] = useState(null);
  const [generateClass, setGenerateClass] = useState(null);
  const [toast, setToast] = useState("");
  const [toastClassId, setToastClassId] = useState("");
  const [generatingId, setGeneratingId] = useState("");

  const teacherDisplayName = useMemo(() => {
    const named = formatPersonName(teacher);
    if (named && named !== "—") return named;
    return profile?.email || "Teacher";
  }, [teacher, profile]);

  function handleGenerateReport(classItem) {
    setGenerateClass(classItem);
  }

  function handleConfirmGenerate(termSelection) {
    if (!generateClass) return;
    setGeneratingId(generateClass.id);
    try {
      const { files, terms } = generateClassReportFilesForTerms({
        classItem: generateClass,
        termSelection,
        uploadedBy: teacherDisplayName,
      });

      if (!files.length) {
        setToast("Unable to generate class report file.");
        setToastClassId("");
        return;
      }

      const primary = files[0];
      setToastClassId(primary.classId);
      if (termSelection === REPORT_TERM_ALL || terms.length > 1) {
        const labels = terms.map((t) => termLabel(t)).join(", ");
        setToast(
          `Generated ${files.length} report file(s) (${labels}). Open Academic Monitoring — each term has its own Failing / Moderate / Passing tabs.`
        );
      } else {
        setToast(
          `Report ready: ${primary.fileName}. Classification uses ${termLabel(terms[0])} grades only.`
        );
      }
      setGenerateClass(null);
    } catch (err) {
      console.error(err);
      setToast("Unable to generate class report file.");
      setToastClassId("");
    } finally {
      setGeneratingId("");
    }
  }

  const filterOptions = useMemo(() => {
    const subjects = [
      ...new Set(classes.map((item) => item.subject).filter(Boolean)),
    ].sort();
    const grades = [
      ...new Set(classes.map((item) => item.grade).filter(Boolean)),
    ].sort();
    const sections = [
      ...new Set(classes.map((item) => item.section).filter(Boolean)),
    ].sort();
    const schoolYears = [
      ...new Set(classes.map((item) => item.schoolYear).filter(Boolean)),
    ].sort((a, b) => b.localeCompare(a));
    const quarters = [
      ...new Set(
        [
          TERM_ALL_LABEL,
          ...classes.map((item) => item.quarterLabel || item.currentQuarter),
        ].filter(Boolean)
      ),
    ].sort((a, b) => {
      if (a === TERM_ALL_LABEL) return -1;
      if (b === TERM_ALL_LABEL) return 1;
      return String(a).localeCompare(String(b));
    });

    return {
      subjects: ["All Subjects", ...subjects],
      grades: ["All Grades", ...grades],
      sections: ["All Sections", ...sections],
      schoolYears: ["All School Years", ...schoolYears],
      quarters,
    };
  }, [classes]);

  const filtered = useMemo(() => {
    return classes.filter((item) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.subject.toLowerCase().includes(query) ||
        item.gradeSection.toLowerCase().includes(query) ||
        item.section.toLowerCase().includes(query) ||
        String(item.schoolYear ?? "")
          .toLowerCase()
          .includes(query);
      const matchesSubject =
        subject === "All Subjects" || item.subject === subject;
      const matchesGrade = grade === "All Grades" || item.grade === grade;
      const matchesSection =
        section === "All Sections" || item.section === section;
      const matchesSchoolYear =
        schoolYear === "All School Years" || item.schoolYear === schoolYear;
      const matchesQuarter =
        quarter === TERM_ALL_LABEL ||
        item.quarterLabel === quarter ||
        item.currentQuarter === quarter;

      return (
        matchesSearch &&
        matchesSubject &&
        matchesGrade &&
        matchesSection &&
        matchesSchoolYear &&
        matchesQuarter
      );
    });
  }, [classes, search, subject, grade, section, schoolYear, quarter]);

  function clearFilters() {
    setSearch("");
    setSubject("All Subjects");
    setGrade("All Grades");
    setSection("All Sections");
    setSchoolYear("All School Years");
    setQuarter(TERM_ALL_LABEL);
  }

  const hasAssignedClasses = classes.length > 0;
  const hasFilterMiss = hasAssignedClasses && filtered.length === 0;

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
            <PageBreadcrumb
              items={[
                { label: "Home", href: "/teacher/dashboard" },
                { label: "My Classes" },
              ]}
            />
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              My Classes
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Classes assigned to you by the school administrator.
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

        {hasAssignedClasses ? (
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
                {filterOptions.schoolYears.map((year) => (
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
                {filterOptions.quarters.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </header>

      {toast ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-[12px] font-medium text-cnhs-green-dark sm:flex-row sm:items-center sm:justify-between">
          <p>{toast}</p>
          <div className="flex flex-wrap gap-2">
            {toastClassId ? (
              <Link
                href={`/teacher/monitoring?classId=${toastClassId}`}
                className="inline-flex h-8 items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
              >
                Open in Academic Monitoring
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setToast("");
                setToastClassId("");
              }}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-green-200 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {loading && classes.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading assigned classes...
        </div>
      ) : !hasAssignedClasses && !refreshing ? (
        <EmptyAssignedClassesState />
      ) : (
        <>
          <SummaryKpiCards kpis={kpis} />

          <section className="mt-4 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search class or subject</span>
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subject, grade, or section..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  {
                    value: subject,
                    set: setSubject,
                    options: filterOptions.subjects,
                  },
                  { value: grade, set: setGrade, options: filterOptions.grades },
                  {
                    value: section,
                    set: setSection,
                    options: filterOptions.sections,
                  },
                ].map((filter) => (
                  <select
                    key={filter.options[0]}
                    value={filter.value}
                    onChange={(e) => filter.set(e.target.value)}
                    className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 pr-7 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
                  >
                    {filter.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
                >
                  <X size={12} />
                  Clear
                </button>
              </div>
            </div>
          </section>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((classItem) => (
              <ClassCard
                key={classItem.id}
                classItem={classItem}
                onUploadRecord={() => setUploadClass(classItem)}
                onGenerateReport={handleGenerateReport}
                generating={generatingId === classItem.id}
              />
            ))}
          </div>

          {hasFilterMiss ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              No assigned classes match your current filters.
            </div>
          ) : null}
        </>
      )}

      <EClassUploadDialog
        open={Boolean(uploadClass)}
        classItem={uploadClass}
        teacherId={teacherId}
        onClose={() => setUploadClass(null)}
        onSuccess={(result) => {
          const learners = result?.imported ?? 0;
          const grades = result?.gradesUpserted ?? 0;
          setToast(
            `Imported ${learners} learner${learners === 1 ? "" : "s"}${
              grades ? ` and ${grades} grade record${grades === 1 ? "" : "s"}` : ""
            }.`
          );
          refresh();
          window.setTimeout(() => setToast(""), 3200);
        }}
      />

      <GenerateClassReportDialog
        open={Boolean(generateClass)}
        classItem={generateClass}
        confirming={Boolean(generatingId)}
        onClose={() => {
          if (!generatingId) setGenerateClass(null);
        }}
        onConfirm={handleConfirmGenerate}
      />
    </motion.div>
  );
}
