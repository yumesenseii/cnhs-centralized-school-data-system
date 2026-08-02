"use client";

import { useEffect, useState } from "react";
import { CalendarDays, FileUp, Loader2 } from "lucide-react";
import {
  getAttendanceAnalytics,
  importSf2Attendance,
  listAttendanceUploads,
} from "@/lib/supabase/queries/attendance";
import { createClient } from "@/lib/supabase/client";
import { ATTENDANCE_STATUS, MONTH_LABELS } from "@/lib/attendance/constants";
import { cn } from "@/lib/utils";

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-800">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

const statusStyles = {
  [ATTENDANCE_STATUS.NORMAL]: "bg-green-50 text-cnhs-green-dark",
  [ATTENDANCE_STATUS.WARNING]: "bg-amber-50 text-amber-700",
  [ATTENDANCE_STATUS.CRITICAL]: "bg-red-50 text-red-600",
};

/**
 * Shared Attendance Monitoring panel for teacher + admin dashboards/pages.
 * Completely separate from Academic Prediction.
 */
export default function AttendanceMonitoringPanel({
  title = "Attendance Analytics",
  showUpload = true,
  compact = false,
}) {
  const [analytics, setAnalytics] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({
    schoolYear: "SY 2026-2027",
    month: String(new Date().getMonth() + 1),
    sectionId: "",
    file: null,
  });

  async function reload() {
    setLoading(true);
    setError("");
    const [analyticsResult, uploadsResult] = await Promise.all([
      getAttendanceAnalytics({ schoolYear: form.schoolYear || null }),
      listAttendanceUploads(10),
    ]);
    if (analyticsResult.error) {
      setError(analyticsResult.error.message);
      setAnalytics(null);
    } else {
      setAnalytics(analyticsResult.data);
    }
    if (!uploadsResult.error) setUploads(uploadsResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const supabase = createClient();
      const { data: sectionRows } = await supabase
        .from("sections")
        .select("id, section_name, grade_level, school_year")
        .order("grade_level");
      if (!cancelled) setSections(sectionRows ?? []);
      await reload();
    }
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport(e) {
    e.preventDefault();
    setToast("");
    setError("");
    if (!form.file) {
      setError("Choose an SF2 Excel/CSV file first.");
      return;
    }
    setImporting(true);
    try {
      const buffer = await form.file.arrayBuffer();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let profileId = null;
      let teacherId = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        profileId = profile?.id ?? null;
        if (profile?.role === "teacher") {
          const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
          teacherId = teacher?.id ?? null;
        }
      }

      const result = await importSf2Attendance({
        fileBuffer: buffer,
        fileName: form.file.name,
        sectionId: form.sectionId || null,
        schoolYear: form.schoolYear,
        month: form.month,
        teacherId,
        profileId,
      });

      if (result.error) {
        setError(result.error.message);
      } else {
        setToast(
          `Imported ${result.data.imported} attendance row(s)${
            result.data.unmatched?.length
              ? ` · ${result.data.unmatched.length} unmatched LRN(s)`
              : ""
          }.`
        );
        setForm((prev) => ({ ...prev, file: null }));
        await reload();
      }
    } catch (err) {
      setError(err?.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={cn("space-y-3", compact ? "" : "pb-2")}>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Attendance Monitoring is separate from Academic Prediction. Risk scores
          use ECR grades only; SF2 attendance powers reports and 20% absence
          warnings.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading attendance analytics…
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Monthly Attendance Rate"
              value={
                analytics.monthlyAttendanceRate != null
                  ? `${analytics.monthlyAttendanceRate}%`
                  : "—"
              }
              hint={form.schoolYear || "All periods"}
            />
            <Stat
              label="Near 20% Absence"
              value={analytics.nearThresholdCount}
              hint="Warning or Critical status"
            />
            <Stat label="Present Days" value={analytics.presentTotal} />
            <Stat label="Absent Days" value={analytics.absentTotal} />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900">
                Present vs Absent
              </h3>
              <div className="mt-3 space-y-2">
                {analytics.presentVsAbsent.map((row) => {
                  const total =
                    analytics.presentTotal + analytics.absentTotal || 1;
                  const pct = Math.round((row.value / total) * 100);
                  return (
                    <div key={row.name}>
                      <div className="mb-1 flex justify-between text-[11px] text-slate-600">
                        <span>{row.name}</span>
                        <span>
                          {row.value} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: row.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900">
                Attendance Trends
              </h3>
              <div className="mt-3 space-y-2">
                {analytics.trends.length ? (
                  analytics.trends.map((row) => (
                    <div
                      key={`${row.schoolYear}-${row.month}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-[12px]"
                    >
                      <span className="font-medium text-slate-700">
                        {row.monthName} · {row.schoolYear}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {row.rate != null ? `${row.rate}%` : "—"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No attendance trends yet. Upload an SF2 file to begin.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-slate-900">
              Students Near 20% Absence
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[12px]">
                <thead className="bg-slate-50/80">
                  <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-3 py-2 font-semibold">Learner</th>
                    <th className="px-3 py-2 font-semibold">Absent %</th>
                    <th className="px-3 py-2 font-semibold">Attendance %</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.nearThresholdLearners.length ? (
                    analytics.nearThresholdLearners.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {row.learnerName}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.absencePercent != null
                            ? `${row.absencePercent}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.attendanceRate != null
                            ? `${row.attendanceRate}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
                              statusStyles[row.status] ??
                                "bg-slate-100 text-slate-500"
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-8 text-center text-xs text-slate-400"
                      >
                        No learners currently near the 20% absence threshold.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {showUpload ? (
        <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900">
            Upload SF2 Attendance
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Excel/CSV with columns: student_number, present, absent, late,
            school_days.
          </p>
          <form
            onSubmit={handleImport}
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="block text-[11px]">
              <span className="font-medium text-slate-500">School Year</span>
              <input
                value={form.schoolYear}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, schoolYear: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
              />
            </label>
            <label className="block text-[11px]">
              <span className="font-medium text-slate-500">Month</span>
              <select
                value={form.month}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, month: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
              >
                {MONTH_LABELS.map((label, index) => (
                  <option key={label} value={String(index + 1)}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px]">
              <span className="font-medium text-slate-500">Section</span>
              <select
                value={form.sectionId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sectionId: e.target.value }))
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-[12px] outline-none focus:border-cnhs-green"
              >
                <option value="">All / unspecified</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    Grade {section.grade_level} · {section.section_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[11px]">
              <span className="font-medium text-slate-500">SF2 file</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] ?? null,
                  }))
                }
                className="mt-1 block w-full text-[11px] text-slate-600"
              />
            </label>
            <button
              type="submit"
              disabled={importing}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors hover:bg-cnhs-green disabled:opacity-60 sm:col-span-2 lg:col-span-4"
            >
              {importing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileUp size={14} />
              )}
              Import SF2
            </button>
          </form>

          {uploads.length ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Recent uploads
              </p>
              <ul className="mt-2 space-y-1.5">
                {uploads.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600"
                  >
                    <CalendarDays size={12} className="text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {row.file_name || "SF2"}
                    </span>
                    <span>
                      {row.monthName} · {row.school_year} · {row.row_count} rows
                    </span>
                    <span className="ml-auto capitalize">{row.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
