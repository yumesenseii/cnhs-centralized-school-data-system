"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import AralAssessmentReadonlyGrid from "@/components/teacher/aral-program/AralAssessmentReadonlyGrid";
import AralSectionReportPanel from "@/components/teacher/aral-program/AralSectionReportPanel";
import {
  ARAL_FOCUS_OPTIONS,
  ARAL_PROGRESS_OPTIONS,
  ARAL_REMARKS_MAX,
  ARAL_REMARKS_PLACEHOLDER,
  ARAL_SESSION_LABELS,
  ARAL_SESSION_OPTIONS,
  ARAL_WEEKLY_INTERVENTION,
  clipAralRemarks,
  parseAralProgress,
} from "@/lib/monitoring/aralProgress";
import { MONITORING_STATUS } from "@/lib/monitoring/recommendations";
import {
  buildWeekFileRows,
  groupMonitoringRecordsByLearner,
} from "@/lib/monitoring/aralSectionFiles";
import { downloadAralWeeklyTemplateExcel } from "@/lib/reports/aralWeeklyProgressExport";
import { downloadAralAssessmentTemplateExcel } from "@/lib/reports/aralAssessmentExcel";
import {
  createMonitoringRecord,
  listMonitoringRecordsForStudents,
  updateMonitoringRecord,
} from "@/lib/supabase/queries/monitoring";
import { listAralAssessmentScores } from "@/lib/supabase/queries/aralProgram";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  MONITORING_STATUS.ONGOING,
  MONITORING_STATUS.IMPROVED,
  MONITORING_STATUS.NEEDS_FOLLOW_UP,
  MONITORING_STATUS.COMPLETED,
];

const th =
  "sticky top-0 z-10 border border-slate-200 bg-[#f3f3f3] px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600 whitespace-nowrap";
const td =
  "border border-slate-200 bg-white px-2 py-1 text-[12px] leading-snug text-slate-800 whitespace-nowrap";

function stripWeekPrefix(remarks = "") {
  return String(remarks || "").replace(/^\[Week \d+\]\s*/i, "").trim();
}

function displayText(value) {
  if (value == null || value === "") return "";
  return String(value);
}

/**
 * Rectangular file modal — Weekly / Assessment / Report (ClassReportFileModal style).
 */
export default function AralSectionFileModal({
  file,
  group,
  teacherId = null,
  teacherName = "Facilitator",
  mode = "view",
  onModeChange,
  onClose,
  onSaved,
}) {
  const learners = group?.learners ?? [];
  const gradeSection = group?.gradeSection ?? "Section";
  const schoolYear = group?.schoolYear || learners[0]?.schoolYear || "";
  const batchId = learners[0]?.batchId ?? null;

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState({});

  const kind = file?.kind;
  const editing = kind === "weekly" && mode === "edit";

  const refreshWeekly = useCallback(async () => {
    const studentIds = learners.map((l) => l.studentId).filter(Boolean);
    const classIds = learners.map((l) => l.sourceClassId).filter(Boolean);
    if (!studentIds.length) {
      setRecords([]);
      return;
    }
    setLoadingWeekly(true);
    const result = await listMonitoringRecordsForStudents({
      studentIds,
      classIds,
    });
    if (result.error) {
      setFormError(result.error.message);
      setRecords([]);
    } else {
      const pairKeys = new Set(
        learners
          .filter((l) => l.studentId && l.sourceClassId)
          .map((l) => `${l.studentId}::${l.sourceClassId}`)
      );
      setRecords(
        (result.data ?? []).filter((row) =>
          pairKeys.has(`${row.student_id}::${row.class_id}`)
        )
      );
    }
    setLoadingWeekly(false);
  }, [learners]);

  useEffect(() => {
    if (kind === "weekly") refreshWeekly();
  }, [kind, file?.weekNumber, refreshWeekly]);

  const weekRows = useMemo(() => {
    if (kind !== "weekly") return [];
    const byLearner = groupMonitoringRecordsByLearner(learners, records);
    return buildWeekFileRows(learners, byLearner, file?.weekNumber || 1);
  }, [kind, learners, records, file?.weekNumber]);

  useEffect(() => {
    if (kind !== "weekly") return;
    const byLearner = groupMonitoringRecordsByLearner(learners, records);
    const rows = buildWeekFileRows(
      learners,
      byLearner,
      file?.weekNumber || 1
    );
    const next = {};
    for (const row of rows) {
      const rec = row.record;
      next[row.learner.id] = {
        recordId: rec?.id || null,
        observationDate: rec?.observationDate || "",
        sessionStatus: rec?.sessionStatus || "",
        skillFocus: rec?.skillFocus || "",
        studentProgress: rec?.studentProgress || "",
        monitoringStatus: rec?.monitoringStatus || "",
        teacherRemarks: stripWeekPrefix(rec?.teacherRemarks).slice(
          0,
          ARAL_REMARKS_MAX
        ),
        followUpNeeded: Boolean(rec?.followUpNeeded),
      };
    }
    setDraft(next);
    setFormError("");
    setToast("");
  }, [kind, file?.id, file?.weekNumber, records, learners, mode]);

  function setCell(learnerId, field, value) {
    setDraft((prev) => ({
      ...prev,
      [learnerId]: {
        observationDate: "",
        sessionStatus: "",
        skillFocus: "",
        studentProgress: "",
        monitoringStatus: "",
        teacherRemarks: "",
        followUpNeeded: false,
        recordId: null,
        ...(prev[learnerId] || {}),
        [field]: value,
      },
    }));
  }

  async function handleSaveWeekly(e) {
    e?.preventDefault?.();
    setFormError("");
    setToast("");
    if (!teacherId) {
      setFormError("Teacher session is required.");
      return;
    }

    const weekNumber = file?.weekNumber || 1;
    const toSave = [];
    for (const row of weekRows) {
      const learner = row.learner;
      if (!learner.sourceClassId) continue;
      const cells = draft[learner.id];
      const date = String(cells?.observationDate ?? "").trim();
      const progress = parseAralProgress(cells?.studentProgress);
      const remarks = clipAralRemarks(cells?.teacherRemarks);
      if (!date && !progress && !remarks) continue;
      if (!date || !progress) {
        setFormError(
          `Session Date and Weekly Progress are required for ${learner.studentName}. Leave the row empty to skip.`
        );
        return;
      }
      if (remarks.length > ARAL_REMARKS_MAX) {
        setFormError(`Remarks for ${learner.studentName} must be ${ARAL_REMARKS_MAX} characters or fewer.`);
        return;
      }

      toSave.push({
        learner,
        cells: { ...cells, teacherRemarks: remarks, studentProgress: progress },
        weekNumber,
      });
    }

    if (!toSave.length) {
      setFormError(
        "Fill Session Date and Weekly Progress for at least one learner. Empty rows are not saved."
      );
      return;
    }

    setSaving(true);
    try {
      for (const item of toSave) {
        const payload = {
          observation_date: item.cells.observationDate,
          intervention_given: ARAL_WEEKLY_INTERVENTION,
          teacher_remarks: clipAralRemarks(item.cells.teacherRemarks),
          student_progress: item.cells.studentProgress,
          follow_up_needed: Boolean(item.cells.followUpNeeded),
          monitoring_status:
            item.cells.monitoringStatus || MONITORING_STATUS.ONGOING,
          week_number: item.weekNumber,
          session_status: item.cells.sessionStatus || null,
          skill_focus: item.cells.skillFocus || null,
        };

        if (item.cells.recordId) {
          const result = await updateMonitoringRecord(
            item.cells.recordId,
            payload
          );
          if (result.error) {
            setFormError(
              result.error.message ||
                `Unable to update ${item.learner.studentName}.`
            );
            setSaving(false);
            return;
          }
        } else {
          const result = await createMonitoringRecord({
            student_id: item.learner.studentId,
            class_id: item.learner.sourceClassId,
            teacher_id: teacherId,
            school_year: item.learner.schoolYear || schoolYear,
            quarter: Number(item.learner.quarter) || 4,
            ...payload,
          });
          if (result.error) {
            setFormError(
              result.error.message ||
                `Unable to save ${item.learner.studentName}.`
            );
            setSaving(false);
            return;
          }
        }
      }
      setToast(`Saved Week ${weekNumber} for ${toSave.length} learner(s).`);
      await refreshWeekly();
      onSaved?.();
      onModeChange?.("view");
    } catch (err) {
      setFormError(err?.message || "Unable to save weekly file.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload() {
    setExporting(true);
    setFormError("");
    setToast("");
    try {
      if (kind === "weekly") {
        const result = await downloadAralWeeklyTemplateExcel({
          learners,
          records,
          gradeSection,
          schoolYear,
          weekNumber: file.weekNumber,
          generatedBy: teacherName,
        });
        setToast(`Downloaded ${result.filename}.`);
      } else if (kind === "assessment") {
        const scoresResult = await listAralAssessmentScores({
          batchId,
          gradeSection,
          phase: file.phase,
        });
        if (scoresResult.error) throw scoresResult.error;
        const drafts = {};
        let maxScore = 40;
        let passPercent = 75;
        for (const row of scoresResult.data ?? []) {
          if (row.maxScore) maxScore = row.maxScore;
          if (row.passPercent != null) passPercent = row.passPercent;
          drafts[row.studentId] = {
            score: row.score == null ? "" : String(row.score),
            notes: row.notes || "",
            result: row.result || null,
            maxScore: row.maxScore,
            passPercent: row.passPercent,
          };
        }
        const result = await downloadAralAssessmentTemplateExcel({
          learners,
          drafts,
          gradeSection,
          phase: file.phase,
          maxScore,
          passPercent,
          schoolYear,
          generatedBy: teacherName,
        });
        setToast(`Downloaded ${result.filename}.`);
      }
      // report has its own download inside panel
    } catch (err) {
      setFormError(err?.message || "Unable to download Excel.");
    } finally {
      setExporting(false);
    }
  }

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose?.();
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
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
                {file.fileName}
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
              {kind === "assessment"
                ? "Read-only scores from the uploaded file. Re-upload from the file list to replace."
                : kind === "report"
                  ? "Section summary from saved Pre / Mid / Post scores and weekly progress."
                  : `Week ${file.weekNumber} structured progress. Session is ARAL period only (not SF2). Download the template or Edit File.`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!editing && file.canEdit ? (
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

        <div className="relative min-h-0 flex-1 overflow-auto bg-white">
          {kind === "weekly" ? (
            loadingWeekly ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading Week {file.weekNumber}…
              </div>
            ) : (
              <form
                id="aral-section-weekly-form"
                onSubmit={handleSaveWeekly}
                className="h-full"
              >
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead>
                    <tr>
                      <th className={cn(th, "w-10 text-center")}>#</th>
                      <th className={cn(th, "min-w-[180px]")}>Learner name</th>
                      <th className={cn(th, "min-w-[110px] text-center")}>
                        LRN
                      </th>
                      <th className={cn(th, "w-[72px] text-center")}>Week</th>
                      <th className={cn(th, "min-w-[120px] text-center")}>
                        Session Date
                      </th>
                      <th className={cn(th, "min-w-[110px]")}>Session</th>
                      <th className={cn(th, "min-w-[130px]")}>Focus</th>
                      <th className={cn(th, "min-w-[150px]")}>
                        Weekly Progress
                      </th>
                      <th className={cn(th, "min-w-[120px]")}>Status</th>
                      <th className={cn(th, "min-w-[200px]")}>Remarks</th>
                      <th className={cn(th, "w-[80px] text-center")}>
                        Follow-up
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekRows.map((row, idx) => {
                      const learner = row.learner;
                      const cells = draft[learner.id] || {};
                      const rec = row.record;
                      return (
                        <tr key={learner.id} className="hover:bg-slate-50/80">
                          <td
                            className={cn(
                              td,
                              "bg-[#fafafa] text-center text-slate-500"
                            )}
                          >
                            {idx + 1}
                          </td>
                          <td className={cn(td, "text-left")}>
                            {learner.studentName}
                          </td>
                          <td className={cn(td, "text-center text-slate-600")}>
                            {learner.studentNumber || "—"}
                          </td>
                          <td className={cn(td, "text-center text-slate-600")}>
                            Week {file.weekNumber}
                          </td>
                          <td className={cn(td, "p-0 text-center")}>
                            {editing ? (
                              <input
                                type="date"
                                value={cells.observationDate || ""}
                                onChange={(e) =>
                                  setCell(
                                    learner.id,
                                    "observationDate",
                                    e.target.value
                                  )
                                }
                                disabled={!learner.sourceClassId}
                                className="h-[28px] w-full border-0 bg-transparent px-1 text-center text-[12px] outline-none focus:bg-[#fff8dc] disabled:opacity-40"
                              />
                            ) : (
                              <span className="inline-block w-full px-2 py-1 text-center">
                                {displayText(rec?.observationDate)}
                              </span>
                            )}
                          </td>
                          <td className={cn(td, "p-0")}>
                            {editing ? (
                              <select
                                value={cells.sessionStatus || ""}
                                onChange={(e) =>
                                  setCell(
                                    learner.id,
                                    "sessionStatus",
                                    e.target.value
                                  )
                                }
                                disabled={!learner.sourceClassId}
                                className="h-[28px] w-full border-0 bg-transparent px-1 text-[12px] outline-none focus:bg-[#fff8dc] disabled:opacity-40"
                              >
                                <option value="">—</option>
                                {ARAL_SESSION_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {ARAL_SESSION_LABELS[opt]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-block w-full px-2 py-1">
                                {displayText(
                                  rec?.sessionStatus
                                    ? ARAL_SESSION_LABELS[rec.sessionStatus] ||
                                        rec.sessionStatus
                                    : ""
                                )}
                              </span>
                            )}
                          </td>
                          <td className={cn(td, "p-0")}>
                            {editing ? (
                              <select
                                value={cells.skillFocus || ""}
                                onChange={(e) =>
                                  setCell(learner.id, "skillFocus", e.target.value)
                                }
                                disabled={!learner.sourceClassId}
                                className="h-[28px] w-full border-0 bg-transparent px-1 text-[12px] outline-none focus:bg-[#fff8dc] disabled:opacity-40"
                              >
                                <option value="">—</option>
                                {ARAL_FOCUS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-block w-full px-2 py-1">
                                {displayText(rec?.skillFocus)}
                              </span>
                            )}
                          </td>
                          <td className={cn(td, "p-0")}>
                            {editing ? (
                              <select
                                value={cells.studentProgress || ""}
                                onChange={(e) =>
                                  setCell(
                                    learner.id,
                                    "studentProgress",
                                    e.target.value
                                  )
                                }
                                disabled={!learner.sourceClassId}
                                className="h-[28px] w-full border-0 bg-transparent px-1 text-[12px] outline-none focus:bg-[#fff8dc] disabled:opacity-40"
                              >
                                <option value="">—</option>
                                {ARAL_PROGRESS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-block w-full px-2 py-1">
                                {displayText(rec?.studentProgress)}
                              </span>
                            )}
                          </td>
                          <td className={cn(td, "p-0")}>
                            {editing ? (
                              <select
                                value={cells.monitoringStatus || ""}
                                onChange={(e) =>
                                  setCell(
                                    learner.id,
                                    "monitoringStatus",
                                    e.target.value
                                  )
                                }
                                disabled={!learner.sourceClassId}
                                className="h-[28px] w-full border-0 bg-transparent px-1 text-[12px] outline-none focus:bg-[#fff8dc] disabled:opacity-40"
                              >
                                <option value="">—</option>
                                {STATUS_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-block w-full px-2 py-1">
                                {displayText(rec?.monitoringStatus)}
                              </span>
                            )}
                          </td>
                          <td className={cn(td, "p-0")}>
                            {editing ? (
                              <input
                                type="text"
                                value={cells.teacherRemarks || ""}
                                onChange={(e) =>
                                  setCell(
                                    learner.id,
                                    "teacherRemarks",
                                    e.target.value.slice(0, ARAL_REMARKS_MAX)
                                  )
                                }
                                disabled={!learner.sourceClassId}
                                maxLength={ARAL_REMARKS_MAX}
                                placeholder={ARAL_REMARKS_PLACEHOLDER}
                                className="h-[28px] w-full border-0 bg-transparent px-2 text-[12px] outline-none placeholder:text-slate-300 focus:bg-[#fff8dc] disabled:opacity-40"
                              />
                            ) : (
                              <span className="inline-block max-w-[280px] truncate px-2 py-1">
                                {displayText(rec?.teacherRemarks)}
                              </span>
                            )}
                          </td>
                          <td className={cn(td, "p-0 text-center")}>
                            {editing ? (
                              <input
                                type="checkbox"
                                checked={Boolean(cells.followUpNeeded)}
                                onChange={(e) =>
                                  setCell(
                                    learner.id,
                                    "followUpNeeded",
                                    e.target.checked
                                  )
                                }
                                disabled={!learner.sourceClassId}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-cnhs-green-dark"
                              />
                            ) : (
                              <span className="inline-block w-full px-2 py-1 text-center">
                                {rec
                                  ? rec.followUpNeeded
                                    ? "Yes"
                                    : "No"
                                  : ""}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </form>
            )
          ) : null}

          {kind === "assessment" ? (
            <div className="p-4">
              <AralAssessmentReadonlyGrid
                learners={learners}
                batchId={batchId}
                gradeSection={gradeSection}
                phase={file.phase}
              />
            </div>
          ) : null}

          {kind === "report" ? (
            <div className="p-4">
              <AralSectionReportPanel
                group={group}
                teacherName={teacherName}
              />
            </div>
          ) : null}
        </div>

        {formError ? (
          <p className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-1.5 text-[12px] font-medium text-red-600">
            {formError}
          </p>
        ) : null}
        {toast ? (
          <p className="shrink-0 border-t border-green-100 bg-green-50 px-5 py-1.5 text-[12px] font-medium text-cnhs-green-dark">
            {toast}
          </p>
        ) : null}

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {kind !== "report" && !editing ? (
              <button
                type="button"
                disabled={exporting || !learners.length}
                onClick={handleDownload}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                Download Excel
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                {schoolYear || "Summer ARAL"} · {gradeSection}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editing && kind === "weekly" ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onModeChange?.("view")}
                  className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="aral-section-weekly-form"
                  disabled={saving || !teacherId}
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
