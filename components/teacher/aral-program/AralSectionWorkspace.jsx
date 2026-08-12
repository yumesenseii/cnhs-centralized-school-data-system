"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Loader2, Users } from "lucide-react";
import AralAssessmentComments from "@/components/teacher/aral-program/AralAssessmentComments";
import AralSectionFileModal from "@/components/teacher/aral-program/AralSectionFileModal";
import AralSectionFilesTable from "@/components/teacher/aral-program/AralSectionFilesTable";
import AralSectionUploadDialog from "@/components/teacher/aral-program/AralSectionUploadDialog";
import {
  DEFAULT_ARAL_MAX_SCORE,
  DEFAULT_ARAL_PASS_PERCENT,
  aralAssessmentPhaseLabel,
} from "@/lib/monitoring/aralAssessments";
import {
  ARAL_WEEKLY_INTERVENTION,
  formatAralWeeklyRemarks,
} from "@/lib/monitoring/aralProgress";
import { buildAralSectionFiles } from "@/lib/monitoring/aralSectionFiles";
import { parseAralAssessmentWorkbook } from "@/lib/reports/aralAssessmentExcel";
import { parseAralWeeklyWorkbook } from "@/lib/reports/aralWeeklyProgressExport";
import {
  listAralAssessmentScoresForSection,
  saveAralAssessmentScores,
} from "@/lib/supabase/queries/aralProgram";
import {
  createMonitoringRecord,
  listMonitoringRecordsForStudents,
  updateMonitoringRecord,
} from "@/lib/supabase/queries/monitoring";
import { confirmDestructive } from "@/lib/ui/confirmAction";

/**
 * Facilitator section workspace — file cabinet (no tabs).
 */
export default function AralSectionWorkspace({
  group,
  teacherName = "Facilitator",
  teacherId = null,
  onBack,
}) {
  const learners = group?.learners ?? [];
  const batchId = learners[0]?.batchId ?? null;
  const gradeSection = group?.gradeSection ?? "";
  const schoolYear = group?.schoolYear || learners[0]?.schoolYear || "";

  const learnerKey = useMemo(
    () => learners.map((l) => `${l.studentId}:${l.sourceClassId}`).join("|"),
    [learners]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [assessmentScores, setAssessmentScores] = useState([]);
  const [includeReport, setIncludeReport] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const [modalMode, setModalMode] = useState("view");
  const [pendingOpen, setPendingOpen] = useState(null);
  const [uploadingFileId, setUploadingFileId] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileInputRef = useRef(null);
  const uploadTargetRef = useRef(null);

  const refresh = useCallback(async () => {
    const studentIds = learners.map((l) => l.studentId).filter(Boolean);
    const classIds = learners.map((l) => l.sourceClassId).filter(Boolean);

    setLoading(true);
    setError("");

    const [monitoringResult, assessmentResult] = await Promise.all([
      studentIds.length
        ? listMonitoringRecordsForStudents({ studentIds, classIds })
        : Promise.resolve({ data: [], error: null }),
      batchId && gradeSection
        ? listAralAssessmentScoresForSection({
            batchId,
            gradeSection,
            phase: null,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (monitoringResult.error) {
      setError(monitoringResult.error.message);
      setRecords([]);
    } else {
      const pairKeys = new Set(
        learners
          .filter((l) => l.studentId && l.sourceClassId)
          .map((l) => `${l.studentId}::${l.sourceClassId}`)
      );
      setRecords(
        (monitoringResult.data ?? []).filter((row) =>
          pairKeys.has(`${row.student_id}::${row.class_id}`)
        )
      );
    }

    if (assessmentResult.error) {
      setError((prev) => prev || assessmentResult.error.message);
      setAssessmentScores([]);
    } else {
      setAssessmentScores(assessmentResult.data ?? []);
    }

    setLoading(false);
  }, [learners, learnerKey, batchId, gradeSection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setIncludeReport(false);
    setActiveFile(null);
    setPendingOpen(null);
  }, [learnerKey]);

  const cabinet = useMemo(
    () =>
      buildAralSectionFiles({
        learners,
        records,
        assessmentScores,
        gradeSection,
        teacherName,
        includeReport,
      }),
    [
      learners,
      records,
      assessmentScores,
      gradeSection,
      teacherName,
      includeReport,
    ]
  );

  useEffect(() => {
    if (!pendingOpen) return;
    const file = cabinet.files.find((f) => f.id === pendingOpen.id);
    if (!file) return;
    setActiveFile(file);
    setModalMode("view");
    setPendingOpen(null);
  }, [pendingOpen, cabinet.files]);

  const existingWeeks = useMemo(
    () =>
      cabinet.files
        .filter((f) => f.kind === "weekly")
        .map((f) => f.weekNumber),
    [cabinet.files]
  );
  const existingPhases = useMemo(
    () => cabinet.files.filter((f) => f.kind === "assessment").map((f) => f.phase),
    [cabinet.files]
  );

  function openFile(file) {
    setActiveFile(file);
    setModalMode("view");
  }

  function handleToolbarUpload() {
    if (!teacherId) {
      setError("Sign in as the assigned facilitator to upload files.");
      return;
    }
    setUploadOpen(true);
  }

  function handleUploadClick(file) {
    if (!teacherId) {
      setError("Sign in as the assigned facilitator to upload files.");
      return;
    }
    const label =
      file.kind === "weekly"
        ? `Week ${file.weekNumber}`
        : aralAssessmentPhaseLabel(file.phase);
    if (
      !confirmDestructive(
        `Replace the existing ${label} file for ${gradeSection}?\n\nPrevious saved data for this file will be overwritten.`
      )
    ) {
      return;
    }
    uploadTargetRef.current = {
      kind: file.kind,
      phase: file.phase || null,
      weekNumber: file.weekNumber || null,
      fileId: file.id,
      replacing: true,
    };
    fileInputRef.current?.click();
  }

  function handleUploadConfirm(target) {
    if (target.replacing) {
      const label =
        target.kind === "weekly"
          ? `Week ${target.weekNumber}`
          : aralAssessmentPhaseLabel(target.phase);
      if (
        !confirmDestructive(
          `Replace the existing ${label} file for ${gradeSection}?\n\nPrevious saved data for this file will be overwritten.`
        )
      ) {
        return;
      }
    }
    uploadTargetRef.current = {
      ...target,
      fileId:
        target.kind === "weekly"
          ? `weekly-${target.weekNumber}`
          : `assessment-${target.phase}`,
    };
    setUploadOpen(false);
    fileInputRef.current?.click();
  }

  async function saveWeeklyRows(parsedRows, weekNumber) {
    const byLearner = cabinet.byLearner;
    for (const item of parsedRows) {
      const learner = item.learner;
      if (!learner?.studentId || !learner.sourceClassId) continue;
      const weeks = byLearner.get(`${learner.studentId}::${learner.sourceClassId}`) ?? [];
      const existing = weeks.find((row) => row.weekNumber === weekNumber);
      const payload = {
        observation_date: item.observationDate,
        intervention_given: item.interventionGiven || ARAL_WEEKLY_INTERVENTION,
        teacher_remarks: formatAralWeeklyRemarks(
          weekNumber,
          item.teacherRemarks
        ),
        student_progress: item.studentProgress,
        follow_up_needed: Boolean(item.followUpNeeded),
        monitoring_status: item.monitoringStatus,
      };
      if (existing?.id) {
        const result = await updateMonitoringRecord(existing.id, payload);
        if (result.error) return result;
      } else {
        const result = await createMonitoringRecord({
          student_id: learner.studentId,
          class_id: learner.sourceClassId,
          teacher_id: teacherId,
          school_year: learner.schoolYear || schoolYear,
          quarter: Number(learner.quarter) || 4,
          ...payload,
        });
        if (result.error) return result;
      }
    }
    return { error: null };
  }

  async function handleFileChange(event) {
    const picked = event.target.files?.[0];
    const target = uploadTargetRef.current;
    event.target.value = "";
    uploadTargetRef.current = null;
    if (!picked || !target) return;

    setUploadingFileId(target.fileId || "upload");
    setError("");

    try {
      const buffer = await picked.arrayBuffer();

      if (target.kind === "weekly") {
        const weekNumber = Number(target.weekNumber) || 1;
        const parsed = parseAralWeeklyWorkbook(buffer, {
          learners,
          weekNumber,
        });
        if (parsed.errors.length) {
          setError(parsed.errors.slice(0, 8).join(" "));
          return;
        }
        const weekRows = parsed.rows.filter(
          (row) => (row.weekNumber || weekNumber) === weekNumber
        );
        if (!weekRows.length) {
          setError(
            `No matching weekly rows for Week ${weekNumber}. Check Student Number values against this section roster.`
          );
          return;
        }
        const result = await saveWeeklyRows(weekRows, weekNumber);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        await refresh();
        setPendingOpen({ id: `weekly-${weekNumber}` });
        return;
      }

      const parsed = parseAralAssessmentWorkbook(buffer, {
        learners,
        passPercent: DEFAULT_ARAL_PASS_PERCENT,
        defaultMaxScore: DEFAULT_ARAL_MAX_SCORE,
      });
      if (parsed.errors.length) {
        setError(parsed.errors.slice(0, 8).join(" "));
        return;
      }
      if (!parsed.rows.length) {
        setError(
          "No matching students with scores were found. Check Student Number values against this section roster."
        );
        return;
      }

      const uniqueRows = [];
      const seen = new Set();
      for (const row of parsed.rows) {
        if (!row.studentId || seen.has(row.studentId)) continue;
        seen.add(row.studentId);
        uniqueRows.push(row);
      }

      const result = await saveAralAssessmentScores({
        batchId,
        gradeSection,
        phase: target.phase,
        teacherId,
        rows: uniqueRows,
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }

      await refresh();
      setPendingOpen({ id: `assessment-${target.phase}` });
    } catch (err) {
      setError(err?.message ?? "Unable to read that Excel file.");
    } finally {
      setUploadingFileId("");
    }
  }

  async function handleGenerateReport() {
    await refresh();
    setIncludeReport(true);
    setPendingOpen({ id: "report" });
  }

  if (!group) return null;

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-sky-50 bg-sky-50/40 px-3 py-2.5 sm:px-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={12} />
              All sections
            </button>
            <h2 className="text-sm font-semibold text-slate-900">
              {group.gradeSection} — ARAL Monitoring
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {group.count} learner{group.count === 1 ? "" : "s"}
              {group.schoolYear ? ` · ${group.schoolYear}` : ""}
              {" · "}
              Facilitator: {teacherName}
            </p>
          </div>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-sky-700" />
              <p className="text-[12px] font-semibold text-slate-800">
                Section files
              </p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Subject teachers prepare the Excel. Upload Weekly or Pre / Mid /
              Post here — the system reads the file and saves it.{" "}
              <span className="font-semibold text-slate-600">
                Generate Report
              </span>{" "}
              uses saved scores and weekly progress.
            </p>
          </div>

          <AralAssessmentComments
            batchId={batchId}
            gradeSection={group.gradeSection}
            canPost={false}
            title="Comments from Head Teacher"
          />

          {error ? (
            <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading section files…
            </div>
          ) : (
            <AralSectionFilesTable
              files={cabinet.files}
              onView={openFile}
              onUpload={handleUploadClick}
              onToolbarUpload={handleToolbarUpload}
              onGenerateReport={handleGenerateReport}
              uploadingFileId={uploadingFileId}
            />
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-[560px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80">
                  {["Learner", "Subject", "Batch"].map((column) => (
                    <th
                      key={column}
                      className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {learners.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-3 py-2">
                      <p className="text-[12px] font-semibold text-slate-800">
                        {row.studentName}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {row.studentNumber}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {row.subject}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {row.batchName}
                      <span className="block text-[10px] text-slate-400">
                        {row.schoolYear}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleFileChange}
      />

      <AralSectionUploadDialog
        key={uploadOpen ? "open" : "closed"}
        open={uploadOpen}
        nextWeekNumber={cabinet.nextWeekNumber}
        existingWeeks={existingWeeks}
        existingPhases={existingPhases}
        uploading={Boolean(uploadingFileId)}
        onClose={() => setUploadOpen(false)}
        onConfirm={handleUploadConfirm}
      />

      {activeFile ? (
        <AralSectionFileModal
          file={
            cabinet.files.find((f) => f.id === activeFile.id) || activeFile
          }
          group={group}
          teacherId={teacherId}
          teacherName={teacherName}
          mode="view"
          onModeChange={setModalMode}
          onClose={() => {
            setActiveFile(null);
            setModalMode("view");
          }}
          onSaved={refresh}
        />
      ) : null}
    </>
  );
}
