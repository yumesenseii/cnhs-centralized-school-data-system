"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Folder, Loader2, Menu, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AralSectionWorkspace from "@/components/teacher/aral-program/AralSectionWorkspace";
import { resolveTeacherSessionForMonitoring } from "@/lib/supabase/queries/monitoring";
import { listMyAralFacilitatorAssignments } from "@/lib/supabase/queries/aralProgram";
import { groupAralAssignmentsBySection } from "@/lib/reports/aralWeeklyProgressExport";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import { cn } from "@/lib/utils";

export default function TeacherAralProgramPage() {
  const [menuOpen, setMenuOpen] = useState(false);
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
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <span className="font-semibold text-slate-600">ARAL Program</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800">
            Summer ARAL Program
          </h1>
          <p className="mt-0.5 text-[12px] text-slate-500">
            Open a section folder for weekly, assessment, and report files.
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
      </header>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading assignments…
        </div>
      ) : activeGroup ? (
        <AralSectionWorkspace
          group={activeGroup}
          teacherName={teacherName}
          teacherId={teacherId}
          onBack={() => setActiveSectionKey(null)}
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-50 bg-sky-50/40 px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-sky-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                My sections
              </h2>
            </div>
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              {assignments.length} learner
              {assignments.length === 1 ? "" : "s"} · {sectionGroups.length}{" "}
              section{sectionGroups.length === 1 ? "" : "s"}
            </span>
          </div>

          {sectionGroups.length ? (
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
              {sectionGroups.map((group) => (
                <button
                  key={group.gradeSection}
                  type="button"
                  onClick={() => setActiveSectionKey(group.gradeSection)}
                  className={cn(
                    "group flex cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-sky-200 hover:bg-sky-50/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                      <Folder size={18} strokeWidth={1.75} />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                      File cabinet
                    </span>
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                      Weekly · Pre/Mid/Post · Report
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                    <span className="text-[11px] text-slate-400">
                      Open workspace
                    </span>
                    <span className="text-[11px] font-semibold text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-[12px] text-slate-400">
              You have no Summer ARAL facilitator assignments yet. The Head
              Teacher assigns facilitators on Academic Monitoring.
            </div>
          )}
        </section>
      )}
    </motion.div>
  );
}
