"use client";

import { motion } from "framer-motion";
import { ClipboardList, Loader2 } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import StudentSectionCard from "@/components/student/layout/StudentSectionCard";
import {
  Pill,
  RiskPill,
  interventionTypeStyles,
} from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";

export default function StudentInterventionsPage() {
  const { data, loading, error } = useStudentPortal();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="pb-3"
    >
      <StudentPageHeader
        breadcrumb="Home / Interventions"
        title="Interventions"
        subtitle="ARAL Learners and Classroom Remedial from your grades — view only."
      />

      {error ? (
        <div className="mb-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white py-10 text-[13px] text-slate-500">
          <Loader2 size={15} className="animate-spin" />
          Loading interventions…
        </div>
      ) : (
        <div className="space-y-2.5">
          <StudentSectionCard
            icon={ClipboardList}
            title="Summary"
            subtitle="Academic risk from ECR grades only."
          >
            <div className="flex flex-wrap items-center gap-2">
              <RiskPill value={data.summary.riskLevel} />
              <span className="text-[12px] text-slate-600">
                {data.summary.activeInterventionCount
                  ? `${data.summary.activeInterventionCount} active recommendation${data.summary.activeInterventionCount === 1 ? "" : "s"}.`
                  : "No interventions right now."}
              </span>
            </div>
            {data.summary.weakSubjects.length ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Below 75
                </span>
                {data.summary.weakSubjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            ) : null}
          </StudentSectionCard>

          <StudentSectionCard title="Active interventions">
            <div className="space-y-1.5">
              {data.interventions.length ? (
                data.interventions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill value={item.type} styles={interventionTypeStyles} />
                      <RiskPill value={item.riskLevel} />
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                        {item.scope === "class" ? "Class-level" : "Student-level"}
                      </span>
                      {item.approvalStatus ? (
                        <span
                          className={
                            item.approvalStatus === "Approved"
                              ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100"
                              : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
                          }
                        >
                          {item.approvalStatus}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[12px] font-semibold text-slate-800">
                      {item.subject}
                      {item.sectionLabel ? ` · ${item.sectionLabel}` : ""}
                      {item.grade != null ? ` · Grade ${item.grade}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                      {item.explanation}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-[11px] text-slate-400">
                  No interventions right now.
                </p>
              )}
            </div>
          </StudentSectionCard>

          {data.recordedProgress?.checkCount ? (
            <StudentSectionCard
              title="Recorded progress"
              subtitle="Saved Pre / Mid / Post assessment — not a cause claim."
            >
              <p className="text-[12px] font-semibold text-slate-800">
                Latest: {data.recordedProgress.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Baseline → Latest:{" "}
                {data.recordedProgress.baseline?.percent ?? "—"}% →{" "}
                {data.recordedProgress.latest?.percent ?? "—"}%
              </p>
            </StudentSectionCard>
          ) : null}

          <StudentSectionCard title="Teacher follow-up">
            {data.monitoring ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Status", data.monitoring.status],
                  ["Intervention", data.monitoring.interventionGiven || "—"],
                  ["Progress", data.monitoring.progress || "—"],
                  ["Last observation", data.monitoring.observationDate || "—"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                      {label}
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-800">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">
                No teacher monitoring follow-up recorded yet.
              </p>
            )}
          </StudentSectionCard>
        </div>
      )}
    </motion.div>
  );
}
