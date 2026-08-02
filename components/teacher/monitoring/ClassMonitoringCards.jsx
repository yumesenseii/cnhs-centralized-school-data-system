"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Users,
} from "lucide-react";
import { classroomRemedialStyles } from "@/components/teacher/monitoring/shared";
import { cn } from "@/lib/utils";

const METRIC_TONES = {
  students: "bg-sky-50 text-sky-600",
  risk: "bg-red-50 text-red-500",
  monitoring: "bg-sky-50 text-sky-600",
  aral: "bg-orange-50 text-cnhs-orange",
  below: "bg-amber-50 text-amber-700",
  average: "bg-violet-50 text-violet-600",
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
              icon: Users,
              tone: METRIC_TONES.students,
            },
            {
              label: "At Risk",
              value: classItem.studentsAtRisk,
              icon: AlertTriangle,
              tone: METRIC_TONES.risk,
            },
            classItem.aralEligible
              ? {
                  label: "ARAL",
                  value: classItem.aralCount,
                  icon: BookOpen,
                  tone: METRIC_TONES.aral,
                }
              : {
                  label: "Monitoring",
                  value: classItem.underMonitoringCount ?? 0,
                  icon: BookOpen,
                  tone: METRIC_TONES.monitoring,
                },
            {
              label: "Below 75",
              value: classItem.belowPassingCount ?? 0,
              icon: BookOpen,
              tone: METRIC_TONES.below,
            },
            {
              label: "Class Avg",
              value: classItem.averageClassGrade ?? "—",
              icon: GraduationCap,
              tone: METRIC_TONES.average,
            },
          ];

          return (
            <motion.section
              key={classItem.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex h-full min-h-[140px] w-full flex-col rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
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
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark">
                  <GraduationCap size={16} />
                </span>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4 sm:grid-cols-5">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2"
                    >
                      <span
                        className={cn(
                          "mb-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md",
                          metric.tone
                        )}
                      >
                        <Icon size={12} />
                      </span>
                      <p className="text-base font-semibold tracking-[-0.02em] text-slate-900">
                        {metric.value}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-3 text-slate-500">
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
