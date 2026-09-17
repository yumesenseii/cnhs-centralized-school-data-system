"use client";

import { useCallback, useEffect, useState } from "react";
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
      <section className="space-y-4">
        <div
          role="tablist"
          aria-label="ARAL section workspace"
          className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-white/10"
        >
          {WORKSPACE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => requestTab(item.id)}
              className={cn(
                "relative -mb-px inline-flex h-9 cursor-pointer items-center px-3 text-[12px] font-semibold",
                tab === item.id
                  ? "border-b-2 border-cnhs-green-dark text-cnhs-green-dark dark:border-cnhs-green dark:text-cnhs-green"
                  : "border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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

        <AralAssessmentComments
          batchId={batchId}
          gradeSection={group.gradeSection}
          canPost={false}
          hideWhenEmpty
          title="Comments from Head Teacher"
        />
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
