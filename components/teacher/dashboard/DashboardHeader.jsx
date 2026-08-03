"use client";

import { useState } from "react";
import { CalendarDays, Layers3, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function DashboardHeader({ controls }) {
  const [open, setOpen] = useState(false);

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
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="Open teacher menu"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 lg:hidden"
              />
            }
          >
            <Menu size={18} aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className={SIDEBAR_SHEET_CLASS}
          >
            <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
            <TeacherSidebar mobile onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <label className="relative">
          <span className="sr-only">School Year</span>
          <CalendarDays
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={controls.schoolYear}
            onChange={(event) =>
              controls.onSchoolYearChange?.(event.target.value)
            }
            className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green"
          >
            {controls.schoolYears?.length ? (
              controls.schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            ) : (
              <option value="">No school years</option>
            )}
          </select>
        </label>

        <label className="relative">
          <span className="sr-only">Term</span>
          <Layers3
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <select
            value={controls.quarterValue}
            onChange={(event) =>
              controls.onQuarterChange?.(event.target.value)
            }
            className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green"
          >
            {(controls.quarters?.length ? controls.quarters : ["1"]).map(
              (quarter) => (
                <option key={quarter} value={quarter}>
                  Term {quarter}
                </option>
              )
            )}
          </select>
        </label>

        <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
          <CalendarDays size={12} className="text-slate-400" />
          {controls.currentDate}
        </div>
      </div>
    </header>
  );
}
