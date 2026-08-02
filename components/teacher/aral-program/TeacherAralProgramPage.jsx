"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Menu, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import { resolveTeacherSessionForMonitoring } from "@/lib/supabase/queries/monitoring";
import { listMyAralFacilitatorAssignments } from "@/lib/supabase/queries/aralProgram";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function TeacherAralProgramPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignments, setAssignments] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data?.teacherId) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setLoading(false);
      return;
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
            Learners assigned to you as facilitator. Submit weekly progress
            updates for Head Teacher review.
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

      <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-2 border-b border-sky-50 bg-sky-50/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-sky-700" />
            <h2 className="text-sm font-semibold text-slate-900">
              My ARAL Learners
            </h2>
          </div>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
            {assignments.length} assigned
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading assignments…
          </div>
        ) : assignments.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  {["Learner", "Grade & Section", "Subject", "Batch", "Action"].map(
                    (column) => (
                      <th
                        key={column}
                        className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                      >
                        {column}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {assignments.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-slate-50/70"
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
                      {row.gradeSection}
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
                          className="inline-flex h-8 items-center rounded-lg bg-cnhs-green-dark px-2.5 text-[11px] font-semibold text-white hover:bg-[#246f54]"
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
