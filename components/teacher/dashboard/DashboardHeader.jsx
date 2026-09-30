"use client";

import { CalendarDays, Layers3 } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";

export default function DashboardHeader({ controls }) {
  return (
    <header className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            Home <span className="text-slate-300">&gt;</span>{" "}
            <span className="font-semibold text-slate-600">Dashboard</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
            Teacher Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Your classes, learners, attendance, and tasks at a glance.
          </p>
        </div>

        <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
          {(close) => <TeacherSidebar mobile onNavigate={close} />}
        </MobileNavSheet>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <AppSelect
          label="School Year"
          value={controls.schoolYear}
          onChange={(next) => controls.onSchoolYearChange?.(next)}
          options={
            controls.schoolYears?.length
              ? controls.schoolYears
              : [{ value: "", label: "No school years" }]
          }
          icon={CalendarDays}
          size="pill"
          align="end"
          className="w-[168px]"
        />

        <AppSelect
          label="Term"
          value={controls.quarterValue}
          onChange={(next) => controls.onQuarterChange?.(next)}
          options={(controls.quarters?.length ? controls.quarters : ["1"]).map(
            (quarter) => ({
              value: String(quarter),
              label: `Term ${quarter}`,
            })
          )}
          icon={Layers3}
          size="pill"
          align="end"
          className="w-[132px]"
        />

        <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
          <CalendarDays size={12} className="text-slate-400" />
          {controls.currentDate}
        </div>
      </div>
    </header>
  );
}
