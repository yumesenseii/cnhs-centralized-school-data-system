"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Upload } from "lucide-react";
import {
  getSectionAttendanceAnalytics,
  invalidateAttendanceAnalyticsCache,
} from "@/lib/supabase/queries/attendance";
import {
  fmtAttendance,
} from "@/components/attendance/attendanceUiShared";
import { cn } from "@/lib/utils";

/**
 * Compact attendance snapshot for teacher / HT dashboard.
 * Full pages use TeacherAttendancePanel / AdminAttendancePanel.
 */
export default function AttendanceMonitoringPanel({
  compact = false,
  refreshToken = 0,
  onRefreshingChange,
  linkHref = "/teacher/attendance",
  linkLabel = "My section →",
}) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      onRefreshingChange?.(true);
      if (refreshToken > 0) invalidateAttendanceAnalyticsCache();
      const result = await getSectionAttendanceAnalytics({});
      if (!cancelled) {
        if (!result.error) setAnalytics(result.data);
        setLoading(false);
        onRefreshingChange?.(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshToken, onRefreshingChange]);

  if (!compact) {
    return (
      <p className="text-sm text-slate-500">
        Use the Teacher or School Principal attendance page for the full SF2
        experience.
      </p>
    );
  }

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-4 text-[12px] text-slate-500">
        <Loader2 size={14} className="animate-spin" />
        Loading attendance…
      </div>
    );
  }

  if (!analytics?.hasData) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <CalendarDays size={14} />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900">
                Attendance
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                No SF2 monthly summary yet.
              </p>
            </div>
          </div>
          <a
            href={linkHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-2.5 text-[11px] font-semibold text-white hover:bg-[#246f54]"
          >
            <Upload size={12} />
            Upload SF2
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-slate-900">
          Attendance snapshot
        </h3>
        <a
          href={linkHref}
          className="text-[11px] font-semibold text-cnhs-green-dark hover:underline"
        >
          {linkLabel}
        </a>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <DenseKpi
          label="Avg ADA"
          value={fmtAttendance(analytics.avgAda)}
          tone="bg-green-50"
        />
        <DenseKpi
          label="Avg PA"
          value={fmtAttendance(analytics.avgPa, "%")}
          tone="bg-sky-50"
        />
        <DenseKpi
          label="Absences"
          value={fmtAttendance(analytics.totalAbsences)}
          tone="bg-orange-50"
        />
        <DenseKpi
          label="Flagged"
          value={analytics.flaggedSections.length}
          tone="bg-red-50"
        />
      </div>
    </section>
  );
}

function DenseKpi({ label, value, tone }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5",
        tone
      )}
    >
      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-500">
        {label}
      </p>
      <p className="text-[15px] font-semibold tabular-nums tracking-tight text-slate-900">
        {value ?? "—"}
      </p>
    </div>
  );
}
