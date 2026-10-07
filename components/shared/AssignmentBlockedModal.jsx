"use client";

import { ShieldAlert } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";

/**
 * Dedicated error modal for the Assignment Edit Rule.
 * Shown when a subject / advisory assignment change is blocked because
 * existing data records are already associated with the current assignment.
 * Nothing is modified — this modal is informational only.
 */
export default function AssignmentBlockedModal({
  open,
  message,
  details = [],
  onClose,
}) {
  const records = (details ?? []).filter((row) => (row?.count ?? 0) > 0);

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      labelledBy="assignment-blocked-title"
      describedBy="assignment-blocked-description"
      zClassName="z-[70]"
      className="bg-slate-900/50"
      panelClassName="w-full max-w-[460px] overflow-hidden rounded-xl bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
    >
      <div className="px-5 py-5">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-200/70">
            <ShieldAlert size={19} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <h2
              id="assignment-blocked-title"
              className="text-[15px] font-bold tracking-tight text-slate-900"
            >
              Cannot change assignment
            </h2>
            <p
              id="assignment-blocked-description"
              className="mt-1.5 text-[12px] leading-5 text-slate-600"
            >
              {message ||
                "Cannot change assignment. Existing data records are already associated with this subject/advisory assignment."}
            </p>
          </div>
        </div>

        {records.length ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Associated records found
            </p>
            <ul className="mt-2 space-y-1.5">
              {records.map((row) => (
                <li
                  key={row.table || row.label}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <span className="text-slate-600">{row.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 ring-1 ring-slate-200">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-3.5 text-[11px] leading-4 text-slate-400">
          Existing records are never moved or reassigned automatically. To
          proceed, clear the associated class data first or create a new
          assignment instead.
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-xl bg-cnhs-green-dark px-5 text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            Understood
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
