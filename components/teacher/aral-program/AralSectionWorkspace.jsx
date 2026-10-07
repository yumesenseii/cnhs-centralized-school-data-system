"use client";

import { useCallback, useEffect, useState } from "react";
import AralAssessmentComments from "@/components/teacher/aral-program/AralAssessmentComments";
import AralAssessmentPanel from "@/components/teacher/aral-program/AralAssessmentPanel";
import AralSectionReportPanel from "@/components/teacher/aral-program/AralSectionReportPanel";
import AralWeeklyGridPanel from "@/components/teacher/aral-program/AralWeeklyGridPanel";
import ConfirmModal from "@/components/shared/ConfirmModal";
import { ARAL_ASSESSMENT_PHASE } from "@/lib/monitoring/aralAssessments";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { getAralPeriodPermissions } from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

const WORKSPACE_TABS = [
  { id: "weekly", label: "Weekly" },
  { id: "pre", label: "Beginning Assessment" },
  { id: "mid", label: "Mid-Year Assessment" },
  { id: "post", label: "End-of-Year Assessment" },
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
  const { period: aralPeriod } = useAralAssessmentPeriod();
  const periodPermissions = getAralPeriodPermissions(aralPeriod);
  // Future assessment periods are never visible for entry.
  const visibleTabs = WORKSPACE_TABS.filter((item) => {
    if (item.id === "pre") return !periodPermissions.BOSY.hidden;
    if (item.id === "mid") return !periodPermissions.MOSY.hidden;
    if (item.id === "post") return !periodPermissions.EOSY.hidden;
    return true;
  });

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
          {visibleTabs.map((item) => (
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
            assessmentPeriod={aralPeriod}
          />
        ) : null}

        {tab === "mid" ? (
          <AralAssessmentPanel
            group={group}
            teacherId={teacherId}
            phase={ARAL_ASSESSMENT_PHASE.MID}
            assessmentPeriod={aralPeriod}
          />
        ) : null}

        {tab === "post" ? (
          <AralAssessmentPanel
            group={group}
            teacherId={teacherId}
            phase={ARAL_ASSESSMENT_PHASE.POST}
            assessmentPeriod={aralPeriod}
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
          title="Comments from School Principal"
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
