"use client";

import React from "react";
import { Users, BookOpen, UserRound, UserRoundSearch } from "lucide-react";
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
 * Returns true when every published total is backed by its parts, so the
 * UI never silently displays inconsistent numbers.
 */
export function demographicsAreConsistent(data) {
  const total = toNumber(data?.total);
  const entries = gradeEntriesFrom(data);
  if (total == null || entries.some((entry) => entry.total == null)) {
    return false;
  }
  const gradeSum = entries.reduce((sum, entry) => sum + entry.total, 0);
  if (gradeSum !== total) return false;
  const male = toNumber(data?.male);
  const female = toNumber(data?.female);
  if (male == null || female == null) return false;
  return male + female === total;
}

export function Dashboard1({ data, className }) {
  const source = data ?? {};
  const total = toNumber(source.total);
  const male = toNumber(source.male);
  const female = toNumber(source.female);
  const consistent = demographicsAreConsistent(source);

  const metrics = [
    {
      title: "Enrolled Learners",
      value: consistent ? formatCount(total) : NOT_AVAILABLE,
      subtitle: "Current School Year · Grades 7–10",
      icon: Users,
    },
    {
      title: "Grade Levels",
      value: (source.gradeLevels || 0).toLocaleString(),
      subtitle: "Grade 7 to Grade 10",
      icon: BookOpen,
    },
    {
      title: "Male Learners",
      value: consistent ? formatCount(male) : NOT_AVAILABLE,
      subtitle:
        consistent && male != null
          ? `${percentOf(male, total)} of total enrollment`
          : "Share of total enrollment",
      icon: UserRound,
    },
    {
      title: "Female Learners",
      value: consistent ? formatCount(female) : NOT_AVAILABLE,
      subtitle:
        consistent && female != null
          ? `${percentOf(female, total)} of total enrollment`
          : "Share of total enrollment",
      icon: UserRoundSearch,
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold tracking-tight text-slate-600">
                {metric.title}
              </h3>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f7faf7] text-cnhs-green-dark">
                <Icon size={16} />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold tracking-tight text-[#123d2c]">
                {metric.value}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {metric.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
