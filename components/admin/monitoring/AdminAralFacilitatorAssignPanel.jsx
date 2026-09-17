"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Loader2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  listTeachersForFacilitatorSelect,
  removeAralFacilitatorAssignment,
  upsertAralFacilitatorAssignment,
} from "@/lib/supabase/queries/aralProgram";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import { confirmDelete } from "@/lib/ui/confirmAction";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";

const SECTIONS_PAGE_SIZE = 10;

/** Prefer gradeLevel field; else parse "Grade 7 — Mabini" / "Grade 7 Mabini". */
function parseGradeLabel(gradeSection, gradeLevel) {
  const fromField = String(gradeLevel || "").trim();
  if (/^Grade\s+\d+/i.test(fromField)) {
    return fromField.match(/^(Grade\s+\d+)/i)?.[1] ?? fromField;
  }
  const m = String(gradeSection || "").match(/^(Grade\s+\d+)/i);
  return m ? m[1] : "Other";
}

function sectionDisplayName(gradeSection, grade) {
  const stripped = String(gradeSection || "")
    .replace(/^Grade\s+\d+\s*[—–-]?\s*/i, "")
    .trim();
  return stripped || gradeSection || grade || "Section";
}

function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

function summarizeSectionFacilitator(learners = []) {
  const assigned = learners.filter((l) => l.aralFacilitatorTeacherId);
  if (!assigned.length) {
    return { label: "Unassigned", teacherId: "", mixed: false };
  }
  const ids = new Set(assigned.map((l) => l.aralFacilitatorTeacherId));
  if (ids.size > 1) {
    return { label: "Multiple facilitators", teacherId: "", mixed: true };
  }
  const first = assigned[0];
  return {
    label: first.aralFacilitatorName || "Assigned",
    teacherId: first.aralFacilitatorTeacherId || "",
    mixed: false,
  };
}

/**
 * Collapse Eng/Fil (and duplicate) rows into one learner per section.
 */
function buildSectionGroups(aralRows = []) {
  const bySection = new Map();

  for (const row of aralRows) {
    const sectionKey = String(row.gradeSection || "Unassigned section").trim();
    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, new Map());
    }
    const learners = bySection.get(sectionKey);
    const studentId = row.studentId || row.id;
    const existing = learners.get(studentId);

    if (!existing) {
      learners.set(studentId, {
        studentId,
        name: row.name,
        studentNumber: row.studentNumber,
        gradeSection: sectionKey,
        gradeLevel: row.gradeLevel || null,
        schoolYear: row.schoolYear || "SY 2026-2027",
        subjects: row.subject ? [row.subject] : [],
        teacherNames: row.teacherName ? [row.teacherName] : [],
        classIds: row.classId ? [row.classId] : [],
        sourceRows: [row],
        aralFacilitatorTeacherId: row.aralFacilitatorTeacherId || "",
        aralFacilitatorName: row.aralFacilitatorName || "",
        aralAssignmentId: row.aralAssignmentId || null,
      });
      continue;
    }

    if (row.subject && !existing.subjects.includes(row.subject)) {
      existing.subjects.push(row.subject);
    }
    if (row.teacherName && !existing.teacherNames.includes(row.teacherName)) {
      existing.teacherNames.push(row.teacherName);
    }
    if (row.classId && !existing.classIds.includes(row.classId)) {
      existing.classIds.push(row.classId);
    }
    existing.sourceRows.push(row);
    if (row.aralFacilitatorTeacherId) {
      existing.aralFacilitatorTeacherId = row.aralFacilitatorTeacherId;
      existing.aralFacilitatorName = row.aralFacilitatorName || "";
      existing.aralAssignmentId = row.aralAssignmentId || existing.aralAssignmentId;
    }
  }

  return [...bySection.entries()]
    .map(([gradeSection, learnerMap]) => {
      const learners = [...learnerMap.values()].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      const unassigned = learners.filter((l) => !l.aralFacilitatorTeacherId)
        .length;
      const sample = learners[0];
      const grade = parseGradeLabel(gradeSection, sample?.gradeLevel);
      const facilitator = summarizeSectionFacilitator(learners);
      return {
        gradeSection,
        grade,
        sectionName: sectionDisplayName(gradeSection, grade),
        learners,
        unassigned,
        count: learners.length,
        facilitator,
      };
    })
    .sort((a, b) =>
      String(a.gradeSection).localeCompare(String(b.gradeSection))
    );
}

function buildGradeFolders(sectionGroups = []) {
  const byGrade = new Map();

  for (const group of sectionGroups) {
    const grade = group.grade;
    if (!byGrade.has(grade)) {
      byGrade.set(grade, {
        grade,
        sections: [],
        count: 0,
        unassigned: 0,
      });
    }
    const folder = byGrade.get(grade);
    folder.sections.push(group);
    folder.count += group.count;
    folder.unassigned += group.unassigned;
  }

  return [...byGrade.values()].sort(
    (a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade)
  );
}

/**
 * Admin panel: assign Summer ARAL facilitators by grade → section.
 * Roster from identified ARAL learners; DB still one row per student.
 * TODO: Excel Section→Facilitator template download/upload (bulk map).
 */
export default function AdminAralFacilitatorAssignPanel({
  students = [],
  onChanged,
}) {
  const aralRows = useMemo(
    () => students.filter(isAralRecommended),
    [students]
  );

  const sectionGroups = useMemo(
    () => buildSectionGroups(aralRows),
    [aralRows]
  );

  const gradeFolders = useMemo(
    () => buildGradeFolders(sectionGroups),
    [sectionGroups]
  );

  const uniqueLearnerCount = useMemo(() => {
    const ids = new Set();
    for (const group of sectionGroups) {
      for (const learner of group.learners) ids.add(learner.studentId);
    }
    return ids.size;
  }, [sectionGroups]);

  const [selectedGrade, setSelectedGrade] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [sectionDrafts, setSectionDrafts] = useState({});
  // When OFF: only assigns to unassigned learners.
  // When ON: also overwrites existing facilitator assignments.
  const [overwriteExistingBySection, setOverwriteExistingBySection] =
    useState({});
  const [viewLearnersBySection, setViewLearnersBySection] = useState({});
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const { showToast } = useAppToast();

  const activeFolder = useMemo(
    () => gradeFolders.find((f) => f.grade === selectedGrade) ?? null,
    [gradeFolders, selectedGrade]
  );

  const visibleSections = activeFolder?.sections ?? [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTeachers(true);
      const result = await listTeachersForFacilitatorSelect();
      if (cancelled) return;
      if (result.error) setError(result.error.message);
      setTeachers(result.data ?? []);
      setLoadingTeachers(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const next = {};
    for (const group of sectionGroups) {
      for (const learner of group.learners) {
        next[learner.studentId] = learner.aralFacilitatorTeacherId || "";
      }
    }
    setDrafts(next);
    setPage(1);
  }, [sectionGroups]);

  useEffect(() => {
    setPage(1);
    setViewLearnersBySection({});
  }, [selectedGrade]);

  useEffect(() => {
    if (
      selectedGrade &&
      !gradeFolders.some((folder) => folder.grade === selectedGrade)
    ) {
      setSelectedGrade(null);
    }
  }, [gradeFolders, selectedGrade]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleSections.length / SECTIONS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * SECTIONS_PAGE_SIZE;
    return visibleSections.slice(start, start + SECTIONS_PAGE_SIZE);
  }, [visibleSections, safePage]);

  const sectionStart =
    visibleSections.length === 0
      ? 0
      : (safePage - 1) * SECTIONS_PAGE_SIZE + 1;
  const sectionEnd = Math.min(
    safePage * SECTIONS_PAGE_SIZE,
    visibleSections.length
  );

  async function upsertLearner(learner, teacherId, profileId) {
    return upsertAralFacilitatorAssignment({
      studentId: learner.studentId,
      facilitatorTeacherId: teacherId,
      sourceClassId: learner.classIds[0] || learner.sourceRows[0]?.classId,
      schoolYear: learner.schoolYear || "SY 2026-2027",
      assignedByProfileId: profileId,
    });
  }

  async function handleAssign(learner) {
    const overwriteExisting = Boolean(
      overwriteExistingBySection[learner.gradeSection]
    );
    if (!overwriteExisting && learner.aralFacilitatorTeacherId) {
      setError("Learner already has a facilitator. Enable overwrite to change.");
      return;
    }
    const teacherId = drafts[learner.studentId];
    if (!teacherId) {
      setError("Select a facilitator before assigning.");
      return;
    }
    setBusyId(learner.studentId);
    setError("");

    const session = await getAdminSession();
    const result = await upsertLearner(
      learner,
      teacherId,
      session.data?.id ?? null
    );

    setBusyId("");
    if (result.error) {
      setError(result.error.message);
      return;
    }
    showToast(`Facilitator assigned for ${learner.name}.`);
    onChanged?.();
  }

  async function handleAssignSection(group) {
    const overwriteExisting = Boolean(
      overwriteExistingBySection[group.gradeSection]
    );
    const teacherId = sectionDrafts[group.gradeSection];
    if (!teacherId) {
      setError("Select a facilitator for this section first.");
      return;
    }

    const learnersToAssign = overwriteExisting
      ? group.learners
      : group.learners.filter((l) => !l.aralFacilitatorTeacherId);

    if (!learnersToAssign.length) {
      showToast(
        `All learners in ${group.sectionName} are already assigned.`
      );
      return;
    }

    setBusyId(`section:${group.gradeSection}`);
    setError("");

    const session = await getAdminSession();
    const profileId = session.data?.id ?? null;
    let failed = null;

    for (const learner of learnersToAssign) {
      const result = await upsertLearner(learner, teacherId, profileId);
      if (result.error) {
        failed = result.error.message;
        break;
      }
      setDrafts((prev) => ({
        ...prev,
        [learner.studentId]: teacherId,
      }));
    }

    setBusyId("");
    if (failed) {
      setError(failed);
      onChanged?.();
      return;
    }
    showToast(
      `Facilitator assigned to ${learnersToAssign.length} learner${
        learnersToAssign.length === 1 ? "" : "s"
      } in ${group.sectionName}.`
    );
    onChanged?.();
  }

  async function handleRemove(learner) {
    if (!learner.aralAssignmentId) return;
    if (
      !confirmDelete(
        `facilitator assignment for ${learner.name || "this learner"}`
      )
    ) {
      return;
    }
    setBusyId(learner.studentId);
    setError("");
    const result = await removeAralFacilitatorAssignment(
      learner.aralAssignmentId
    );
    setBusyId("");
    if (result.error) {
      setError(result.error.message);
      return;
    }
    showToast(`Facilitator removed for ${learner.name}.`);
    onChanged?.();
  }

  return (
    <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-50 bg-violet-50/40 px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Assign ARAL Facilitators
          </h2>
        </div>
        <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">
          {uniqueLearnerCount} learner
          {uniqueLearnerCount === 1 ? "" : "s"} · {sectionGroups.length}{" "}
          section{sectionGroups.length === 1 ? "" : "s"} · {gradeFolders.length}{" "}
          grade{gradeFolders.length === 1 ? "" : "s"}
        </span>
      </div>

      <AnimatedBanner
        message={error}
        tone="error"
        className="border-b px-3 py-2 text-[11px]"
      />

      {!sectionGroups.length ? (
        <p className="px-3 py-8 text-center text-[12px] text-slate-400">
          No ARAL Learners identified yet. English / Filipino teachers identify
          candidates from ECR grades first.
        </p>
      ) : !selectedGrade ? (
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {gradeFolders.map((folder) => {
              const attention = folder.unassigned > 0;
              return (
                <button
                  key={folder.grade}
                  type="button"
                  onClick={() => setSelectedGrade(folder.grade)}
                  className="group flex cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-violet-200 hover:bg-violet-50/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                      <Folder size={18} strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        attention
                          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          attention ? "bg-amber-500" : "bg-emerald-500"
                        )}
                      />
                      {attention ? "Needs assign" : "Assigned"}
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
                    {folder.grade}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {folder.count} learner{folder.count === 1 ? "" : "s"} ·{" "}
                    {folder.sections.length} section
                    {folder.sections.length === 1 ? "" : "s"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {folder.unassigned > 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-100">
                        {folder.unassigned} unassigned
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                        All assigned
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                    <span className="text-[11px] text-slate-400">
                      Open sections
                    </span>
                    <span className="text-[11px] font-semibold text-violet-700 opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => setSelectedGrade(null)}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={13} />
              All grades
            </button>
            <div className="min-w-0 text-right">
              <p className="text-[13px] font-semibold text-slate-800">
                {selectedGrade}
              </p>
              <p className="text-[10px] text-slate-500">
                {activeFolder?.count ?? 0} learner
                {(activeFolder?.count ?? 0) === 1 ? "" : "s"} ·{" "}
                {visibleSections.length} section
                {visibleSections.length === 1 ? "" : "s"}
                {activeFolder?.unassigned
                  ? ` · ${activeFolder.unassigned} unassigned`
                  : " · all assigned"}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pagedSections.map((group) => {
              const sectionBusy = busyId === `section:${group.gradeSection}`;
              const showLearners = Boolean(
                viewLearnersBySection[group.gradeSection]
              );
              const overwriteExisting = Boolean(
                overwriteExistingBySection[group.gradeSection]
              );
              const facilitatorLabel = group.facilitator?.label || "Unassigned";
              const allAssigned = group.unassigned === 0;

              return (
                <div key={group.gradeSection} className="px-3 py-3 sm:px-4">
                  <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800">
                          {group.sectionName}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {group.count} learner{group.count === 1 ? "" : "s"}
                          {group.unassigned > 0
                            ? ` · ${group.unassigned} unassigned`
                            : " · all assigned"}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-[11px] font-medium",
                            allAssigned && !group.facilitator?.mixed
                              ? "text-violet-700"
                              : group.facilitator?.mixed
                                ? "text-amber-700"
                                : "text-amber-600"
                          )}
                        >
                          Facilitator: {facilitatorLabel}
                        </p>
                      </div>
                      {group.unassigned > 0 ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
                          {group.unassigned} pending
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          Assigned
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <AppSelect
                        label={`Facilitator for ${group.sectionName}`}
                        value={sectionDrafts[group.gradeSection] || ""}
                        disabled={loadingTeachers || sectionBusy}
                        onChange={(next) =>
                          setSectionDrafts((prev) => ({
                            ...prev,
                            [group.gradeSection]: next,
                          }))
                        }
                        placeholder={
                          loadingTeachers
                            ? "Loading teachers..."
                            : "Select facilitator for section"
                        }
                        options={[
                          {
                            value: "",
                            label: loadingTeachers
                              ? "Loading teachers..."
                              : "Select facilitator for section",
                          },
                          ...teachers.map((teacher) => ({
                            value: teacher.id,
                            label: teacher.name,
                          })),
                        ]}
                        size="pill"
                        className="min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        disabled={
                          sectionBusy ||
                          !sectionDrafts[group.gradeSection] ||
                          (!overwriteExisting && group.unassigned === 0)
                        }
                        onClick={() => handleAssignSection(group)}
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sectionBusy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserPlus size={12} />
                        )}
                        Assign to section
                      </button>
                    </div>

                    <label className="mt-2 flex items-center gap-2 px-0.5 text-[11px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-cnhs-green-dark accent-cnhs-green-dark focus:ring-cnhs-green-dark"
                        checked={overwriteExisting}
                        onChange={(e) =>
                          setOverwriteExistingBySection((prev) => ({
                            ...prev,
                            [group.gradeSection]: e.target.checked,
                          }))
                        }
                      />
                      Overwrite existing assignments
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setViewLearnersBySection((prev) => ({
                          ...prev,
                          [group.gradeSection]: !prev[group.gradeSection],
                        }))
                      }
                      className="mt-3 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <Users size={12} />
                      {showLearners ? "Hide learners" : "View learners"}
                      <ChevronDown
                        size={12}
                        className={cn(
                          "transition-transform",
                          showLearners ? "rotate-180" : ""
                        )}
                      />
                    </button>

                    {showLearners ? (
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50/40">
                        <table className="min-w-[720px] w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-slate-50/80">
                              {[
                                "ARAL Learner",
                                "Identified in",
                                "Subject Teacher",
                                "Facilitator",
                                "Action",
                              ].map((column) => (
                                <th
                                  key={column}
                                  className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.learners.map((learner) => {
                              const busy = busyId === learner.studentId;
                              const isAssigned = Boolean(
                                learner.aralFacilitatorTeacherId
                              );
                              const showFacilitatorSelect =
                                overwriteExisting || !isAssigned;
                              return (
                                <tr
                                  key={learner.studentId}
                                  className="border-t border-slate-100 bg-white hover:bg-slate-50/70"
                                >
                                  <td className="px-2.5 py-2">
                                    <p className="text-[12px] font-semibold text-slate-800">
                                      {learner.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      {learner.studentNumber}
                                    </p>
                                  </td>
                                  <td className="px-2.5 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {learner.subjects.map((subject) => (
                                        <span
                                          key={subject}
                                          className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
                                        >
                                          {subject}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2 text-[11px] text-slate-600">
                                    {learner.teacherNames.join(", ") || "—"}
                                  </td>
                                  <td className="px-2.5 py-2">
                                    {showFacilitatorSelect ? (
                                      <AppSelect
                                        label={`Facilitator for ${learner.name}`}
                                        value={drafts[learner.studentId] || ""}
                                        disabled={loadingTeachers || busy}
                                        onChange={(next) =>
                                          setDrafts((prev) => ({
                                            ...prev,
                                            [learner.studentId]: next,
                                          }))
                                        }
                                        placeholder={
                                          loadingTeachers
                                            ? "Loading..."
                                            : "Select facilitator"
                                        }
                                        options={[
                                          {
                                            value: "",
                                            label: loadingTeachers
                                              ? "Loading..."
                                              : "Select facilitator",
                                          },
                                          ...teachers.map((teacher) => ({
                                            value: teacher.id,
                                            label: teacher.name,
                                          })),
                                        ]}
                                        triggerClassName={cn(
                                          "h-7 min-w-[160px] rounded-full px-2 text-[11px]",
                                          loadingTeachers && "bg-slate-50"
                                        )}
                                      />
                                    ) : null}

                                    {learner.aralFacilitatorName ? (
                                      <p className="mt-0.5 text-[10px] text-violet-600">
                                        Current: {learner.aralFacilitatorName}
                                      </p>
                                    ) : (
                                      <p className="mt-0.5 text-[10px] text-amber-600">
                                        Unassigned
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-2.5 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {showFacilitatorSelect ? (
                                        <button
                                          type="button"
                                          disabled={
                                            busy || !drafts[learner.studentId]
                                          }
                                          onClick={() => handleAssign(learner)}
                                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-cnhs-green-dark px-2.5 text-[10px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {busy ? (
                                            <Loader2
                                              size={11}
                                              className="animate-spin"
                                            />
                                          ) : (
                                            <UserPlus size={11} />
                                          )}
                                          Assign
                                        </button>
                                      ) : null}

                                      {overwriteExisting &&
                                      learner.aralAssignmentId ? (
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => handleRemove(learner)}
                                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed"
                                        >
                                          <X size={11} />
                                          Remove
                                        </button>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {visibleSections.length > SECTIONS_PAGE_SIZE ? (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-[11px] font-medium text-slate-500">
                Showing{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  {sectionStart}–{sectionEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  {visibleSections.length}
                </span>{" "}
                sections · {SECTIONS_PAGE_SIZE} per page
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                  Previous
                </button>
                <span className="min-w-[4rem] text-center text-[11px] font-semibold tabular-nums text-slate-600">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
