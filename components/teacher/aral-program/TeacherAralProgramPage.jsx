"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, Folder, Loader2 } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AralSectionWorkspace from "@/components/teacher/aral-program/AralSectionWorkspace";
import PageHelp from "@/components/shared/PageHelp";
import { resolveTeacherSessionForMonitoring } from "@/lib/supabase/queries/monitoring";
import { listMyAralFacilitatorAssignments } from "@/lib/supabase/queries/aralProgram";
import { groupAralAssignmentsBySection } from "@/lib/reports/aralWeeklyProgressExport";
import { cn } from "@/lib/utils";

export default function TeacherAralProgramPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [teacherName, setTeacherName] = useState("Facilitator");
  const [teacherId, setTeacherId] = useState(null);
  const [activeSectionKey, setActiveSectionKey] = useState(null);

  const sectionGroups = useMemo(
    () => groupAralAssignmentsBySection(assignments),
    [assignments]
  );

  const activeGroup = useMemo(
    () =>
      sectionGroups.find((g) => g.gradeSection === activeSectionKey) ?? null,
    [sectionGroups, activeSectionKey]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data?.teacherId) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setLoading(false);
      return;
    }

    setTeacherId(session.data.teacherId);

    const profile = session.data.profile;
    const teacher = session.data.teacher;
    if (teacher) {
      const parts = [teacher.first_name, teacher.middle_name, teacher.last_name]
        .map((p) => String(p ?? "").trim())
        .filter(Boolean);
      setTeacherName(
        parts.join(" ") || teacher.email || profile?.full_name || "Facilitator"
      );
    } else if (profile?.full_name) {
      setTeacherName(profile.full_name);
    }

    const result = await listMyAralFacilitatorAssignments(
      session.data.teacherId
    );
    if (result.error) {
      setError(result.error.message);
      setAssignments([]);
    } else {
      setAssignments(result.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (
      activeSectionKey &&
      !sectionGroups.some((g) => g.gradeSection === activeSectionKey)
    ) {
      setActiveSectionKey(null);
    }
  }, [sectionGroups, activeSectionKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            {activeGroup ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSectionKey(null)}
                  className="cursor-pointer font-medium text-slate-400 hover:text-slate-600"
                >
                  ARAL Program
                </button>
                <span className="text-slate-300"> &gt; </span>
                <span className="font-semibold text-slate-600">
                  {activeGroup.gradeSection}
                </span>
              </>
            ) : (
              <span className="font-semibold text-slate-600">ARAL Program</span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <PageHelp
              summary="Facilitator workspace for assigned ARAL Learners sections."
              steps={[
                "Open a section folder assigned to you by the Head Teacher.",
                "Weekly: mark Mon–Fri session, then topic, skill, progress, and remarks — Save.",
                "Pre / Mid / Post: enter scores in the portal (no file upload required).",
                "Report: review summary cover and detailed results from saved scores only.",
                "Blank session marks are not treated as Absent. Do not invent learner rows.",
              ]}
            />
            <MobileNavSheet
              ariaLabel="Open teacher menu"
              title="Teacher navigation"
            >
              {(close) => <TeacherSidebar mobile onNavigate={close} />}
            </MobileNavSheet>
          </div>
        </div>

        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-800">
              {activeGroup ? activeGroup.gradeSection : "ARAL Program"}
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {activeGroup
                ? `${activeGroup.count} learner${activeGroup.count === 1 ? "" : "s"}${
                    activeGroup.schoolYear ? ` · ${activeGroup.schoolYear}` : ""
                  } · Facilitator: ${teacherName}`
                : "Open a section to record weekly sessions, Pre / Mid / Post scores, and the section report."}
            </p>
          </div>
          {activeGroup ? (
            <button
              type="button"
              onClick={() => setActiveSectionKey(null)}
              className="mt-0.5 inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-transparent px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/6"
            >
              <ChevronLeft size={12} />
              All sections
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading assignments…
        </div>
      ) : activeGroup ? (
        <AralSectionWorkspace
          group={activeGroup}
          teacherName={teacherName}
          teacherId={teacherId}
        />
      ) : (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800">My sections</h2>
            <span className="text-[11px] font-medium text-slate-500">
              {assignments.length} learner
              {assignments.length === 1 ? "" : "s"} · {sectionGroups.length}{" "}
              section{sectionGroups.length === 1 ? "" : "s"}
            </span>
          </div>

          {sectionGroups.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {sectionGroups.map((group) => (
                <button
                  key={group.gradeSection}
                  type="button"
                  onClick={() => setActiveSectionKey(group.gradeSection)}
                  className={cn(
                    "group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/50 dark:border-white/10 dark:bg-[#1c1c1c] dark:hover:border-cnhs-green/35 dark:hover:bg-white/4"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cnhs-green-soft text-cnhs-green-dark ring-1 ring-cnhs-green/20">
                      <Folder size={18} strokeWidth={1.75} />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cnhs-green-soft px-2 py-0.5 text-[10px] font-semibold text-cnhs-green-dark ring-1 ring-cnhs-green/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-cnhs-green-dark" />
                      Assigned
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
                    {group.gradeSection}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {group.count} ARAL learner{group.count === 1 ? "" : "s"}
                    {group.schoolYear ? ` · ${group.schoolYear}` : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100 dark:bg-white/4 dark:ring-white/10">
                      Weekly · Pre · Mid · Post · Report
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/10">
                    <span className="text-[11px] text-slate-400">
                      Open workspace
                    </span>
                    <span className="text-[11px] font-semibold text-cnhs-green-dark opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-left sm:text-center">
              <p className="text-sm font-semibold text-slate-700">
                No ARAL sections assigned yet
              </p>
              <p className="mt-1.5 max-w-md text-[12px] leading-5 text-slate-500 sm:mx-auto">
                Folders appear after the Head Teacher assigns you as facilitator
                for ARAL Learners on Academic Monitoring.
              </p>
              <p className="mt-2 text-[11px] font-medium text-slate-500">
                Next: ask HT to assign you, or open{" "}
                <Link
                  href="/teacher/monitoring"
                  className="font-semibold text-cnhs-green-dark hover:underline"
                >
                  Academic Monitoring
                </Link>{" "}
                for your class recommendations.
              </p>
            </div>
          )}
        </section>
      )}
    </motion.div>
  );
}
