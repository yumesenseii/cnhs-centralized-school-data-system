"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import {
  listTeachersForFacilitatorSelect,
  removeAralFacilitatorAssignment,
  upsertAralFacilitatorAssignment,
} from "@/lib/supabase/queries/aralProgram";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import { cn } from "@/lib/utils";

/**
 * Admin panel: assign Summer ARAL Program facilitators to ARAL Learners.
 * Subject teachers still identify learners; facilitators submit weekly progress.
 */
export default function AdminAralFacilitatorAssignPanel({
  students = [],
  onChanged,
}) {
  const aralLearners = useMemo(
    () => students.filter(isAralRecommended),
    [students]
  );

  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [drafts, setDrafts] = useState({});
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
    for (const learner of aralLearners) {
      next[learner.studentId] = learner.aralFacilitatorTeacherId || "";
    }
    setDrafts(next);
  }, [aralLearners]);

  async function handleAssign(learner) {
    const teacherId = drafts[learner.studentId];
    if (!teacherId) {
      setError("Select a facilitator before assigning.");
      return;
    }
    setBusyId(learner.studentId);
    setError("");
    setToast("");

    const session = await getAdminSession();
    const result = await upsertAralFacilitatorAssignment({
      studentId: learner.studentId,
      facilitatorTeacherId: teacherId,
      sourceClassId: learner.classId,
      schoolYear: learner.schoolYear || "SY 2026-2027",
      assignedByProfileId: session.data?.id ?? null,
    });

    setBusyId("");
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setToast(`Facilitator assigned for ${learner.name}.`);
    onChanged?.();
  }

  async function handleRemove(learner) {
    if (!learner.aralAssignmentId) return;
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

  return (
    <section className="overflow-hidden rounded-xl border border-violet-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-50 bg-violet-50/40 px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Assign ARAL Facilitators
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Summer ARAL Program only. Subject teachers still identify ARAL
            Learners (English / Filipino). Assigned facilitators submit weekly
            progress. Demo failing Eng/Fil grades are seeded for SY 2026-2027 —
            replace with real ECR data later.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          {aralLearners.length} candidate
          {aralLearners.length === 1 ? "" : "s"}
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

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left">
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
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aralLearners.length ? (
              aralLearners.map((learner) => {
                const busy = busyId === learner.studentId;
                return (
                  <tr
                    key={learner.id}
                    className="border-t border-slate-100 hover:bg-slate-50/70"
                  >
                    <td className="px-3 py-2">
                      <p className="text-[12px] font-semibold text-slate-800">
                        {learner.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {learner.studentNumber} · {learner.gradeSection}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {learner.subject}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">
                      {learner.teacherName || "—"}
                    </td>
                    <td className="px-3 py-2">
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
                          "h-8 w-full min-w-[180px] rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-700 outline-none focus:border-cnhs-green",
                          loadingTeachers && "bg-slate-50"
                        )}
                      >
                        <option value="">
                          {loadingTeachers
                            ? "Loading teachers..."
                            : "Select facilitator"}
                        </option>
                        {teachers.map((teacher) => (
                          <option key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </option>
                        ))}
                      </select>
                      {learner.aralFacilitatorName ? (
                        <p className="mt-1 text-[10px] text-violet-600">
                          Current: {learner.aralFacilitatorName}
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-amber-600">
                          Unassigned — no weekly ARAL updates yet
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy || !drafts[learner.studentId]}
                          onClick={() => handleAssign(learner)}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-2.5 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <UserPlus size={12} />
                          )}
                          Assign
                        </button>
                        {learner.aralAssignmentId ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRemove(learner)}
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed"
                          >
                            <X size={12} />
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-[12px] text-slate-400"
                >
                  No ARAL Learners identified yet. English / Filipino teachers
                  identify candidates from ECR grades first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
