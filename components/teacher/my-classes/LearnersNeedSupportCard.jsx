"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Info, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAralLanguageSubject } from "@/lib/monitoring/aralAcademicStatus";
import { calculateLearnerTrajectory } from "@/lib/monitoring/gradeTrajectoryForecaster";

export default function LearnersNeedSupportCard({
  classItem = {},
  students = [],
  currentTerm = 1,
  onOpenRemedial,
  onViewMasterList,
}) {
  const [filter, setFilter] = useState("all"); // "all" | "critical" | "watchlist"
  const isLanguage = isAralLanguageSubject(classItem.subject);

  // Compute trajectories and filter learners
  const supportLearners = useMemo(() => {
    return students
      .map((student) => {
        const traj = calculateLearnerTrajectory(student, currentTerm);
        return {
          student,
          ...traj,
        };
      })
      .filter((item) => item.isFailing || item.isWatchlist)
      .sort((a, b) => (a.currentGrade ?? 99) - (b.currentGrade ?? 99));
  }, [students, currentTerm]);

  const criticalList = useMemo(
    () => supportLearners.filter((l) => l.isFailing),
    [supportLearners]
  );
  const watchlistList = useMemo(
    () => supportLearners.filter((l) => l.isWatchlist),
    [supportLearners]
  );

  const displayedList = useMemo(() => {
    if (filter === "critical") return criticalList;
    if (filter === "watchlist") return watchlistList;
    return supportLearners;
  }, [filter, criticalList, watchlistList, supportLearners]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle size={15} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {isLanguage ? "Phil-IRI & ARAL Prevention Spotlight" : "Learners Needing Support Spotlight"}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isLanguage
                ? "Agapan ang mga mag-aaral na ito sa klase upang hindi mapunta sa Phil-IRI testing o ARAL program."
                : "Mga mag-aaral na may markang mas mababa sa 75 o muntik nang bumagsak."}
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
              filter === "all"
                ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300"
            )}
          >
            All ({supportLearners.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("critical")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
              filter === "critical"
                ? "bg-red-600 text-white"
                : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
            )}
          >
            Below 75 ({criticalList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("watchlist")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
              filter === "watchlist"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
            )}
          >
            Watchlist ({watchlistList.length})
          </button>
        </div>
      </div>

      {/* Learners List */}
      {displayedList.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
          <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            Walang mag-aaral sa kategoryang ito!
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Lahat ng mga mag-aaral ay ligtas at nakapasa.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5 max-h-[320px] overflow-y-auto pr-1">
          {displayedList.map(({ student, currentGrade, prevGrade, delta, isFailing }) => (
            <li
              key={student.id}
              className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 rounded-xl px-2 transition"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {student.name}
                  </p>
                  <span className="text-[10px] font-medium text-slate-400">
                    {student.sex ? `(${student.sex[0]})` : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10.5px]">
                  <span className="text-slate-500">
                    LRN: {student.studentNumber || "—"}
                  </span>
                  {delta !== 0 && (
                    <span
                      className={cn(
                        "font-semibold",
                        delta > 0 ? "text-emerald-600" : "text-red-500"
                      )}
                    >
                      {delta > 0 ? `↑ +${delta} pts` : `↓ ${delta} pts`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold",
                      isFailing
                        ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                    )}
                  >
                    {currentGrade ?? "—"}
                  </span>
                  <span className="block text-[9.5px] mt-0.5 font-medium text-slate-400">
                    {isFailing ? "Below 75" : "Borderline"}
                  </span>
                </div>

                <Link
                  href={`/teacher/my-classes/${classItem.id}/students/${student.id}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition shadow-2xs dark:border-white/10 dark:bg-white/5"
                  title="View Learner Profile"
                >
                  <ChevronRight size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {supportLearners.length > 0 && onViewMasterList && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="text-[11px]">
            Showing {displayedList.length} of {supportLearners.length} flagged learners
          </span>
          <button
            type="button"
            onClick={onViewMasterList}
            className="inline-flex items-center gap-1 font-semibold text-[#246f54] hover:underline cursor-pointer dark:text-emerald-400 text-[11px]"
          >
            View Master Class List →
          </button>
        </div>
      )}
    </section>
  );
}
