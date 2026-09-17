"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Search } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import EmptyLearnersState from "@/components/teacher/my-classes/EmptyLearnersState";
import {
  PageBreadcrumb,
  SummaryKpiCards,
} from "@/components/teacher/my-classes/shared";
import { useClassDetails } from "@/hooks/teacher/useMyClasses";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { termLabel } from "@/lib/academic/termLabels";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAppToast } from "@/components/shared/AppToast";

const avatarTones = {
  red: "bg-red-100 text-red-700",
  green: "bg-green-100 text-cnhs-green-dark",
  blue: "bg-sky-100 text-sky-700",
};

const GRADE_COLUMNS = [
  { key: "1", label: "T1", term: 1 },
  { key: "2", label: "T2", term: 2 },
  { key: "3", label: "T3", term: 3 },
  { key: "final", label: "Final", term: 4 },
];

function gradeValue(student, key) {
  if (key === "final") return student.termGrades?.final ?? student.averageGrade;
  return student.termGrades?.[key] ?? null;
}

function GradeCell({ value, active = false }) {
  const hasGrade = value !== null && value !== undefined && value !== "";
  const numeric = Number(value);
  const failing = hasGrade && Number.isFinite(numeric) && numeric < 75;
  const passing = hasGrade && Number.isFinite(numeric) && numeric >= 75;

  return (
    <td
      className={cn(
        "px-3 py-2.5 text-center text-xs font-semibold tabular-nums",
        active ? "bg-green-50/80" : "",
        failing ? "text-red-600" : passing ? "text-cnhs-green-dark" : "text-slate-400"
      )}
    >
      <span
        className={cn(
          "inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5",
          failing ? "bg-red-50" : passing ? "bg-green-50" : "bg-slate-50"
        )}
      >
        {hasGrade && Number.isFinite(numeric) ? numeric : "—"}
      </span>
    </td>
  );
}

export default function StudentTable({ classId }) {
  const router = useRouter();
  const {
    classItem,
    students,
    kpis,
    loading,
    error,
    refresh,
    viewQuarter,
    setViewQuarter,
    termOptions,
  } = useClassDetails(classId);
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const { showToast } = useAppToast();

  const displayKpis = useMemo(() => {
    if (!kpis?.length) return kpis;
    return kpis.map((kpi) =>
      kpi.id === "quarter"
        ? { ...kpi, label: "Term", value: termLabel(viewQuarter) }
        : kpi
    );
  }, [kpis, viewQuarter]);

  function handleTermChange(nextTerm) {
    const n = Number(nextTerm);
    const target = termOptions.find((opt) => opt.value === n);
    if (target?.classId && target.classId !== classId) {
      const path = window.location.pathname.includes("/students")
        ? `/teacher/my-classes/${target.classId}/students`
        : `/teacher/my-classes/${target.classId}`;
      router.push(path);
      return;
    }
    setViewQuarter(n);
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.studentNumber.toLowerCase().includes(query)
    );
  }, [students, search]);

  async function openUpload() {
    const session = await getCurrentTeacherSession();
    setTeacherId(session.data?.teacherId ?? null);
    setUploadOpen(true);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading student list...
      </div>
    );
  }

  if (error || !classItem) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
        {error || "Class not found."}
      </div>
    );
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
            <PageBreadcrumb
              items={[
                { label: "My Classes", href: "/teacher/my-classes" },
                { label: classItem.subject, href: `/teacher/my-classes/${classItem.id}` },
                { label: "Students" },
              ]}
            />
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              {classItem.subject} — Students
            </h1>
          </div>

          <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        <Link
          href={`/teacher/my-classes/${classItem.id}`}
          className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft size={12} />
          Back
        </Link>
      </header>

      <SummaryKpiCards kpis={displayKpis} />

      {!students.length ? (
        <div className="mt-4">
          <EmptyLearnersState
            title="No learners available."
            description="Upload an official DepEd E-Class Record to import students for this class."
            onUpload={openUpload}
          />
        </div>
      ) : (
        <>
          <section className="mt-4 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="relative block max-w-md flex-1">
                <span className="sr-only">Search student</span>
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or student number..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                />
              </label>
              <div className="block sm:w-52">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Term
                </span>
                <AppSelect
                  label="Term"
                  value={String(viewQuarter)}
                  onChange={handleTermChange}
                  options={(termOptions?.length
                    ? termOptions
                    : [1, 2, 3, 4].map((q) => ({
                        value: q,
                        label: termLabel(q),
                      }))
                  ).map((opt) => ({
                    value: String(opt.value),
                    label: opt.label,
                  }))}
                  size="field"
                  triggerClassName="h-9 rounded-lg text-[12px]"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {filtered.length} of {students.length} students · KPIs use{" "}
              {termLabel(viewQuarter)}. Final is the overall of available Terms
              1–3.
            </p>
          </section>

          <section className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="min-w-[880px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Student Number
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Learner Name
                    </th>
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Sex
                    </th>
                    {GRADE_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          "px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.08em]",
                          Number(viewQuarter) === column.term
                            ? "bg-green-50 text-cnhs-green-dark"
                            : "text-slate-400"
                        )}
                      >
                        {column.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr
                      key={student.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-600">
                        {student.studentNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold",
                              avatarTones[student.avatarTone] ?? avatarTones.green
                            )}
                          >
                            {student.initials}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {student.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {student.gender}
                      </td>
                      {GRADE_COLUMNS.map((column) => (
                        <GradeCell
                          key={column.key}
                          value={gradeValue(student, column.key)}
                          active={Number(viewQuarter) === column.term}
                        />
                      ))}
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/teacher/my-classes/${classItem.id}/students/${student.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark hover:bg-green-50"
                        >
                          <Eye size={12} />
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <EClassUploadDialog
        open={uploadOpen}
        classItem={classItem}
        teacherId={teacherId}
        onClose={() => setUploadOpen(false)}
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
    </motion.div>
  );
}
