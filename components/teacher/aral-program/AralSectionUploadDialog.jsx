"use client";

import { useMemo, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import {
  ARAL_ASSESSMENT_PHASE,
  aralAssessmentPhaseLabel,
} from "@/lib/monitoring/aralAssessments";
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "weekly", label: "Weekly" },
  { id: ARAL_ASSESSMENT_PHASE.PRE, label: aralAssessmentPhaseLabel("pre") },
  { id: ARAL_ASSESSMENT_PHASE.MID, label: aralAssessmentPhaseLabel("mid") },
  { id: ARAL_ASSESSMENT_PHASE.POST, label: aralAssessmentPhaseLabel("post") },
];

/**
 * Compact upload dialog: pick file type, then choose Excel.
 */
export default function AralSectionUploadDialog({
  open,
  nextWeekNumber = 1,
  existingWeeks = [],
  existingPhases = [],
  uploading = false,
  onClose,
  onConfirm,
}) {
  const [kind, setKind] = useState("weekly");
  const [weekNumber, setWeekNumber] = useState(String(nextWeekNumber || 1));

  const weekOptions = useMemo(() => {
    const max = Math.max(Number(nextWeekNumber) || 1, ...existingWeeks, 1);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [nextWeekNumber, existingWeeks]);

  if (!open) return null;

  const isWeekly = kind === "weekly";
  const phaseExists = !isWeekly && existingPhases.includes(kind);
  const weekExists =
    isWeekly && existingWeeks.includes(Number(weekNumber) || 0);

  function handleSubmit(e) {
    e.preventDefault();
    onConfirm?.({
      kind: isWeekly ? "weekly" : "assessment",
      phase: isWeekly ? null : kind,
      weekNumber: isWeekly ? Number(weekNumber) || nextWeekNumber : null,
      replacing: isWeekly ? weekExists : phaseExists,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose?.();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-[min(520px,96vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">
              Upload file
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              Upload the downloaded weekly template or an assessment Scores
              sheet. Weekly files must use the locked columns (LRN, date,
              session, focus, progress). Extra columns are rejected.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={uploading}
            onClick={onClose}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            File type
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                disabled={uploading}
                onClick={() => setKind(type.id)}
                className={cn(
                  "h-9 rounded-lg border text-[12px] font-semibold",
                  kind === type.id
                    ? "border-cnhs-green-dark bg-cnhs-green-dark text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>

          {isWeekly ? (
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Week
              </span>
              <select
                value={weekNumber}
                disabled={uploading}
                onChange={(e) => setWeekNumber(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800"
              >
                {weekOptions.map((n) => (
                  <option key={n} value={n}>
                    Week {n}
                    {existingWeeks.includes(n) ? " (replace)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {weekExists || phaseExists ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
              This file already exists. Uploading will replace the saved data
              for this type.
            </p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[13px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            Choose Excel
          </button>
        </footer>
      </form>
    </div>
  );
}
