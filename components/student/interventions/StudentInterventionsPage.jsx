"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <StudentPageHeader
        breadcrumb="Home / Interventions / PLP"
        title="Interventions / PLP"
        subtitle="Personalized Learning Plan recommendations for you and your class"
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading interventions…
        </div>
      ) : (
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <RiskPill value={data.summary.riskLevel} />
              <span className="text-[12px] text-slate-600">
                {data.summary.activeInterventionCount
                  ? `You have ${data.summary.activeInterventionCount} active recommendation${data.summary.activeInterventionCount === 1 ? "" : "s"}.`
                  : "No intervention recommended right now."}
              </span>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-slate-500">
              These are school support recommendations based on your grades, not
              punishment. Talk to your subject teacher or adviser for next steps.
            </p>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Active interventions
            </h2>
            <div className="mt-3 space-y-3">
              {data.interventions.length ? (
                data.interventions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
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
                    <p className="mt-2 text-[13px] font-semibold text-slate-800">
                      {item.subject}
                      {item.sectionLabel ? ` · ${item.sectionLabel}` : ""}
                    </p>
                    {item.grade != null ? (
                      <p className="mt-1 text-[12px] text-slate-600">
                        Your grade:{" "}
                        <span className="font-semibold">{item.grade}</span>
                      </p>
                    ) : null}
                    <p className="mt-2 text-[12px] leading-5 text-slate-500">
                      {item.explanation}
                    </p>
                    {item.reasons?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-500">
                        {item.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  No PLP interventions at this time.
                </p>
              )}
            </div>
          </section>

          {data.summary.weakSubjects.length ? (
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Weak subjects
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Subjects with final grade below 75
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.summary.weakSubjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Teacher follow-up status
            </h2>
            {data.monitoring ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {data.monitoring.status}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                    Intervention given
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {data.monitoring.interventionGiven || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                    Progress
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {data.monitoring.progress || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                    Last observation
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {data.monitoring.observationDate || "—"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-slate-500">
                No monitoring follow-up has been recorded by your teacher yet.
              </p>
            )}
            <p className="mt-3 text-[11px] leading-5 text-slate-400">
              Follow-up status tracks support progress in school. It is not a
              lesson or module upload.
            </p>
          </section>
        </div>
      )}
    </motion.div>
  );
}
