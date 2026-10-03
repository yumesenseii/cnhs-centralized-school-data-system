"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Layers3, Search, X } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassCard from "@/components/teacher/my-classes/ClassCard";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import GenerateClassReportDialog from "@/components/teacher/my-classes/GenerateClassReportDialog";
import {
  PageBreadcrumb,
  SummaryKpiCards,
} from "@/components/teacher/my-classes/shared";
import { useTeacherClasses } from "@/hooks/teacher/useMyClasses";
import { TERM_ALL_LABEL, termLabel } from "@/lib/academic/termLabels";
import { REPORT_TERM_ALL } from "@/lib/monitoring/classReportFiles";
import { buildAndSaveClassReportSnapshot } from "@/lib/monitoring/classReportSnapshot";
import { formatPersonName } from "@/lib/teacher/monitoringMappers";
import { useAppToast } from "@/components/shared/AppToast";

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
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All Subjects");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [schoolYear, setSchoolYear] = useState("All School Years");
  const [quarter, setQuarter] = useState(TERM_ALL_LABEL);
  const [uploadClass, setUploadClass] = useState(null);
  const [generateClass, setGenerateClass] = useState(null);
  const { showToast } = useAppToast();
  const [generatingId, setGeneratingId] = useState("");

  const teacherDisplayName = useMemo(() => {
    const named = formatPersonName(teacher);
    if (named && named !== "—") return named;
    return profile?.email || "Teacher";
  }, [teacher, profile]);

  function handleGenerateReport(classItem) {
    setGenerateClass(classItem);
  }

  async function handleConfirmGenerate(termSelection) {
    if (!generateClass) return;
    setGeneratingId(generateClass.id);
    try {
      const { files, terms } = await buildAndSaveClassReportSnapshot({
        classItem: generateClass,
        termSelection,
        teacherId,
        teacherName: teacherDisplayName,
      });

      if (!files.length) {
        showToast("Unable to generate class report file.");
        return;
      }

      const primary = files[0];
      const monitoringAction = {
        href: `/teacher/monitoring?classId=${primary.classId}`,
        label: "Open in Academic Monitoring",
      };
      if (termSelection === REPORT_TERM_ALL || terms.length > 1) {
        const labels = terms.map((t) => termLabel(t)).join(", ");
        showToast(
          `Generated ${files.length} report file(s) (${labels}). Open Academic Monitoring — each term has its own Failing / Moderate / Passing tabs.`,
          { action: monitoringAction }
        );
      } else {
        showToast(
          `Report ready: ${primary.fileName}. Classification uses ${termLabel(terms[0])} grades only.`,
          { action: monitoringAction }
        );
      }
      setGenerateClass(null);
    } catch (err) {
      console.error(err);
      showToast("Unable to generate class report file.");
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

          <MobileNavSheet
            ariaLabel="Open teacher menu"
            title="Teacher navigation"
          >
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AppSelect
            label="School Year"
            value={schoolYear}
            onChange={setSchoolYear}
            options={filterOptions.schoolYears}
            icon={CalendarDays}
            size="pill"
            align="end"
          />

          <AppSelect
            label="Term"
            value={quarter}
            onChange={setQuarter}
            options={filterOptions.quarters}
            icon={Layers3}
            size="pill"
            align="end"
          />
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {loading && classes.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Loading assigned classes...
        </div>
      ) : (
        <>
          <SummaryKpiCards
            kpis={
              kpis.length
                ? kpis
                : [
                    {
                      id: "assigned",
                      label: "Assigned Classes",
                      value: 0,
                      icon: "book",
                      tone: "green",
                    },
                    {
                      id: "students",
                      label: "Students Enrolled",
                      value: 0,
                      icon: "users",
                      tone: "blue",
                    },
                    {
                      id: "subjects",
                      label: "Subjects",
                      value: 0,
                      icon: "file",
                      tone: "orange",
                    },
                    {
                      id: "sections",
                      label: "Grade & Sections",
                      value: 0,
                      icon: "clipboard",
                      tone: "red",
                    },
                  ]
            }
          />

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
                    label: "Subject",
                    value: subject,
                    set: setSubject,
                    options: filterOptions.subjects,
                  },
                  {
                    label: "Grade",
                    value: grade,
                    set: setGrade,
                    options: filterOptions.grades,
                  },
                  {
                    label: "Section",
                    value: section,
                    set: setSection,
                    options: filterOptions.sections,
                  },
                ].map((filter) => (
                  <AppSelect
                    key={filter.label}
                    label={filter.label}
                    value={filter.value}
                    onChange={filter.set}
                    options={filter.options}
                    size="field"
                    triggerClassName="h-9 rounded-lg text-[11px]"
                  />
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

          <div
            className={
              filtered.length === 1
                ? "mt-4 grid max-w-sm grid-cols-1 gap-4"
                : "mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
            }
          >
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

          {!hasAssignedClasses ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              No classes have been assigned yet. Assignments from the school
              administrator will appear here.
            </div>
          ) : hasFilterMiss ? (
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
        onSuccess={async (result) => {
          const learners = result?.imported ?? 0;
          const grades = result?.gradesUpserted ?? 0;
          showToast(
            `Imported ${learners} learner${learners === 1 ? "" : "s"}${
              grades ? ` and ${grades} grade record${grades === 1 ? "" : "s"}` : ""
            }.`
          );
          await refresh();
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
