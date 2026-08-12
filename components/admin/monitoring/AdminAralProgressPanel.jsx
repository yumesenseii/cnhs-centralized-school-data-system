"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Eye,
  Folder,
  Loader2,
} from "lucide-react";
import AralAssessmentComments from "@/components/teacher/aral-program/AralAssessmentComments";
import AralAssessmentReadonlyGrid from "@/components/teacher/aral-program/AralAssessmentReadonlyGrid";
import {
  Pill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import { ARAL_ASSESSMENT_PHASE } from "@/lib/monitoring/aralAssessments";
import { isAralProgramLearner } from "@/lib/monitoring/aralProgress";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import { ensureActiveAralBatch } from "@/lib/supabase/queries/aralProgram";
import { cn } from "@/lib/utils";

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

function buildSectionGroups(aralRows = []) {
  const bySection = new Map();

  for (const row of aralRows) {
    const sectionKey = String(row.gradeSection || "Unassigned section").trim();
    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, {
        gradeSection: sectionKey,
        grade: parseGradeLabel(sectionKey, row.gradeLevel),
        learners: [],
        schoolYear: row.schoolYear || "",
        facilitatorName: "",
      });
    }
    const group = bySection.get(sectionKey);
    group.learners.push(row);
    if (!group.schoolYear && row.schoolYear) group.schoolYear = row.schoolYear;
    if (row.aralFacilitatorName) {
      group.facilitatorName = row.aralFacilitatorName;
    }
  }

  return [...bySection.values()]
    .map((group) => ({
      ...group,
      sectionName: sectionDisplayName(group.gradeSection, group.grade),
      count: group.learners.length,
      assignedCount: group.learners.filter((l) => l.aralFacilitatorTeacherId)
        .length,
    }))
    .sort((a, b) =>
      String(a.gradeSection).localeCompare(String(b.gradeSection))
    );
}

function buildGradeFolders(sectionGroups = []) {
  const byGrade = new Map();
  for (const group of sectionGroups) {
    if (!byGrade.has(group.grade)) {
      byGrade.set(group.grade, {
        grade: group.grade,
        sections: [],
        count: 0,
      });
    }
    const folder = byGrade.get(group.grade);
    folder.sections.push(group);
    folder.count += group.count;
  }
  return [...byGrade.values()].sort(
    (a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade)
  );
}

const DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "pre", label: "Pre-Test" },
  { id: "mid", label: "Mid-Test" },
  { id: "post", label: "Post-Test" },
];

/**
 * Admin view-only: ARAL assessments by grade → section + HT comments.
 */
export default function AdminAralProgressPanel({
  students = [],
  onViewStudent,
}) {
  const aralLearners = useMemo(
    () => students.filter(isAralProgramLearner),
    [students]
  );

  const sectionGroups = useMemo(
    () => buildSectionGroups(aralLearners),
    [aralLearners]
  );

  const gradeFolders = useMemo(
    () => buildGradeFolders(sectionGroups),
    [sectionGroups]
  );

  const [selectedGrade, setSelectedGrade] = useState(null);
  const [activeSectionKey, setActiveSectionKey] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [batchId, setBatchId] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [profileId, setProfileId] = useState(null);

  const activeFolder = useMemo(
    () => gradeFolders.find((f) => f.grade === selectedGrade) ?? null,
    [gradeFolders, selectedGrade]
  );

  const activeSection = useMemo(
    () =>
      sectionGroups.find((g) => g.gradeSection === activeSectionKey) ?? null,
    [sectionGroups, activeSectionKey]
  );

  const schoolYearHint =
    activeSection?.schoolYear ||
    sectionGroups[0]?.schoolYear ||
    aralLearners[0]?.schoolYear ||
    "SY 2026-2027";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBatchLoading(true);
      const [batchResult, session] = await Promise.all([
        ensureActiveAralBatch(schoolYearHint),
        getAdminSession(),
      ]);
      if (cancelled) return;
      setBatchId(batchResult.data?.id ?? null);
      setProfileId(session.data?.id ?? null);
      setBatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolYearHint]);

  useEffect(() => {
    if (
      selectedGrade &&
      !gradeFolders.some((f) => f.grade === selectedGrade)
    ) {
      setSelectedGrade(null);
      setActiveSectionKey(null);
    }
  }, [gradeFolders, selectedGrade]);

  useEffect(() => {
    if (
      activeSectionKey &&
      !sectionGroups.some((g) => g.gradeSection === activeSectionKey)
    ) {
      setActiveSectionKey(null);
    }
  }, [sectionGroups, activeSectionKey]);

  return (
    <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-50 bg-sky-50/40 px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            ARAL Assessments
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            View-only Pre / Mid / Post scores by section. Post comments for
            facilitators; weekly learner progress remains available per student.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
          {aralLearners.length} learner
          {aralLearners.length === 1 ? "" : "s"} · {sectionGroups.length}{" "}
          section{sectionGroups.length === 1 ? "" : "s"}
        </span>
      </div>

      {!sectionGroups.length ? (
        <p className="px-3 py-8 text-center text-[12px] text-slate-400">
          No ARAL Learners yet. Assign facilitators after English / Filipino
          teachers identify candidates.
        </p>
      ) : activeSection ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <button
              type="button"
              onClick={() => {
                setActiveSectionKey(null);
                setDetailTab("overview");
              }}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={13} />
              Back to sections
            </button>
            <div className="min-w-0 text-right">
              <p className="text-[13px] font-semibold text-slate-800">
                {activeSection.gradeSection}
              </p>
              <p className="text-[10px] text-slate-500">
                {activeSection.count} learners · Facilitator:{" "}
                {activeSection.facilitatorName || "Unassigned"}
              </p>
            </div>
          </div>

          <div
            className="flex items-end gap-4 overflow-x-auto border-b border-slate-200 px-3 sm:px-4"
            role="tablist"
          >
            {DETAIL_TABS.map((tab) => {
              const selected = detailTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    "-mb-px shrink-0 cursor-pointer border-b-2 px-0.5 py-2.5 text-[13px] transition-colors",
                    selected
                      ? "border-cnhs-green-dark font-semibold text-cnhs-green-dark"
                      : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 p-3 sm:p-4">
            {batchLoading ? (
              <div className="flex items-center gap-2 text-[12px] text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Resolving ARAL batch…
              </div>
            ) : null}

            {detailTab === "overview" ? (
              <>
                <AralAssessmentComments
                  batchId={batchId}
                  gradeSection={activeSection.gradeSection}
                  canPost
                  profileId={profileId}
                  title="Comments for facilitator"
                />
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-[720px] w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80">
                        {[
                          "Student",
                          "Facilitator",
                          "Latest Progress",
                          "Status",
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
                      {activeSection.learners.map((learner) => (
                        <tr
                          key={learner.id || learner.studentId}
                          className="border-t border-slate-100 hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2">
                            <p className="text-[12px] font-semibold text-slate-800">
                              {learner.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {learner.studentNumber}
                            </p>
                            <Pill
                              value={
                                learner.recommendationDisplay ||
                                learner.recommendation
                              }
                              styles={interventionStyles}
                            />
                          </td>
                          <td className="px-3 py-2 text-[12px] text-slate-600">
                            {learner.aralFacilitatorName || (
                              <span className="text-amber-600">Unassigned</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[12px] text-slate-600">
                            {learner.latestProgress || "—"}
                            <p className="text-[10px] text-slate-400">
                              {learner.weeklyUpdateCount
                                ? `${learner.weeklyUpdateCount} weekly update(s)`
                                : "No weekly updates yet"}
                            </p>
                          </td>
                          <td className="px-3 py-2">
                            <Pill
                              value={learner.monitoringStatus}
                              styles={monitoringStatusStyles}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => onViewStudent?.(learner)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={12} />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {detailTab === "pre" ||
            detailTab === "mid" ||
            detailTab === "post" ? (
              <>
                <AralAssessmentReadonlyGrid
                  learners={activeSection.learners}
                  batchId={batchId}
                  gradeSection={activeSection.gradeSection}
                  phase={
                    detailTab === "mid"
                      ? ARAL_ASSESSMENT_PHASE.MID
                      : detailTab === "post"
                        ? ARAL_ASSESSMENT_PHASE.POST
                        : ARAL_ASSESSMENT_PHASE.PRE
                  }
                />
                <AralAssessmentComments
                  batchId={batchId}
                  gradeSection={activeSection.gradeSection}
                  phase={detailTab}
                  canPost
                  profileId={profileId}
                  title="Phase comments"
                />
              </>
            ) : null}
          </div>
        </div>
      ) : !selectedGrade ? (
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
          {gradeFolders.map((folder) => (
            <button
              key={folder.grade}
              type="button"
              onClick={() => setSelectedGrade(folder.grade)}
              className="group flex cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-sky-200 hover:bg-sky-50/30"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <Folder size={18} strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-[13px] font-semibold text-slate-900">
                {folder.grade}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {folder.count} learners · {folder.sections.length} sections
              </p>
              <span className="mt-4 text-[11px] font-semibold text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </span>
            </button>
          ))}
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
            <p className="text-[13px] font-semibold text-slate-800">
              {selectedGrade}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {(activeFolder?.sections ?? []).map((group) => (
              <button
                key={group.gradeSection}
                type="button"
                onClick={() => {
                  setActiveSectionKey(group.gradeSection);
                  setDetailTab("overview");
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left hover:bg-slate-50/80 sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800">
                    {group.sectionName}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {group.count} learners · Facilitator:{" "}
                    {group.facilitatorName || "Unassigned"}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-sky-700">
                  Open →
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
