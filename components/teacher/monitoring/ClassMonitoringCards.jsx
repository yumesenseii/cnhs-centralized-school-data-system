"use client";

import { motion } from "framer-motion";
import { classroomRemedialStyles } from "@/components/teacher/monitoring/shared";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only (no icon tiles).
const METRIC_VALUE_TONES = {
  students: "text-blue-700",
  risk: "text-red-700",
  monitoring: "text-blue-700",
  aral: "text-amber-800",
  below: "text-amber-800",
  average: "text-violet-700",
};

export default function ClassMonitoringCards({ classSummaries = [] }) {
  if (!classSummaries.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">Assigned Classes</h2>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          classSummaries.length > 1 && "xl:grid-cols-2"
        )}
      >
        {classSummaries.map((classItem) => {
          const metrics = [
            {
              label: "Students",
              value: classItem.totalStudents,
              tone: METRIC_VALUE_TONES.students,
            },
            {
              label: "At Risk",
              value: classItem.studentsAtRisk,
              tone: METRIC_VALUE_TONES.risk,
            },
            classItem.aralEligible
              ? {
                  label: "ARAL",
                  value: classItem.aralCount,
                  tone: METRIC_VALUE_TONES.aral,
                }
              : {
                  label: "Monitoring",
                  value: classItem.underMonitoringCount ?? 0,
                  tone: METRIC_VALUE_TONES.monitoring,
                },
            {
              label: "Below 75",
              value: classItem.belowPassingCount ?? 0,
              tone: METRIC_VALUE_TONES.below,
            },
            {
              label: "Class Avg",
              value: classItem.averageClassGrade ?? "—",
              tone: METRIC_VALUE_TONES.average,
            },
          ];

          return (
            <motion.section
              key={classItem.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex h-full min-h-[140px] w-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                  {classItem.subject} · {classItem.gradeSection}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {classItem.schoolYear} · {classItem.quarterLabel}
                </p>
                <span
                  title={classItem.classroomRemedial}
                  className={cn(
                    "mt-1.5 inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    classroomRemedialStyles[classItem.classroomRemedial] ??
                      "bg-slate-100 text-slate-500"
                  )}
                >
                  {classItem.classroomRemedial}
                </span>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4 sm:grid-cols-5">
                {metrics.map((metric) => {
                  return (
                    <div
                      key={metric.label}
                      className="min-w-0 rounded-lg border border-slate-100 bg-white px-2.5 py-2"
                    >
                      <p className={cn("text-base font-bold tracking-tight", metric.tone)}>
                        {metric.value}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {metric.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
