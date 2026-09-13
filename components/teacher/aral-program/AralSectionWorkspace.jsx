"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import AralAssessmentComments from "@/components/teacher/aral-program/AralAssessmentComments";
import AralAssessmentPanel from "@/components/teacher/aral-program/AralAssessmentPanel";
import AralSectionReportPanel from "@/components/teacher/aral-program/AralSectionReportPanel";
import AralWeeklyGridPanel from "@/components/teacher/aral-program/AralWeeklyGridPanel";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { ARAL_ASSESSMENT_PHASE } from "@/lib/monitoring/aralAssessments";
import { cn } from "@/lib/utils";

const WORKSPACE_TABS = [
  { id: "weekly", label: "Weekly" },
  { id: "pre", label: "Pre-Test" },
  { id: "mid", label: "Mid-Test" },
  { id: "post", label: "Post-Test" },
  { id: "report", label: "Report" },
];

/**
 * Facilitator section workspace — tabbed Weekly / Pre / Mid / Post / Report.
 * Weekly and scores stay on separate Saves. Same assigned roster only.
 */
export default function AralSectionWorkspace({
  group,
  teacherName = "Facilitator",
  teacherId = null,
  onBack,
}) {
  const learners = group?.learners ?? [];
  const batchId = learners[0]?.batchId ?? null;
  const canWrite = Boolean(teacherId);

  const [tab, setTab] = useState("weekly");
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  useEffect(() => {
    setTab("weekly");
    setWeeklyDirty(false);
    setPendingTab(null);
  }, [group?.gradeSection]);

  const requestTab = useCallback(
    (next) => {
      if (next === tab) return;
      if (tab === "weekly" && weeklyDirty) {
        setPendingTab(next);
        return;
      }
      setTab(next);
    },
    [tab, weeklyDirty]
  );

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
          <AralAssessmentComments
            batchId={batchId}
            gradeSection={group.gradeSection}
            canPost={false}
            title="Comments from Head Teacher"
          />

          <div
            role="tablist"
            aria-label="ARAL section workspace"
            className="flex flex-wrap gap-1 rounded-xl border border-slate-100 bg-slate-50/70 p-1"
          >
            {WORKSPACE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => requestTab(item.id)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-[11px] font-semibold",
                  tab === item.id
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "weekly" ? (
            <AralWeeklyGridPanel
              group={group}
              teacherId={teacherId}
              canWrite={canWrite}
              onDirtyChange={setWeeklyDirty}
            />
          ) : null}

          {tab === "pre" ? (
            <AralAssessmentPanel
              group={group}
              teacherId={teacherId}
              phase={ARAL_ASSESSMENT_PHASE.PRE}
            />
          ) : null}

          {tab === "mid" ? (
            <AralAssessmentPanel
              group={group}
              teacherId={teacherId}
              phase={ARAL_ASSESSMENT_PHASE.MID}
            />
          ) : null}

          {tab === "post" ? (
            <AralAssessmentPanel
              group={group}
              teacherId={teacherId}
              phase={ARAL_ASSESSMENT_PHASE.POST}
            />
          ) : null}

          {tab === "report" ? (
            <AralSectionReportPanel
              group={group}
              teacherName={teacherName}
            />
          ) : null}
        </div>
      </section>

      <ConfirmModal
        open={pendingTab != null}
        title="Leave Weekly?"
        message="This week has unsaved changes. Switch tabs without saving?"
        confirmLabel="Switch tab"
        cancelLabel="Stay"
        onCancel={() => setPendingTab(null)}
        onConfirm={() => {
          const next = pendingTab;
          setPendingTab(null);
          setWeeklyDirty(false);
          if (next) setTab(next);
        }}
      />
    </>
  );
}
