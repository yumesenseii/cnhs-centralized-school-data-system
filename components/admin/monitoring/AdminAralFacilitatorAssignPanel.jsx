"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  UserPlus,
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
import { cn } from "@/lib/utils";

const SECTIONS_PAGE_SIZE = 10;

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
      return {
        gradeSection,
        learners,
        unassigned,
        count: learners.length,
      };
    })
    .sort((a, b) => String(a.gradeSection).localeCompare(String(b.gradeSection)));
}

/**
 * Admin panel: assign Summer ARAL Program facilitators to ARAL Learners.
 * Grouped by section; subject teachers still identify; facilitators submit weekly progress.
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

  const uniqueLearnerCount = useMemo(() => {
    const ids = new Set();
    for (const group of sectionGroups) {
      for (const learner of group.learners) ids.add(learner.studentId);
    }
    return ids.size;
  }, [sectionGroups]);

  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [sectionDrafts, setSectionDrafts] = useState({});
  // When OFF: only assigns to unassigned learners.
  // When ON: also overwrites existing facilitator assignments.
  const [overwriteExistingBySection, setOverwriteExistingBySection] =
    useState({});
  const [openSections, setOpenSections] = useState({});
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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

  const totalPages = Math.max(
    1,
    Math.ceil(sectionGroups.length / SECTIONS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * SECTIONS_PAGE_SIZE;
    return sectionGroups.slice(start, start + SECTIONS_PAGE_SIZE);
  }, [sectionGroups, safePage]);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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
    setToast("");

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
    setToast(`Facilitator assigned for ${learner.name}.`);
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
      setToast(
        `All learners in ${group.gradeSection} are already assigned.`
      );
      return;
    }

    setBusyId(`section:${group.gradeSection}`);
    setError("");
    setToast("");

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
    setToast(
      `Facilitator assigned to ${learnersToAssign.length} learner${
        learnersToAssign.length === 1 ? "" : "s"
      } in ${group.gradeSection}.`
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
    setToast(`Facilitator removed for ${learner.name}.`);
    onChanged?.();
  }

  const sectionStart =
    sectionGroups.length === 0
      ? 0
      : (safePage - 1) * SECTIONS_PAGE_SIZE + 1;
  const sectionEnd = Math.min(
    safePage * SECTIONS_PAGE_SIZE,
    sectionGroups.length
  );

  return (
    <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-50 bg-violet-50/40 px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Assign ARAL Facilitators
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Browse by section, then assign a Summer ARAL facilitator. Subject
            teachers still identify Eng/Fil ARAL Learners; facilitators submit
            weekly progress.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">
          {uniqueLearnerCount} learner
          {uniqueLearnerCount === 1 ? "" : "s"} · {sectionGroups.length}{" "}
          section{sectionGroups.length === 1 ? "" : "s"}
        </span>
      </div>

      {toast ? (
        <div className="border-b border-green-100 bg-green-50 px-3 py-2 text-[11px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}
      {error ? (
        <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {!sectionGroups.length ? (
        <p className="px-3 py-8 text-center text-[12px] text-slate-400">
          No ARAL Learners identified yet. English / Filipino teachers identify
          candidates from ECR grades first.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {pagedSections.map((group) => {
            const open = Boolean(openSections[group.gradeSection]);
            const sectionBusy = busyId === `section:${group.gradeSection}`;
            return (
              <div key={group.gradeSection}>
                <button
                  type="button"
                  onClick={() => toggleSection(group.gradeSection)}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 sm:px-4"
                >
                  <ChevronDown
                    size={16}
                    className={cn(
                      "shrink-0 text-slate-400 transition-transform",
                      open ? "rotate-180" : ""
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {group.gradeSection}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {group.count} learner{group.count === 1 ? "" : "s"}
                      {group.unassigned > 0
                        ? ` · ${group.unassigned} unassigned`
                        : " · all assigned"}
                    </p>
                  </div>
                </button>

                {open ? (
                  <div className="border-t border-slate-50 bg-slate-50/40 px-3 py-3 sm:px-4">
                    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:flex-row sm:items-center">
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">
                          Facilitator for {group.gradeSection}
                        </span>
                        <select
                          value={sectionDrafts[group.gradeSection] || ""}
                          disabled={loadingTeachers || sectionBusy}
                          onChange={(e) =>
                            setSectionDrafts((prev) => ({
                              ...prev,
                              [group.gradeSection]: e.target.value,
                            }))
                          }
                          className="h-7 w-full cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 outline-none focus:border-cnhs-green"
                        >
                          <option value="">
                            {loadingTeachers
                              ? "Loading teachers..."
                              : "Select facilitator for section"}
                          </option>
                          {teachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={
                          sectionBusy ||
                          !sectionDrafts[group.gradeSection] ||
                          (!Boolean(overwriteExistingBySection[group.gradeSection]) &&
                            group.unassigned === 0)
                        }
                        onClick={() => handleAssignSection(group)}
                        className="inline-flex h-7 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sectionBusy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserPlus size={12} />
                        )}
                        Assign to section
                      </button>
                    </div>

                    <label className="mb-3 flex items-center gap-2 rounded-full px-2 py-1.5 text-[11px] font-medium text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded-full border-slate-300 text-cnhs-green-dark accent-cnhs-green-dark focus:ring-cnhs-green-dark"
                        checked={Boolean(
                          overwriteExistingBySection[group.gradeSection]
                        )}
                        onChange={(e) =>
                          setOverwriteExistingBySection((prev) => ({
                            ...prev,
                            [group.gradeSection]: e.target.checked,
                          }))
                        }
                      />
                      Overwrite existing assignments
                    </label>

                    <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
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
                            const overwriteExisting = Boolean(
                              overwriteExistingBySection[group.gradeSection]
                            );
                            const isAssigned = Boolean(
                              learner.aralFacilitatorTeacherId
                            );
                            const showFacilitatorSelect =
                              overwriteExisting || !isAssigned;
                            return (
                              <tr
                                key={learner.studentId}
                                className="border-t border-slate-100 hover:bg-slate-50/70"
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
                                        className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100"
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
                                    <select
                                      value={drafts[learner.studentId] || ""}
                                      disabled={loadingTeachers || busy}
                                      onChange={(e) =>
                                        setDrafts((prev) => ({
                                          ...prev,
                                          [learner.studentId]: e.target.value,
                                        }))
                                      }
                                      className={cn(
                                        "h-7 w-full min-w-[160px] rounded-full border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-cnhs-green",
                                        loadingTeachers && "bg-slate-50"
                                      )}
                                    >
                                      <option value="">
                                        {loadingTeachers
                                          ? "Loading..."
                                          : "Select facilitator"}
                                      </option>
                                      {teachers.map((teacher) => (
                                        <option
                                          key={teacher.id}
                                          value={teacher.id}
                                        >
                                          {teacher.name}
                                        </option>
                                      ))}
                                    </select>
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
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {sectionGroups.length > SECTIONS_PAGE_SIZE ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-[11px] font-medium text-slate-500">
            Showing{" "}
            <span className="font-semibold tabular-nums text-slate-700">
              {sectionStart}–{sectionEnd}
            </span>{" "}
            of{" "}
            <span className="font-semibold tabular-nums text-slate-700">
              {sectionGroups.length}
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
    </section>
  );
}
