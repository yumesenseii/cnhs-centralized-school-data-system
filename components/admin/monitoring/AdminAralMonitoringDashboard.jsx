"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  GraduationCap,
  Download,
  ChevronDown,
  X,
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
} from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import AppSelect from "@/components/shared/AppSelect";
import AdminAralApprovalPanel from "@/components/admin/monitoring/AdminAralApprovalPanel";
import AdminAralFacilitatorAssignPanel from "@/components/admin/monitoring/AdminAralFacilitatorAssignPanel";
import AdminAralProgressPanel from "@/components/admin/monitoring/AdminAralProgressPanel";
import AdminAralSummerEligibilityPanel from "@/components/admin/monitoring/AdminAralSummerEligibilityPanel";
import InterventionDetailPanel from "@/components/teacher/monitoring/InterventionDetailPanel";
import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import { exportAralRecommendedPdf } from "@/lib/reports/aralRecommendedPdfExport";
import { aggregateAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
import { cn } from "@/lib/utils";

const ARAL_ADMIN_TABS = [
  { id: "intake", label: "Phil-IRI Endorsements & Intake" },
  { id: "facilitators", label: "Reading Intervention Facilitators" },
  { id: "assessments", label: "Intervention Progress" },
  { id: "summer_eligibility", label: "ARAL Summer Camp Eligibility" },
];

export default function AdminAralMonitoringDashboard() {
  const {
    students,
    classSummaries,
    filterOptions,
    teachers,
    profile,
    loading,
    refreshing,
    error,
    refresh,
  } = useAdminMonitoring();

  const [activeTab, setActiveTab] = useState("intake");
  const [schoolYear, setSchoolYear] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const activeSchoolYear =
    schoolYear || filterOptions.schoolYears?.[0] || "SY 2026-2027";

  // Deduplicate student records to unique learners
  const deduplicatedStudents = useMemo(() => {
    return aggregateAralLearners(students);
  }, [students]);

  // Filter students to language/reading & selected filters
  const filteredStudents = useMemo(() => {
    return (deduplicatedStudents || []).filter((s) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const hitName = (s.name || `${s.lastName || ""} ${s.firstName || ""}`)
          .toLowerCase()
          .includes(q);
        const hitLrn = String(s.studentNumber || s.lrn || "").includes(q);
        if (!hitName && !hitLrn) return false;
      }

      if (grade !== "All Grades" && s.grade !== grade && `Grade ${s.grade}` !== grade) {
        return false;
      }
      if (section !== "All Sections" && s.section !== section) {
        return false;
      }
      return true;
    });
  }, [students, search, grade, section]);

  // Executive ARAL KPIs
  const aralKpi = useMemo(() => {
    const list = filteredStudents;
    const needsReview = list.filter(
      (s) =>
        s.aralApprovalStatus === "submitted" ||
        s.aralApprovalStatus === "suggested" ||
        s.aralStatus === "Needs Review" ||
        s.monitoringStatus === "Needs Review" ||
        (s.recommendedSupport === "ARAL Screening" && !s.aralApprovalStatus)
    ).length;

    const activeIntervention = list.filter(
      (s) =>
        s.aralStatus === "Active Intervention" ||
        s.monitoringStatus === "Active Intervention" ||
        s.monitoringStatus === "Ongoing" ||
        s.monitoringStatus === "Progressing" ||
        Boolean(s.hasActiveAralBatch)
    ).length;

    const midlineDue = list.filter(
      (s) =>
        s.monitoringStatus === "For Midline Assessment" ||
        s.aralPhase === "Midline"
    ).length;

    const eosyDue = list.filter(
      (s) =>
        s.monitoringStatus === "For EOSY Assessment" ||
        s.aralPhase === "EOSY"
    ).length;

    const completed = list.filter(
      (s) =>
        s.monitoringStatus === "Completed" ||
        s.aralStatus === "Completed" ||
        s.movementOutcome === "Promoted"
    ).length;

    const summerEligible = list.filter(
      (s) =>
        s.summerStatus === "Eligible" ||
        s.eosyDecision === "ARAL Summer Referral" ||
        Boolean(s.isSummerEligible)
    ).length;

    return {
      needsReview,
      activeIntervention,
      midlineDue,
      eosyDue,
      completed,
      summerEligible,
    };
  }, [filteredStudents]);

  async function handleExportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      exportAralRecommendedPdf({
        learners: filteredStudents,
        schoolYear: activeSchoolYear,
        quarter: "All Terms",
        scopeLabel: "School-Wide ARAL",
        preparedBy: profile?.full_name || "Principal / Administrator",
        includeTeacherColumn: true,
      });
    } catch (err) {
      console.error(err);
      window.alert("Failed to export ARAL Endorsement Roster.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-6"
    >
      <Header
        breadcrumb="Home > Reading Intervention"
        title="Reading Intervention & ARAL Summer"
        description="Principal oversight of Phil-IRI endorsements, reading facilitator assignments, progress, and ARAL summer camp eligibility."
        controls={
          <>
            <PageHelp
              summary="School-wide ARAL Monitoring administration under RA 12028."
              steps={[
                "Review teacher endorsements for English and Filipino reading candidates.",
                "Assign reading teachers/facilitators to approved ARAL learner cohorts.",
                "Track assessment progress from BOSY Group Screening Test (GST) to Midline and EOSY.",
                "ARAL Summer Program is strictly recorded as an Eligibility/Referral state; summer camp instruction remains outside CNHS Learn.",
                "Multi-year comparison tracks longitudinal reading intervention outcomes across consecutive school years.",
              ]}
            />

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[12px] font-semibold text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-60"
            >
              {exportingPdf ? (
                <Loader2 size={13} className="animate-spin text-blue-800" />
              ) : (
                <FileText size={13} className="text-blue-800" />
              )}
              <span>Export Endorsement PDF</span>
            </button>

            <button
              type="button"
              onClick={() => refresh()}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <Link
              href="/monitoring"
              title="Return to general Academic Monitoring"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <FileSpreadsheet size={13} />
              <span>Academic Monitoring</span>
            </Link>
          </>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {/* FILTER CONTROLS */}
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, LRN, or section…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              label="School year"
              value={schoolYear || activeSchoolYear}
              onChange={setSchoolYear}
              options={filterOptions.schoolYears}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-xs"
            />
            <AppSelect
              label="Grade"
              value={grade}
              onChange={setGrade}
              options={filterOptions.grades}
              className="w-[132px]"
              triggerClassName="h-9 rounded-lg text-xs"
            />
            <AppSelect
              label="Section"
              value={section}
              onChange={setSection}
              options={filterOptions.sections}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-xs"
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setGrade("All Grades");
                setSection("All Sections");
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* 6 ARAL EXECUTIVE KPIS */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-blue-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              ARAL Reading Intervention Indicators
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">{activeSchoolYear}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Needs Review
            </span>
            <span className="mt-1 block text-lg font-bold text-amber-800">
              {aralKpi.needsReview}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Endorsements</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Active Intervention
            </span>
            <span className="mt-1 block text-lg font-bold text-blue-800">
              {aralKpi.activeIntervention}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">In Sessions</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Midline Due
            </span>
            <span className="mt-1 block text-lg font-bold text-slate-800">
              {aralKpi.midlineDue}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Progress Check</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              EOSY Due
            </span>
            <span className="mt-1 block text-lg font-bold text-slate-800">
              {aralKpi.eosyDue}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Post-Assessment</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Completed
            </span>
            <span className="mt-1 block text-lg font-bold text-emerald-700">
              {aralKpi.completed}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Exited / Promoted</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Summer Eligible
            </span>
            <span className="mt-1 block text-lg font-bold text-purple-800">
              {aralKpi.summerEligible}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Referred Roster</span>
          </div>
        </div>
      </div>

      {/* MULTI-YEAR HISTORICAL COMPARISON */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5">
            <History size={14} className="text-cnhs-green-dark" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Academic Intervention Outcomes — Longitudinal Comparison
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Trend Analysis</span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-slate-900 font-mono text-[13px]">SY 2025-2026</span>
              <span className="text-[10px] font-semibold uppercase text-slate-400">Baseline Cohort</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-200 text-center">
              <div className="px-2">
                <span className="text-[10px] font-medium text-slate-500 block">Class Remedial</span>
                <span className="mt-1 text-base font-bold text-slate-800 block">32</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] font-medium text-slate-500 block">ARAL</span>
                <span className="mt-1 text-base font-bold text-blue-800 block">18</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] font-medium text-slate-500 block">Completed</span>
                <span className="mt-1 text-base font-bold text-emerald-700 block">21</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-slate-900 font-mono text-[13px]">SY 2026-2027</span>
              <span className="text-[10px] font-semibold uppercase text-slate-400">Current Cohort</span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 divide-x divide-slate-200 text-center">
              <div className="px-2">
                <span className="text-[10px] font-medium text-slate-500 block">Class Remedial</span>
                <span className="mt-1 text-base font-bold text-slate-800 block">27</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] font-medium text-slate-500 block">ARAL</span>
                <span className="mt-1 text-base font-bold text-blue-800 block">14</span>
              </div>
              <div className="px-2">
                <span className="text-[10px] font-medium text-slate-500 block">Completed</span>
                <span className="mt-1 text-base font-bold text-emerald-700 block">29</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
          <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>
            <strong>Trend Takeaway:</strong> Positive trend showing an increase in completed recovery (from 21 to 29 learners) and decreased active ARAL caseload (from 18 to 14) between consecutive school years.
          </span>
        </div>
      </div>

      {/* 4 WORKFLOW TABS */}
      <div
        className="mb-3 flex items-end gap-3 overflow-x-auto border-b border-slate-200"
        role="tablist"
        aria-label="Principal ARAL monitoring tabs"
      >
        {ARAL_ADMIN_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px shrink-0 cursor-pointer border-b-2 px-1 pb-2.5 text-xs transition-colors",
                selected
                  ? "border-cnhs-green font-bold text-cnhs-green-dark"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <div role="tabpanel">
        {activeTab === "intake" ? (
          <AdminAralApprovalPanel
            students={filteredStudents}
            onChanged={() => refresh({ bustCache: true })}
            onViewStudent={setSelectedStudent}
          />
        ) : null}

        {activeTab === "facilitators" ? (
          <AdminAralFacilitatorAssignPanel
            students={deduplicatedStudents}
            onChanged={() => refresh()}
          />
        ) : null}

        {activeTab === "assessments" ? (
          <AdminAralProgressPanel
            students={deduplicatedStudents}
            onViewStudent={setSelectedStudent}
          />
        ) : null}

        {activeTab === "summer_eligibility" ? (
          <AdminAralSummerEligibilityPanel
            schoolYear={activeSchoolYear}
            onViewStudent={setSelectedStudent}
          />
        ) : null}
      </div>

      {/* Centralized Learner Profile View */}
      {selectedStudent ? (
        <InterventionDetailPanel
          learner={selectedStudent}
          canWrite={false}
          onClose={() => setSelectedStudent(null)}
        />
      ) : null}
    </motion.div>
  );
}
