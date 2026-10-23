"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import StudentSectionCard from "@/components/student/layout/StudentSectionCard";
import { PLP_PLAN_TYPE, PLP_STATUS } from "@/lib/monitoring/plpGenerator";

/**
 * Student-facing read-only Personalized Learning Plan (PLP) presentation card.
 *
 * Strict Privacy & Workflow Boundaries:
 * 1. Only verified 'active' or 'completed' plans are displayed. Drafts and unapproved plans are hidden.
 * 2. Never displays internal teacher notes, referral rationale, or administrative audit fields.
 * 3. Shows an honest empty/unavailable state when no active plan exists.
 */
export default function StudentPlpCard({ plp = null }) {
  const [showObjectivesDetail, setShowObjectivesDetail] = useState(true);

  // Check if plan is verified and eligible for student view
  const isDisplayable = useMemo(() => {
    if (!plp) return false;
    const status = String(plp.status || "").toLowerCase();
    return status === PLP_STATUS.ACTIVE || status === PLP_STATUS.COMPLETED;
  }, [plp]);

  const planTypeMeta = useMemo(() => {
    switch (plp?.plan_type) {
      case PLP_PLAN_TYPE.COMPOSITE:
        return {
          title: "Composite Learning Plan",
          subtitle: "Combined academic reinforcement and reading development pathway.",
          tag: "Academic + Reading",
          badgeClass: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
        };
      case PLP_PLAN_TYPE.READING_ARAL:
        return {
          title: "Reading Development Plan",
          subtitle: "Targeted reading and comprehension enhancement.",
          tag: "Reading Support",
          badgeClass: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
        };
      case PLP_PLAN_TYPE.ACADEMIC_REMEDIAL:
      default:
        return {
          title: "Academic Remedial Plan",
          subtitle: "Focused classroom support for core subject competencies.",
          tag: "Subject Support",
          badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        };
    }
  }, [plp?.plan_type]);

  if (!isDisplayable) {
    return (
      <StudentSectionCard
        icon={Target}
        title="Personalized Learning Plan"
        subtitle="Individualized targets and teacher-guided activities."
      >
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
          <p className="text-[12px] font-semibold text-slate-700">
            No Active Learning Plan
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 max-w-md mx-auto">
            You do not currently have an active Personalized Learning Plan. Learning plans created by your teachers will appear here once reviewed and officially activated.
          </p>
        </div>
      </StudentSectionCard>
    );
  }

  return (
    <StudentSectionCard
      icon={Target}
      title={planTypeMeta.title}
      subtitle={planTypeMeta.subtitle}
    >
      {/* PLAN HEADER */}
      <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                planTypeMeta.badgeClass
              )}
            >
              {planTypeMeta.tag}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              {plp.status === PLP_STATUS.COMPLETED ? "Completed" : "Active Plan"}
            </span>
          </div>

          <span className="text-[11px] text-slate-500">
            School Year {plp.school_year || "2026-2027"}
          </span>
        </div>

        <p className="mt-2 text-[12px] font-semibold text-slate-800">
          Goal: {plp.recommended_support_level || "Comprehensive Competency Mastery"}
        </p>
      </div>

      {/* TARGET OBJECTIVES */}
      {plp.target_objectives?.length ? (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              My Learning Goals ({plp.target_objectives.length})
            </span>
            <button
              type="button"
              onClick={() => setShowObjectivesDetail((prev) => !prev)}
              className="text-[11px] font-medium text-cnhs-green-dark hover:underline"
            >
              {showObjectivesDetail ? "Hide Details" : "Show Details"}
            </button>
          </div>

          <div className="space-y-1.5">
            {plp.target_objectives.map((obj, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-2xs"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="text-cnhs-green-dark shrink-0 mt-0.5" />
                  <div className="text-[12px]">
                    <p className="font-medium text-slate-800">{obj.target}</p>
                    {showObjectivesDetail && obj.competencyFocus && (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Focus: {obj.competencyFocus}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* RECOMMENDED ACTIVITIES */}
      {plp.recommended_activities?.length ? (
        <div className="mt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Scheduled Activities & Pathways
          </span>
          <div className="space-y-1.5">
            {plp.recommended_activities.map((act, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-800">
                    {act.title}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    {act.type}
                  </span>
                </div>
                {act.description && (
                  <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                    {act.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* MONITORING / CHECK-IN FREQUENCY */}
      {plp.monitoring_indicators?.length ? (
        <div className="mt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Teacher Check-in Milestones
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {plp.monitoring_indicators.map((ind, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-[11px]"
              >
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>{ind.metric}</span>
                  <span className="font-semibold text-slate-700">{ind.frequency}</span>
                </div>
                <p className="mt-1 font-semibold text-slate-800">
                  Target: {ind.target}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </StudentSectionCard>
  );
}
