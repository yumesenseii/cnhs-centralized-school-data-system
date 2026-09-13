"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardCheck, Loader2 } from "lucide-react";
import {
  computeMonthCloseMetrics,
  rosterSexCounts,
} from "@/lib/attendance/dailyAnalytics";
import { upsertSectionMonthClose } from "@/lib/supabase/queries/attendanceMonthClose";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

function DateList({ title, dates, empty, hint }) {
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-700">
        {dates?.length ? dates.join(", ") : empty}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default function DailyMonthCloseModal({
  open,
  summary,
  schoolYear,
  onCancel,
  onSaved,
}) {
  const existing = summary?.monthClose || null;
  const sexCounts = rosterSexCounts(summary?.learners ?? []);
  const [schoolDays, setSchoolDays] = useState("");
  const [ffM, setFfM] = useState(0);
  const [ffF, setFfF] = useState(0);
  const [eomM, setEomM] = useState(0);
  const [eomF, setEomF] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !summary) return;
    if (existing) {
      setSchoolDays(String(existing.schoolDays ?? ""));
      setFfM(existing.ffM);
      setFfF(existing.ffF);
      setEomM(existing.eomM);
      setEomF(existing.eomF);
      setNotes(existing.notes || "");
    } else {
      setSchoolDays("");
      setFfM(sexCounts.m);
      setFfF(sexCounts.f);
      setEomM(sexCounts.m);
      setEomF(sexCounts.f);
      setNotes("");
    }
    setError("");
  }, [open, summary?.month, summary?.section?.id, existing?.id]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape" && !saving) onCancel?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onCancel]);

  const days = Number(schoolDays);
  const validDays = Number.isInteger(days) && days > 0;
  const metrics = useMemo(
    () =>
      computeMonthCloseMetrics({
        presentDays: summary?.presentDays?.total || 0,
        schoolDays: validDays ? days : null,
        eomM,
        eomF,
      }),
    [summary?.presentDays?.total, days, validDays, eomM, eomF]
  );

  if (!open || !summary || typeof document === "undefined") return null;

  async function handleSave() {
    if (!validDays) {
      setError("Enter days of classes (whole number greater than 0).");
      return;
    }
    setSaving(true);
    setError("");
    const result = await upsertSectionMonthClose({
      sectionId: summary.section?.id,
      schoolYear,
      month: summary.month,
      schoolDays: days,
      ffM,
      ffF,
      eomM,
      eomF,
      notes,
    });
    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSaved?.(result.data);
  }

  return createPortal(
    <div
      className={cn(VIEW_MODAL_BACKDROP, "z-[100]")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-close-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel?.();
      }}
    >
      <div className="relative z-10 flex max-h-[86vh] w-[min(36rem,94vw)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="overflow-y-auto px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark">
              <ClipboardCheck size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id="month-close-title"
                className="text-[16px] font-semibold tracking-tight text-slate-900"
              >
                {existing ? "Review" : "Close"} {summary.monthName}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                From daily records + adviser month close. Check before signing
                official SF2. Holiday / no class = skip — do not count as
                absent.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <DateList
              title="Days with AM+PM saved"
              dates={summary.completeDates}
              empty="None yet"
            />
            <DateList
              title="Incomplete (AM or PM only)"
              dates={summary.incompleteDates}
              empty="None"
              hint="Not counted as present or absent."
            />
            <DateList
              title="Weekdays with no save (hint only)"
              dates={summary.weekdayHints}
              empty="None"
              hint="Not official school days. May be holidays or skipped days."
            />
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Present day = AM Present and PM Present. Absent day = both sessions
            saved and at least one is not Present.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-medium text-slate-500">
              Days of classes
              <input
                type="number"
                min={1}
                step={1}
                value={schoolDays}
                onChange={(e) => setSchoolDays(e.target.value)}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-800"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              1st Friday · M
              <input
                type="number"
                min={0}
                step={1}
                value={ffM}
                onChange={(e) => setFfM(Number(e.target.value) || 0)}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-800"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              1st Friday · F
              <input
                type="number"
                min={0}
                step={1}
                value={ffF}
                onChange={(e) => setFfF(Number(e.target.value) || 0)}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-800"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              End of month · M
              <input
                type="number"
                min={0}
                step={1}
                value={eomM}
                onChange={(e) => setEomM(Number(e.target.value) || 0)}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-800"
              />
            </label>
            <label className="text-[11px] font-medium text-slate-500">
              End of month · F
              <input
                type="number"
                min={0}
                step={1}
                value={eomF}
                onChange={(e) => setEomF(Number(e.target.value) || 0)}
                className="mt-1 block h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-800"
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            1st Friday / EOM prefilled from current roster ({sexCounts.m} M ·{" "}
            {sexCounts.f} F). Edit if enrolment changed.
          </p>

          <label className="mt-3 block text-[11px] font-medium text-slate-500">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] text-slate-800"
            />
          </label>

          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Computed (read-only)
            </p>
            {validDays ? (
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-slate-700 sm:grid-cols-3">
                <p>
                  Present days{" "}
                  <span className="font-semibold">
                    {summary.presentDays?.m ?? 0}M · {summary.presentDays?.f ?? 0}
                    F · {summary.presentDays?.total ?? 0}
                  </span>
                </p>
                <p>
                  Absent days{" "}
                  <span className="font-semibold">
                    {summary.absentDays?.m ?? 0}M · {summary.absentDays?.f ?? 0}F
                    · {summary.absentDays?.total ?? 0}
                  </span>
                </p>
                <p>
                  ADA{" "}
                  <span className="font-semibold tabular-nums">
                    {metrics.ada ?? "—"}
                  </span>
                </p>
                <p>
                  % attendance{" "}
                  <span className="font-semibold tabular-nums">
                    {metrics.attendancePercent != null
                      ? `${metrics.attendancePercent}%`
                      : "—"}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-1 text-[12px] text-slate-500">
                Enter days of classes to see ADA.
              </p>
            )}
          </div>

          {error ? (
            <p className="mt-2 text-[12px] text-red-600">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !validDays}
            onClick={handleSave}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {existing ? "Update close" : "Save close"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
