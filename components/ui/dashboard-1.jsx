"use client";

import React from "react";
import { cn } from "@/lib/utils";

const NOT_AVAILABLE = "Not available";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatCount(value) {
  return value == null ? NOT_AVAILABLE : value.toLocaleString();
}

function percentOf(part, total) {
  if (part == null || total == null || total === 0) return null;
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function gradeEntriesFrom(data) {
  const byGrade = data?.byGrade ?? {};
  return [7, 8, 9, 10].map((grade) => ({
    grade,
    total: toNumber(byGrade[grade]?.total),
    male: toNumber(byGrade[grade]?.male),
    female: toNumber(byGrade[grade]?.female),
  }));
}

/**
 * Returns true when every published total is backed by its parts dynamically,
 * validating:
 * - male + female = grade total for each grade
 * - sum of grade totals = demographics.totalLearners
 * - sum of male values = demographics.maleLearners
 * - sum of female values = demographics.femaleLearners
 */
export function demographicsAreConsistent(data) {
  if (!data) return false;
  const totalLearners = toNumber(data.totalLearners ?? data.total);
  const maleLearners = toNumber(data.maleLearners ?? data.male);
  const femaleLearners = toNumber(data.femaleLearners ?? data.female);

  if (totalLearners == null || maleLearners == null || femaleLearners == null) {
    return false;
  }

  if (maleLearners + femaleLearners !== totalLearners) {
    return false;
  }

  const entries = gradeEntriesFrom(data);
  if (!entries.length) return false;

  let sumGradeTotals = 0;
  let sumMale = 0;
  let sumFemale = 0;

  for (const entry of entries) {
    if (entry.total == null || entry.male == null || entry.female == null) {
      return false;
    }
    if (entry.male + entry.female !== entry.total) {
      return false;
    }
    sumGradeTotals += entry.total;
    sumMale += entry.male;
    sumFemale += entry.female;
  }

  if (sumGradeTotals !== totalLearners) {
    return false;
  }

  if (sumMale !== maleLearners) {
    return false;
  }

  if (sumFemale !== femaleLearners) {
    return false;
  }

  return true;
}

export function Dashboard1({ data, className }) {
  const source = data ?? {};
  const total = toNumber(source.totalLearners ?? source.total);
  const male = toNumber(source.maleLearners ?? source.male);
  const female = toNumber(source.femaleLearners ?? source.female);
  const consistent = demographicsAreConsistent(source);

  const metrics = [
    {
      title: "Enrolled Learners",
      value: consistent ? formatCount(total) : NOT_AVAILABLE,
      subtitle: "Current School Year · Grades 7–10",
    },
    {
      title: "Grade Levels",
      value: (source.gradeLevels || 0).toLocaleString(),
      subtitle: "Grade 7 to Grade 10",
    },
    {
      title: "Male Learners",
      value: consistent ? formatCount(male) : NOT_AVAILABLE,
      subtitle:
        consistent && male != null
          ? `${percentOf(male, total)} of total enrollment`
          : "Share of total enrollment",
    },
    {
      title: "Female Learners",
      value: consistent ? formatCount(female) : NOT_AVAILABLE,
      subtitle:
        consistent && female != null
          ? `${percentOf(female, total)} of total enrollment`
          : "Share of total enrollment",
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {metrics.map((metric, index) => {
        return (
          <div
            key={index}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md"
          >
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {metric.title}
            </h3>
            <div className="mt-1">
              <p className="text-2xl font-bold tracking-tight text-emerald-700">
                {metric.value}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {metric.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
