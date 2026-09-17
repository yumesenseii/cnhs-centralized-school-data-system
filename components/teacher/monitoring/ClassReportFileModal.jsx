"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  Send,
  Upload,
  X,
} from "lucide-react";
import { upsertGrade } from "@/lib/supabase/queries/myClasses";
import { cn } from "@/lib/utils";
import { PriorityCue } from "@/components/teacher/monitoring/shared";

function emptyDraftFromLearners(learners = []) {
  const draft = {};
  for (const learner of learners) {
    const tg = learner.termGrades || {};
    draft[learner.id] = {
      1: tg[1] ?? "",
      2: tg[2] ?? "",
      3: tg[3] ?? "",
      4: tg[4] ?? "",
    };
  }
  return draft;
}

function parseCellGrade(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return Math.round(n * 100) / 100;
}

function displayGrade(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "";
}

function riskLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value).trim();
  if (!text || text === "—" || text.toLowerCase() === "no grade") return "—";
  return text;
}

function termColumnClass(quarterNumber, columnQuarter) {
  if (Number(quarterNumber) === Number(columnQuarter)) {
    return "bg-green-50";
  }
  return "";
}

/** LIS-style spreadsheet cell */
const th =
  "sticky top-0 z-10 border border-slate-200 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600 whitespace-nowrap";
const td =
  "border border-slate-200 bg-white px-2 py-1 text-[12px] leading-snug text-slate-800 whitespace-nowrap";

/**
 * LIS Enrollment–style landscape file modal with Failing | Moderate | Passing | Ungraded tabs.
 * Failing = grade < 75 · Moderate = 75–84 · Passing = ≥85 · Ungraded = no term grade (Risk —).
 */
export default function ClassReportFileModal({
  file,
  mode = "view",
  onModeChange,
  onClose,
  onSubmitToHt,
  submitting = false,
  onSaved,
  showHtActions = true,
  showHtReview = false,
  onApprove,
  onReturn,
  reviewing = false,
}) {
  const [tab, setTab] = useState("failing");
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [htNote, setHtNote] = useState("");
  const [expanded, setExpanded] = useState(false);

  const editing = mode === "edit";
  const allLearners = useMemo(
    () => [
      ...(file?.failingLearners || []),
      ...(file?.moderateLearners || file?.atRiskLearners || []),
      ...(file?.passingLearners || []),
      ...(file?.ungradedLearners || []),
    ],
    [file]
  );

  const rows =
    tab === "failing"
      ? file?.failingLearners || []
      : tab === "moderate"
        ? file?.moderateLearners || file?.atRiskLearners || []
        : tab === "ungraded"
          ? file?.ungradedLearners || []
          : file?.passingLearners || [];

  const tabs = useMemo(
    () => [
      {
        id: "failing",
        label: "FAILING",
        count: file?.failingCount ?? 0,
      },
      {
        id: "moderate",
        label: "MODERATE",
        count: file?.moderateCount ?? file?.atRiskCount ?? 0,
      },
      {
        id: "passing",
        label: "PASSING",
        count: file?.passingCount ?? 0,
      },
      {
        id: "ungraded",
        label: "UNGRADED",
        count: file?.ungradedCount ?? 0,
      },
    ],
    [file]
  );

  useEffect(() => {
    // Prefer the sheet that has learners when opening a file.
    if ((file?.failingCount ?? 0) > 0) setTab("failing");
    else if ((file?.moderateCount ?? file?.atRiskCount ?? 0) > 0) {
      setTab("moderate");
    } else if ((file?.passingCount ?? 0) > 0) setTab("passing");
    else setTab("ungraded");
  }, [file?.id]);

  useEffect(() => {
    setDraft(emptyDraftFromLearners(allLearners));
    setFormError("");
  }, [file?.id, allLearners]);

  useEffect(() => {
    setToast("");
  }, [file?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function setGradeCell(learnerId, quarter, value) {
    setDraft((prev) => ({
      ...prev,
      [learnerId]: {
        ...(prev[learnerId] || { 1: "", 2: "", 3: "", 4: "" }),
        [quarter]: value,
      },
    }));
  }

  async function handleSave(e) {
    e?.preventDefault?.();
    setFormError("");
    setToast("");

    if (!file?.subjectId) {
      setFormError(
        "Missing subject for this class file. Re-generate the report from My Classes after refreshing."
      );
      return;
    }

    const updates = [];
    for (const learner of allLearners) {
      const row = draft[learner.id] || {};
      const original = learner.termGrades || {};
      for (const q of [1, 2, 3, 4]) {
        const parsed = parseCellGrade(row[q]);
        if (parsed === undefined) {
          setFormError(
            `Invalid grade for ${learner.name} (Term ${q === 4 ? "Final" : q}). Use 0–100.`
          );
          return;
        }
        const prev =
          original[q] === null || original[q] === undefined
            ? null
            : Number(original[q]);
        const prevNorm = Number.isFinite(prev) ? prev : null;
        if (parsed !== prevNorm) {
          updates.push({
            student_id: learner.studentId,
            class_id: learner.classId || file.classId,
            subject_id: file.subjectId,
            quarter: q,
            final_grade: parsed,
            school_year: file.schoolYear,
          });
        }
      }
    }

    if (!updates.length) {
      setToast("No grade changes to save.");
      onModeChange?.("view");
      return;
    }

    setSaving(true);
    try {
      for (const row of updates) {
        const result = await upsertGrade(row);
        if (result.error) {
          setFormError(result.error.message || "Unable to save grades.");
          setSaving(false);
          return;
        }
      }
      try {
        await onSaved?.({
          updates,
          subject: file.subject,
          classId: file.classId,
          schoolYear: file.schoolYear,
        });
      } catch {
        // Grades already persisted; Priority may stay stale until Refresh.
      }
      setToast("Saved");
      onModeChange?.("view");
    } catch (err) {
      setFormError(err?.message || "Unable to save grades.");
    } finally {
      setSaving(false);
    }
  }

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !submitting) onClose?.();
      }}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl",
          expanded
            ? "h-[96vh] w-[98vw]"
            : "h-[min(85vh,780px)] w-[min(1180px,96vw)]"
        )}
      >
        {/* Header — LIS chrome */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
                {file.fileName}
                {file.fileName?.toLowerCase().endsWith(".xlsx") ? "" : ".xlsx"}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                  editing
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                )}
              >
                {editing ? "Editing" : "Viewing"}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              {editing
                ? "Edit Term 1–3 and Final cells, then Save Changes."
                : `Read-only view · Risk classified on ${file.quarterLabel || "selected term"} only. Click 'Edit File' to make changes.`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!editing && !showHtReview ? (
              <button
                type="button"
                onClick={() => onModeChange?.("edit")}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#246f54]"
              >
                <Pencil size={14} />
                Edit File
              </button>
            ) : null}
            <button
              type="button"
              aria-label={expanded ? "Exit full screen" : "Expand"}
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Sheet tabs — PUBLIC / PRIVATE style */}
        <div className="shrink-0 border-b border-slate-200 px-5">
          <div className="flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative cursor-pointer py-2.5 text-[12px] font-semibold tracking-wide transition-colors",
                  tab === t.id
                    ? "text-cnhs-green-dark"
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {t.label}
                <span className="ml-1.5 font-medium opacity-60">({t.count})</span>
                {tab === t.id ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-cnhs-green-dark" />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Edge-to-edge spreadsheet */}
        <div className="relative min-h-0 flex-1 overflow-auto bg-white">
          <form id="class-report-edit-form" onSubmit={handleSave} className="h-full">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr>
                  <th className={cn(th, "w-10 text-center")}>#</th>
                  <th className={cn(th, "min-w-[200px]")}>Learner name</th>
                  <th className={cn(th, "min-w-[120px] text-center")}>
                    Student no.
                  </th>
                  <th className={cn(th, "w-[76px] text-center")}>Term 1</th>
                  <th className={cn(th, "w-[76px] text-center")}>Term 2</th>
                  <th className={cn(th, "w-[76px] text-center")}>Term 3</th>
                  <th className={cn(th, "w-[76px] text-center")}>Final</th>
                  <th className={cn(th, "min-w-[90px] text-center")}>
                    Risk
                    {file.quarterLabel ? (
                      <span className="block text-[9px] font-medium normal-case tracking-normal text-slate-400">
                        ({file.quarterLabel})
                      </span>
                    ) : null}
                  </th>
                  <th className={cn(th, "min-w-[72px] text-center")}>
                    Priority
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((learner, idx) => {
                  const cells = draft[learner.id] || {
                    1: "",
                    2: "",
                    3: "",
                    4: "",
                  };
                  return (
                    <tr key={learner.id} className="hover:bg-slate-50/80">
                      <td className={cn(td, "bg-slate-50 text-center text-slate-500")}>
                        {idx + 1}
                      </td>
                      <td className={cn(td, "text-left")}>{learner.name}</td>
                      <td className={cn(td, "text-center text-slate-600")}>
                        {learner.studentNumber || "—"}
                      </td>
                      {[1, 2, 3, 4].map((q) => (
                        <td
                          key={q}
                          className={cn(
                            td,
                            "p-0 text-center",
                            termColumnClass(file.quarterNumber, q)
                          )}
                        >
                          {editing && !showHtReview ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayGrade(cells[q])}
                              onChange={(e) =>
                                setGradeCell(learner.id, q, e.target.value)
                              }
                              className="h-[28px] w-full border-0 bg-transparent px-1 text-center text-[12px] text-slate-800 outline-none focus:bg-[#fff8dc]"
                              aria-label={`${learner.name} ${q === 4 ? "Final" : `Term ${q}`}`}
                            />
                          ) : (
                            <span className="inline-block w-full px-2 py-1 text-center">
                              {displayGrade(cells[q]) || ""}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className={cn(td, "text-center text-slate-600")}>
                        {riskLabel(learner.riskLevel)}
                      </td>
                      <td className={cn(td, "text-center")}>
                        <PriorityCue learner={learner} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                No learners in this sheet.
              </p>
            ) : null}
          </form>

          {showHtReview ? (
            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-3">
              <p className="mb-2 text-[12px] font-semibold text-slate-800">
                Head Teacher review
              </p>
              <textarea
                rows={2}
                value={htNote}
                onChange={(e) => setHtNote(e.target.value)}
                placeholder="Optional return note…"
                className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-cnhs-green"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => onApprove?.(file, htNote)}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
                >
                  Approve file
                </button>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => onReturn?.(file, htNote)}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-orange-200 bg-orange-50 px-3 text-[12px] font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-50"
                >
                  Return file
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {editing && formError ? (
          <p className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-1.5 text-[12px] font-medium text-red-600">
            {formError}
          </p>
        ) : null}
        {toast ? (
          <p className="shrink-0 border-t border-green-100 bg-green-50 px-5 py-1.5 text-[12px] font-medium text-cnhs-green-dark">
            {toast}
          </p>
        ) : null}

        {/* Footer — LIS: Close (or Save when editing); secondary actions left */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {!showHtReview && !editing ? (
              <>
                <Link
                  href="/teacher/my-classes"
                  onClick={onClose}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Upload size={13} />
                  Upload file
                </Link>
                {showHtActions && file.aralEligible ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => onSubmitToHt?.(file)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[12px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    Send to HT
                  </button>
                ) : null}
              </>
            ) : (
              <span className="text-[11px] text-slate-400">
                {file.schoolYear} · {file.quarterLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editing && !showHtReview ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft(emptyDraftFromLearners(allLearners));
                    setFormError("");
                    onModeChange?.("view");
                  }}
                  className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="class-report-edit-form"
                  disabled={saving}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[13px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save Changes
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
