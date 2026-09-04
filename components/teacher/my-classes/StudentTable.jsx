"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, Search } from "lucide-react";
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

const avatarTones = {
  red: "bg-red-100 text-red-700",
  green: "bg-green-100 text-cnhs-green-dark",
  blue: "bg-sky-100 text-sky-700",
};

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
  const [toast, setToast] = useState("");

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

      {toast ? (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

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
              <label className="block sm:w-52">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Term
                </span>
                <select
                  value={String(viewQuarter)}
                  onChange={(e) => handleTermChange(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-cnhs-green"
                >
                  {(termOptions?.length
                    ? termOptions
                    : [1, 2, 3, 4].map((q) => ({
                        value: q,
                        label: termLabel(q),
                      }))
                  ).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {filtered.length} of {students.length} students · showing{" "}
              {termLabel(viewQuarter)} grades
            </p>
          </section>

          <section className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    {[
                      "Student Number",
                      "Learner Name",
                      "Gender",
                      "Current General Average",
                      "Action",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                      >
                        {column === "Current General Average"
                          ? `${termLabel(viewQuarter)} Grade`
                          : column}
                      </th>
                    ))}
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
                      <td className="px-3 py-2.5 text-xs text-slate-600">{student.gender}</td>
                      <td
                        className={cn(
                          "px-3 py-2.5 text-xs font-semibold",
                          student.averageGrade !== null && student.averageGrade < 75
                            ? "text-red-600"
                            : "text-slate-700"
                        )}
                      >
                        {student.averageGrade ?? "—"}
                      </td>
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
          setToast(
            `Imported ${learners} learner${learners === 1 ? "" : "s"}${
              grades ? ` and ${grades} grade record${grades === 1 ? "" : "s"}` : ""
            }.`
          );
          await refresh();
          window.setTimeout(() => setToast(""), 3200);
        }}
      />
    </motion.div>
  );
}
