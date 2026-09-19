"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import RiskBadge from "@/components/academic-records/RiskBadge";
import TablePagination from "@/components/academic-records/TablePagination";
import LearnerName from "@/components/shared/LearnerName";
import { cn } from "@/lib/utils";

const ATTENTION_PAGE_SIZE = 10;

const avatarTones = {
  red: "bg-red-100 text-red-600",
  orange: "bg-orange-100 text-cnhs-orange",
  blue: "bg-sky-100 text-sky-700",
  green: "bg-green-100 text-cnhs-green-dark",
  violet: "bg-violet-100 text-violet-700",
};

const interventionStyles = {
  "ARAL Learner": "bg-sky-50 text-sky-700",
  "ARAL Learners": "bg-sky-50 text-sky-700",
  "ARAL Screening": "bg-sky-50 text-sky-700",
  "Recommended for ARAL Learners": "bg-sky-50 text-sky-700",
  "Recommended for ARAL Screening": "bg-sky-50 text-sky-700",
  "No Recommendation": "bg-slate-100 text-slate-600",
  "Classroom Remediation": "bg-green-50 text-cnhs-green-dark",
  "Potential ARAL Learners": "bg-sky-50 text-sky-700",
  "Potential ARAL Screening": "bg-sky-50 text-sky-700",
  "Teacher-Based Intervention": "bg-green-50 text-cnhs-green-dark",
  "Classroom Remedial (Class-Level)": "bg-green-50 text-cnhs-green-dark",
  "Classroom Remedial Recommended": "bg-green-50 text-cnhs-green-dark",
};

function shortIntervention(value) {
  const raw = String(value ?? "");
  if (/classroom remedial/i.test(raw)) return "Remedial";
  if (/no recommendation/i.test(raw)) return "None";
  if (/aral/i.test(raw)) return "ARAL";
  return raw || "—";
}

export default function LearnersAttention({
  learners = [],
  embedded = false,
  limit = null,
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [learners, limit]);

  const cappedLearners = useMemo(() => {
    if (limit != null && Number.isFinite(Number(limit))) {
      return learners.slice(0, Number(limit));
    }
    return learners;
  }, [learners, limit]);

  const useLimit = limit != null && Number.isFinite(Number(limit));
  const pageSize = useLimit ? Number(limit) : ATTENTION_PAGE_SIZE;
  const totalPages = Math.max(
    1,
    Math.ceil((useLimit ? cappedLearners.length : learners.length) / pageSize) ||
      1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedLearners = useMemo(() => {
    if (useLimit) return cappedLearners;
    const start = (safePage - 1) * ATTENTION_PAGE_SIZE;
    return learners.slice(start, start + ATTENTION_PAGE_SIZE);
  }, [learners, cappedLearners, safePage, useLimit]);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-100 bg-white",
        embedded
          ? "shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          : "shadow-[0_4px_12px_rgba(15,23,42,0.03)]"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Learners Requiring Attention
          </h2>
          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
            {learners.length}
          </span>
        </div>
        <Link
          href="/teacher/monitoring"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
        >
          View all
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Student",
                "Grade & Section",
                "Weak Subject",
                "Grade",
                "Risk",
                "Intervention",
                "Action",
              ].map((column) => (
                <th
                  key={column}
                  className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.length ? (
              pagedLearners.map((learner) => (
                <tr
                  key={learner.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold",
                          avatarTones[learner.avatarTone] ?? avatarTones.green
                        )}
                      >
                        {learner.initials}
                      </span>
                      <span className="min-w-0">
                        <LearnerName
                          firstName={learner.firstName}
                          middleName={learner.middleName}
                          lastName={learner.lastName}
                          name={learner.name}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-[11px] text-slate-600">
                    {learner.gradeSection}
                  </td>
                  <td className="px-2 py-1 text-[11px] text-slate-600">
                    {learner.weakSubject}
                  </td>
                  <td className="px-2 py-1 text-[12px] font-semibold text-slate-800">
                    {learner.currentGrade}
                  </td>
                  <td className="px-2 py-1">
                    <RiskBadge value={learner.riskLevel} dense />
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-4",
                        interventionStyles[learner.intervention] ??
                          "bg-slate-100 text-slate-600"
                      )}
                      title={learner.intervention}
                    >
                      {shortIntervention(learner.intervention)}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <Link
                      href={
                        learner.classId && learner.studentId
                          ? `/teacher/monitoring/${learner.classId}/students/${learner.studentId}`
                          : "/teacher/monitoring"
                      }
                      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50"
                      title={
                        learner.classId && learner.studentId
                          ? "Open learner monitoring"
                          : "Open Academic Monitoring"
                      }
                    >
                      <Eye size={11} />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-[11px] text-slate-500"
                >
                  No learners currently require attention.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!useLimit && learners.length ? (
        <div className="border-t border-slate-100 px-3 py-1.5">
          <TablePagination
            page={safePage}
            pageSize={ATTENTION_PAGE_SIZE}
            total={learners.length}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </section>
  );
}
