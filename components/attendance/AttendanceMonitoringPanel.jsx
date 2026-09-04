"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Upload } from "lucide-react";
import {
  getSectionAttendanceAnalytics,
  invalidateAttendanceAnalyticsCache,
} from "@/lib/supabase/queries/attendance";
import {
  AttendanceKpi,
  fmtAttendance,
} from "@/components/attendance/attendanceUiShared";

/**
 * Compact attendance snapshot for teacher dashboard.
 * Full pages use TeacherAttendancePanel / AdminAttendancePanel.
 */
export default function AttendanceMonitoringPanel({
  compact = false,
  refreshToken = 0,
  onRefreshingChange,
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
        Use the Teacher or Head Teacher attendance page for the full SF2
        experience.
      </p>
    );
  }

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-8 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Loading attendance…
      </div>
    );
  }

  if (!analytics?.hasData) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <CalendarDays size={16} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Attendance
              </h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                No SF2 monthly summary yet.
              </p>
            </div>
          </div>
          <a
            href="/teacher/attendance"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
          >
            <Upload size={13} />
            Upload SF2
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Attendance snapshot
        </h3>
        <a
          href="/teacher/attendance"
          className="text-[11px] font-semibold text-cnhs-green-dark hover:underline"
        >
          My section →
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AttendanceKpi
          label="Avg ADA"
          value={fmtAttendance(analytics.avgAda)}
          tone="bg-green-50"
        />
        <AttendanceKpi
          label="Avg PA"
          value={fmtAttendance(analytics.avgPa, "%")}
          tone="bg-sky-50"
        />
        <AttendanceKpi
          label="Absences"
          value={fmtAttendance(analytics.totalAbsences)}
          tone="bg-orange-50"
        />
        <AttendanceKpi
          label="Flagged"
          value={analytics.flaggedSections.length}
          tone="bg-red-50"
        />
      </div>
    </section>
  );
}
