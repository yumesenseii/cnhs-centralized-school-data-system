"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Clock, TrendingUp, Users } from "lucide-react";

export default function AttendanceOverview({ summary }) {
  const avgPa = summary?.avgPa ?? "—";
  const issuesCount = summary?.issuesCount ?? 0;
  const avgAda = summary?.avgAda ?? "—";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
            <CalendarCheck size={15} className="text-cnhs-green-dark" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
              Attendance Overview
            </h2>
          </div>
        </div>

        <Link
          href="/teacher/attendance"
          className="inline-flex items-center gap-1 self-start text-xs font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54] sm:self-auto"
        >
          View Attendance
          <ArrowRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center gap-3.5 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cnhs-green-soft text-cnhs-green-dark">
            <TrendingUp size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Average Attendance
            </p>
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {avgPa}
            </p>
            <p className="text-[10px] text-slate-400">
              Overall percentage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Users size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Learners With Attendance Issues
            </p>
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {issuesCount}
            </p>
            <p className="text-[10px] text-slate-400">
              Flagged for consecutive absences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 p-4 sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <Clock size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-500">
              Average Daily Attendance
            </p>
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {avgAda}
            </p>
            <p className="text-[10px] text-slate-400">
              Mean learners present per day
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
