"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Download,
  Loader2,
  Menu,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import { resolveTeacherSessionForMonitoring } from "@/lib/supabase/queries/monitoring";
import { listMyAralFacilitatorAssignments } from "@/lib/supabase/queries/aralProgram";
import {
  exportAralWeeklyProgressBySectionExcel,
  groupAralAssignmentsBySection,
} from "@/lib/reports/aralWeeklyProgressExport";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import { cn } from "@/lib/utils";

export default function TeacherAralProgramPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [teacherName, setTeacherName] = useState("Facilitator");
  const [openSections, setOpenSections] = useState({});
  const [exportingSection, setExportingSection] = useState("");

  const sectionGroups = useMemo(
    () => groupAralAssignmentsBySection(assignments),
    [assignments]
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
    if (!sectionGroups.length) {
      setOpenSections({});
      return;
    }
    setOpenSections((prev) => {
      const next = { ...prev };
      for (const group of sectionGroups) {
        if (next[group.gradeSection] === undefined) {
          next[group.gradeSection] = true;
        }
      }
      return next;
    });
  }, [sectionGroups]);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleExportSection(group) {
    setToast("");
    setError("");
    setExportingSection(group.gradeSection);
    try {
      const result = await exportAralWeeklyProgressBySectionExcel({
        learners: group.learners,
        gradeSection: group.gradeSection,
        schoolYear: group.schoolYear,
        generatedBy: teacherName,
        facilitatorName: teacherName,
      });
      setToast(
        `Exported ${result.count} row(s) for ${group.gradeSection} (${result.filename}).`
      );
    } catch (err) {
      setError(err?.message ?? "Unable to export ARAL weekly progress.");
    } finally {
      setExportingSection("");
    }
  }

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
            Learners assigned to you as facilitator. Submit weekly progress, or
            export an Excel weekly report by section.
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
      {toast ? (
        <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-50 bg-sky-50/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-sky-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              My ARAL Learners by Section
            </h2>
          </div>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
            {assignments.length} learner
            {assignments.length === 1 ? "" : "s"} · {sectionGroups.length}{" "}
            section{sectionGroups.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading assignments…
          </div>
        ) : sectionGroups.length ? (
          <div className="divide-y divide-slate-100">
            {sectionGroups.map((group) => {
              const open = Boolean(openSections[group.gradeSection]);
              const exporting = exportingSection === group.gradeSection;
              return (
                <div key={group.gradeSection}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
                    <button
                      type="button"
                      onClick={() => toggleSection(group.gradeSection)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                    >
                      <ChevronDown
                        size={16}
                        className={cn(
                          "shrink-0 text-slate-400 transition-transform",
                          open ? "rotate-180" : ""
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800">
                          {group.gradeSection}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {group.count} ARAL learner
                          {group.count === 1 ? "" : "s"}
                          {group.schoolYear ? ` · ${group.schoolYear}` : ""}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={exporting}
                      onClick={() => handleExportSection(group)}
                      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exporting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      Export Excel
                    </button>
                  </div>

                  {open ? (
                    <div className="overflow-x-auto border-t border-slate-50 bg-slate-50/30">
                      <table className="min-w-[680px] w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50/80">
                            {[
                              "Learner",
                              "Subject",
                              "Batch",
                              "Action",
                            ].map((column) => (
                              <th
                                key={column}
                                className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.learners.map((row) => (
                            <tr
                              key={row.id}
                              className="border-t border-slate-100 hover:bg-white/80"
                            >
                              <td className="px-3 py-2">
                                <p className="text-[12px] font-semibold text-slate-800">
                                  {row.studentName}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {row.studentNumber}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-[12px] text-slate-600">
                                {row.subject}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-slate-600">
                                {row.batchName}
                                <span className="block text-[10px] text-slate-400">
                                  {row.schoolYear}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {row.sourceClassId ? (
                                  <Link
                                    href={`/teacher/monitoring/${row.sourceClassId}/students/${row.studentId}`}
                                    className="inline-flex h-7 items-center rounded-full bg-cnhs-green-dark px-2.5 text-[10px] font-semibold text-white hover:bg-[#246f54]"
                                  >
                                    Weekly Progress
                                  </Link>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    No source class linked
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-[12px] text-slate-400">
            You have no Summer ARAL facilitator assignments yet. The Head
            Teacher assigns facilitators on Academic Monitoring.
          </div>
        )}
      </section>
    </motion.div>
  );
}
