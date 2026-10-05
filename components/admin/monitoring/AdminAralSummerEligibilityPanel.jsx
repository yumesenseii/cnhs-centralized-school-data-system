"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sun,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Eye,
  FileText,
  AlertCircle,
  Download,
  Info,
} from "lucide-react";
import { listAralSummerRegistry } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AdminAralSummerEligibilityPanel({
  schoolYear = "SY 2026-2027",
  onViewStudent,
}) {
  const { showToast } = useAppToast();
  const [registry, setRegistry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listAralSummerRegistry(schoolYear);
      setRegistry(res.data || []);
    } catch {
      showToast("error", "Failed to load ARAL Summer Eligibility records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolYear]);

  // Filter registry items
  const filtered = useMemo(() => {
    return registry.filter((r) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.studentName?.toLowerCase().includes(q) ||
        r.lrn?.toLowerCase().includes(q) ||
        r.gradeAndSection?.toLowerCase().includes(q) ||
        r.subject?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const st = r.summerStatus || "Eligible";
      if (statusFilter === "eligible") {
        return st === "Eligible" || st === "Referred" || st === "For Placement";
      }
      if (statusFilter === "not_eligible") {
        return st === "Not Eligible" || st === "Exited";
      }

      return true;
    });
  }, [registry, searchTerm, statusFilter]);

  const eligibleCount = useMemo(() => {
    return registry.filter((r) => {
      const st = r.summerStatus || "Eligible";
      return st === "Eligible" || st === "Referred" || st === "For Placement";
    }).length;
  }, [registry]);

  return (
    <div className="space-y-5">
      {/* 1. HORIZONTAL PIPELINE TRACKER */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-[-0.02em]">
              ARAL Reading Intervention Lifecycle
            </h3>
            <p className="text-[11px] text-slate-500">
              DepEd Official Assessment & Intervention Pathway (RA 12028)
            </p>
          </div>
          <span className="rounded-md bg-cnhs-green-soft px-2.5 py-1 text-[11px] font-bold text-cnhs-green-dark">
            Official Assessment Outcome
          </span>
        </div>

        {/* Pipeline Steps */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 overflow-x-auto text-xs py-2">
          {[
            { step: "BOSY Screening", desc: "Phil-IRI Form 1B", tone: "bg-slate-100 text-slate-700" },
            { step: "Needs Review", desc: "Endorsement Intake", tone: "bg-blue-50 text-blue-800" },
            { step: "Active ARAL", desc: "Targeted Sessions", tone: "bg-emerald-50 text-emerald-800" },
            { step: "Midline Assessment", desc: "Interim Checkpoint", tone: "bg-cyan-50 text-cyan-800" },
            { step: "EOSY Assessment", desc: "Post-Test Evaluation", tone: "bg-amber-50 text-amber-800" },
            { step: "Summer Eligibility", desc: "Final Outcome / Referral", tone: "bg-purple-100 text-purple-900 font-bold ring-1 ring-purple-300" },
          ].map((item, idx, arr) => (
            <div key={item.step} className="flex items-center gap-2">
              <div className={cn("rounded-lg px-3 py-2 text-left min-w-[125px]", item.tone)}>
                <p className="font-bold text-[11px]">{item.step}</p>
                <p className="text-[9.5px] opacity-75 mt-0.5">{item.desc}</p>
              </div>
              {idx < arr.length - 1 && (
                <ArrowRight size={14} className="text-slate-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. OFFICIAL SYSTEM BOUNDARY DISCLAIMER NOTICE */}
      <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900">
        <div className="flex items-start gap-2.5">
          <Info size={16} className="text-purple-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-purple-950">
              DepEd ARAL System Boundary Notice
            </h4>
            <p className="mt-1 text-[11.5px] text-purple-900 leading-relaxed">
              CNHS Learn determines, records, and displays <strong>ARAL Summer Eligibility</strong> and official <strong>Summer Referrals</strong> based on End-of-School-Year (EOSY) assessment outcomes. The actual summer reading camp instruction, session scheduling, tutor attendance, and lesson delivery are conducted outside CNHS Learn by authorized school and division facilitators.
            </p>
          </div>
        </div>
      </div>

      {/* 3. ELIGIBILITY REGISTRY HEADER & CONTROLS */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-2.5 text-purple-800">
              <Sun size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-[-0.02em]">
                  ARAL Summer Eligibility & Referral Roster
                </h2>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                  {eligibleCount} Eligible
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Official determination of learners requiring continued summer reading support based on EOSY results.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
              {[
                { id: "all", label: "All Candidates" },
                { id: "eligible", label: "Summer Eligible / Referred" },
                { id: "not_eligible", label: "Not Eligible / Exited" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                    statusFilter === tab.id
                      ? "bg-white font-bold text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search learner or LRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-52 rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-cnhs-green"
              />
            </div>
          </div>
        </div>

        {/* 4. TABLE - CLEAN FORMAL RECORD */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500">
              <tr>
                <th className="px-3.5 py-3">Learner</th>
                <th className="px-3.5 py-3">LRN</th>
                <th className="px-3.5 py-3">Grade & Section</th>
                <th className="px-3.5 py-3">Learning Area</th>
                <th className="px-3.5 py-3 text-center">BOSY Baseline</th>
                <th className="px-3.5 py-3 text-center">Midline Check</th>
                <th className="px-3.5 py-3 text-center">EOSY Post-Assessment</th>
                <th className="px-3.5 py-3">Summer Eligibility</th>
                <th className="px-3.5 py-3">Referral Remarks</th>
                <th className="px-3.5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Loader2 size={18} className="animate-spin inline-block mr-2" />
                    Loading eligibility records…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No learners match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((record) => {
                  const isEligible =
                    record.summerStatus === "Eligible" ||
                    record.summerStatus === "Referred" ||
                    record.summerStatus === "For Placement" ||
                    !record.summerStatus;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3 font-semibold text-slate-900">
                        {record.studentName}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-slate-600">
                        {record.lrn}
                      </td>
                      <td className="px-3.5 py-3 text-slate-700">
                        {record.gradeAndSection}
                      </td>
                      <td className="px-3.5 py-3 text-slate-700">
                        {record.subject}
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <span className="font-semibold text-slate-800">
                          {record.bosyScore ?? "—"}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {record.initialReadingLevel || "—"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <span className="font-semibold text-slate-800">
                          {record.midlineScore ?? "—"}
                        </span>
                        <span className="block text-[10px] text-slate-400">
                          {record.midlineReadingLevel || "—"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-center">
                        <span className={cn(
                          "font-bold",
                          record.eosyReadingLevel === "Frustration" ? "text-amber-800" : "text-emerald-800"
                        )}>
                          {record.eosyScore ?? "—"}
                        </span>
                        <span className="block text-[10px] font-medium text-slate-500">
                          {record.eosyReadingLevel || "Instructional"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border",
                          isEligible
                            ? "border-purple-300 bg-purple-50 text-purple-800"
                            : "border-slate-200 bg-slate-100 text-slate-700"
                        )}>
                          {isEligible ? "Summer Eligible" : "Not Eligible"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-slate-600 max-w-[240px] truncate" title={record.referralReason}>
                        {record.referralReason || "EOSY post-assessment indicates ongoing reading intervention needed."}
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        {onViewStudent ? (
                          <button
                            type="button"
                            onClick={() => onViewStudent(record)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-cnhs-green-dark transition"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
