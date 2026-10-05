"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
  Loader2,
  Sparkles,
  Eye,
  History,
  RefreshCw,
  X,
  FileText,
  AlertCircle,
  GraduationCap,
  Calendar,
  BookOpen,
} from "lucide-react";
import {
  listAralSummerRegistry,
  updateAralSummerAssignment,
} from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AdminAralSummerRegistryPanel({
  schoolYear = "SY 2026-2027",
  teachers = [],
}) {
  const { showToast } = useAppToast();
  const [registry, setRegistry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Drawers and Modals state
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    teacherId: "",
    programName: "ARAL Summer Reading Camp",
    status: "Assigned",
    isReassignment: false,
    reassignmentReason: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listAralSummerRegistry(schoolYear);
      setRegistry(res.data || []);
    } catch {
      showToast("error", "Failed to load ARAL Summer Registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolYear]);

  // Format teacher name safely
  const formatTeacherName = (t) => {
    if (!t) return "Unassigned";
    if (t.name) return t.name;
    const full = `${t.first_name || ""} ${t.last_name || ""}`.trim();
    return full || "Teacher";
  };

  // Open Review Referral Drawer
  const handleOpenReview = (record) => {
    setSelectedRecord(record);
    setReviewDrawerOpen(true);
  };

  // Open Learner History Drawer
  const handleOpenHistory = (record) => {
    setSelectedRecord(record);
    setHistoryDrawerOpen(true);
  };

  // Open Assign Facilitator Modal
  const handleOpenAssign = (record, isReassignment = false) => {
    setSelectedRecord(record);
    setAssignmentForm({
      teacherId: record.assignedTeacherId || "",
      programName: record.assignedSummerProgram || "ARAL Summer Reading Camp",
      status: isReassignment ? "Assigned" : (record.summerStatus === "Active" ? "Active" : "Assigned"),
      isReassignment,
      reassignmentReason: "",
    });
    setAssignModalOpen(true);
  };

  // Confirm Placement Action (Direct transition from Assigned -> Active Summer Intervention)
  const handleConfirmPlacement = async (record) => {
    try {
      const res = await updateAralSummerAssignment({
        recordId: record.id,
        summerTeacherId: record.assignedTeacherId,
        summerProgramName: record.assignedSummerProgram || "ARAL Summer Reading Camp",
        summerStatus: "Active",
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to confirm summer placement.");
        return;
      }

      showToast("success", `Summer placement confirmed for ${record.studentName}. Active in intervention.`);
      if (reviewDrawerOpen && selectedRecord?.id === record.id) {
        setSelectedRecord((prev) => ({ ...prev, summerStatus: "Active" }));
      }
      loadData();
    } catch {
      showToast("error", "Error confirming summer placement.");
    }
  };

  // Submit Facilitator Assignment / Reassignment
  const handleConfirmAssignment = async () => {
    if (!selectedRecord) return;
    setSavingAssignment(true);
    try {
      const res = await updateAralSummerAssignment({
        recordId: selectedRecord.id,
        summerTeacherId: assignmentForm.teacherId || null,
        summerProgramName: assignmentForm.programName,
        summerStatus: assignmentForm.status,
        reassignmentReason: assignmentForm.isReassignment ? assignmentForm.reassignmentReason : null,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to update summer assignment.");
        return;
      }

      const assignedTeacher = teachers.find((t) => t.id === assignmentForm.teacherId);
      const teacherName = formatTeacherName(assignedTeacher);

      showToast(
        "success",
        assignmentForm.isReassignment
          ? `Facilitator successfully reassigned to ${teacherName}.`
          : `Facilitator assigned for ${selectedRecord.studentName}.`
      );

      setAssignModalOpen(false);
      if (reviewDrawerOpen && selectedRecord) {
        setSelectedRecord((prev) => ({
          ...prev,
          assignedTeacherId: assignmentForm.teacherId,
          assignedTeacherName: teacherName,
          summerStatus: assignmentForm.status,
          assignedSummerProgram: assignmentForm.programName,
          assignmentDate: new Date().toISOString(),
        }));
      }
      loadData();
    } catch {
      showToast("error", "Error updating summer assignment.");
    } finally {
      setSavingAssignment(false);
    }
  };

  // Filter registry items
  const filtered = registry.filter((r) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.studentName.toLowerCase().includes(q) ||
      r.lrn.toLowerCase().includes(q) ||
      r.gradeAndSection.toLowerCase().includes(q) ||
      r.subject.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === "pending") {
      return r.summerStatus === "Referred" || r.summerStatus === "For Placement" || !r.assignedTeacherId;
    }
    if (statusFilter === "assigned") {
      return r.summerStatus === "Assigned";
    }
    if (statusFilter === "active") {
      return r.summerStatus === "Active";
    }
    if (statusFilter === "completed") {
      return r.summerStatus === "Completed";
    }

    return true;
  });

  return (
    <div className="space-y-5">
      {/* 1. HORIZONTAL PIPELINE TRACKER */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-[-0.02em]">
              ARAL Intervention Pipeline
            </h3>
            <p className="text-[11px] text-slate-500">
              DepEd Official Assessment & Intervention Lifecycle (RA 12028)
            </p>
          </div>
          <span className="rounded-md bg-cnhs-green-soft px-2.5 py-1 text-[11px] font-bold text-cnhs-green-dark">
            School-Wide Oversight
          </span>
        </div>

        {/* Pipeline Steps */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 overflow-x-auto text-xs py-2">
          {[
            { step: "BOSY Assessment", desc: "Phil-IRI Screening", tone: "bg-slate-100 text-slate-700" },
            { step: "Needs Review", desc: "Triage & Identification", tone: "bg-blue-50 text-blue-800" },
            { step: "Active ARAL", desc: "Classroom Intervention", tone: "bg-emerald-50 text-emerald-800" },
            { step: "Midline Assessment", desc: "Interim Decision Point", tone: "bg-cyan-50 text-cyan-800" },
            { step: "EOSY Assessment", desc: "Competency Evaluation", tone: "bg-amber-50 text-amber-800" },
            { step: "ARAL Summer", desc: "Summer Camp Cohort", tone: "bg-purple-50 text-purple-800" },
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

      {/* 2. REGISTRY HEADER & CONTROLS */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-700">
              <Sun size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-[-0.02em]">
                ARAL Summer Program Masterlist
              </h2>
              <p className="text-xs text-slate-500">
                Principal registry, tutor assignments, and cohort placement for EOSY-referred learners.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
              {[
                { id: "all", label: "All Cohort" },
                { id: "pending", label: "Pending Assignment" },
                { id: "assigned", label: "Assigned" },
                { id: "active", label: "Active Intervention" },
                { id: "completed", label: "Completed" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium transition-colors",
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

        {/* 3. TABLE - ALL 14 COLUMNS */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-400">
              <tr>
                <th className="px-3.5 py-3">Learner</th>
                <th className="px-3.5 py-3">LRN</th>
                <th className="px-3.5 py-3">Grade & Section</th>
                <th className="px-3.5 py-3">Learning Area</th>
                <th className="px-3.5 py-3">BOSY Result</th>
                <th className="px-3.5 py-3">Initial Screening</th>
                <th className="px-3.5 py-3">Midline Result</th>
                <th className="px-3.5 py-3">EOSY Result</th>
                <th className="px-3.5 py-3">Intervention History</th>
                <th className="px-3.5 py-3">Referral Reason</th>
                <th className="px-3.5 py-3">RF Decision Support</th>
                <th className="px-3.5 py-3">Current ARAL</th>
                <th className="px-3.5 py-3">Summer Status</th>
                <th className="px-3.5 py-3">Assigned Facilitator & Date</th>
                <th className="px-3.5 py-3 text-right sticky right-0 bg-slate-50/90 backdrop-blur-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin text-cnhs-green mx-auto mb-2" />
                    Loading ARAL Summer Registry...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    No learners currently in the ARAL Summer Registry matching the criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const hasAssignedTutor = row.assignedTeacherId && row.assignedTeacherName !== "Unassigned";
                  const isAssigned = row.summerStatus === "Assigned";
                  const isActive = row.summerStatus === "Active";

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* 1. Learner Name */}
                      <td className="px-3.5 py-3 font-bold text-slate-900">
                        {row.studentName}
                      </td>

                      {/* 2. LRN */}
                      <td className="px-3.5 py-3 font-mono text-[11px] text-slate-500">
                        {row.lrn}
                      </td>

                      {/* 3. Grade and Section */}
                      <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">
                        {row.gradeAndSection}
                      </td>

                      {/* 4. Learning Area */}
                      <td className="px-3.5 py-3 font-semibold text-slate-800">
                        {row.learningArea}
                      </td>

                      {/* 5. BOSY Result */}
                      <td className="px-3.5 py-3 text-slate-600">
                        <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 font-medium text-[11px]">
                          {row.bosyLevel}
                        </span>
                      </td>

                      {/* 6. Initial Assessment Result */}
                      <td className="px-3.5 py-3 text-slate-700 font-mono text-[11px]">
                        {row.initialAssessmentResult}
                      </td>

                      {/* 7. Midline Result */}
                      <td className="px-3.5 py-3 text-slate-700">
                        {row.midlineResult}
                      </td>

                      {/* 8. EOSY Result */}
                      <td className="px-3.5 py-3 font-bold text-amber-900">
                        {row.eosyResult}
                      </td>

                      {/* 9. Intervention History */}
                      <td className="px-3.5 py-3 text-slate-600 max-w-[140px] truncate" title={row.interventionHistory}>
                        {row.interventionHistory}
                      </td>

                      {/* 10. Reason for Referral */}
                      <td className="px-3.5 py-3 text-slate-600 max-w-[160px] truncate" title={row.reasonForReferral}>
                        {row.reasonForReferral}
                      </td>

                      {/* 11. Random Forest Decision-Support Result */}
                      <td className="px-3.5 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold",
                            row.rfRiskLevel === "High"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          )}
                          title={`Analytical Decision Support: ${row.rfRiskLevel} Risk (${row.rfConfidence}% confidence)`}
                        >
                          <Sparkles size={10} />
                          {row.rfRiskLevel} ({row.rfConfidence}%)
                        </span>
                      </td>

                      {/* 12. Current ARAL Status */}
                      <td className="px-3.5 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">
                          {row.currentAralStatus}
                        </span>
                      </td>

                      {/* 13. Summer Status */}
                      <td className="px-3.5 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap",
                            isActive
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : isAssigned
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : row.summerStatus === "Completed"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          )}
                        >
                          {isActive
                            ? "Active Summer Intervention"
                            : isAssigned
                            ? "Assigned"
                            : row.summerStatus === "Completed"
                            ? "Completed"
                            : "Pending Assignment"}
                        </span>
                      </td>

                      {/* 14. Assigned Facilitator & Assignment Date */}
                      <td className="px-3.5 py-3">
                        {hasAssignedTutor ? (
                          <div>
                            <p className="font-semibold text-emerald-800">{row.assignedTeacherName}</p>
                            <p className="text-[10px] text-slate-400">
                              {row.assignmentDate
                                ? new Date(row.assignmentDate).toLocaleDateString()
                                : "Assigned"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-amber-800 italic text-[11px]">Pending Assignment</span>
                        )}
                      </td>

                      {/* Actions: Review, Assign, Confirm Placement, Reassign, View History */}
                      <td className="px-3.5 py-3 text-right sticky right-0 bg-white/95 backdrop-blur-xs">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. Review Referral */}
                          <button
                            type="button"
                            onClick={() => handleOpenReview(row)}
                            title="Review Referral & Progression"
                            className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Eye size={13} />
                          </button>

                          {/* 2. Assign / Reassign Facilitator */}
                          {hasAssignedTutor ? (
                            <button
                              type="button"
                              onClick={() => handleOpenAssign(row, true)}
                              title="Reassign Facilitator"
                              className="rounded-md border border-slate-200 p-1 text-blue-700 hover:bg-blue-50"
                            >
                              <RefreshCw size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAssign(row, false)}
                              title="Assign Facilitator"
                              className="inline-flex items-center gap-1 rounded-md bg-cnhs-green px-2 py-1 text-[10.5px] font-bold text-white hover:bg-cnhs-green-dark"
                            >
                              <UserCheck size={12} />
                              <span>Assign</span>
                            </button>
                          )}

                          {/* 3. Confirm Placement (when Assigned) */}
                          {isAssigned && (
                            <button
                              type="button"
                              onClick={() => handleConfirmPlacement(row)}
                              title="Confirm Summer Placement"
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10.5px] font-bold text-white hover:bg-emerald-700"
                            >
                              <CheckCircle2 size={12} />
                              <span>Confirm</span>
                            </button>
                          )}

                          {/* 4. View Learner History */}
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(row)}
                            title="View Full ARAL History"
                            className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                          >
                            <History size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DRAWER 1: REVIEW REFERRAL & DECISION SUPPORT             */}
      {/* ======================================================== */}
      {reviewDrawerOpen && selectedRecord && (
        <div className="fixed inset-0 z-[70] flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-purple-50 p-2 text-purple-800">
                  <Sun size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    ARAL Summer Referral Review
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    DepEd Official Intervention Record & Academic Progression
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewDrawerOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-xs">
              {/* Student Demographics Header Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {selectedRecord.studentName}
                    </h4>
                    <p className="text-slate-500 text-[11px]">
                      LRN: <span className="font-mono text-slate-700">{selectedRecord.lrn}</span> · {selectedRecord.gradeAndSection}
                    </p>
                  </div>
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10.5px] font-bold text-purple-800 border border-purple-200">
                    {selectedRecord.summerStatus === "Active" ? "Active Summer Intervention" : selectedRecord.summerStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400">Learning Area:</span>{" "}
                    <span className="font-semibold text-slate-800">{selectedRecord.learningArea}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Referring Teacher:</span>{" "}
                    <span className="font-semibold text-slate-800">{selectedRecord.referringTeacherName}</span>
                  </div>
                </div>
              </div>

              {/* Assessment Progression Sequence */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Official DepEd Assessment Progression
                </h5>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-[10px] font-bold uppercase text-slate-400">BOSY Baseline</p>
                    <p className="mt-1 font-bold text-slate-900">{selectedRecord.bosyLevel}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{selectedRecord.initialAssessmentResult}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-100 bg-cyan-50/50 p-3">
                    <p className="text-[10px] font-bold uppercase text-cyan-700">Midline Assessment</p>
                    <p className="mt-1 font-bold text-cyan-950">{selectedRecord.midlineResult}</p>
                    <p className="text-[10px] text-cyan-700 mt-0.5">{selectedRecord.midlineDecision}</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <p className="text-[10px] font-bold uppercase text-amber-800">EOSY Assessment</p>
                    <p className="mt-1 font-bold text-amber-950">{selectedRecord.eosyResult}</p>
                    <p className="text-[10px] text-amber-800 mt-0.5">{selectedRecord.eosyDecision}</p>
                  </div>
                </div>
              </div>

              {/* Referral Detail & Intervention History */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Reason for Summer Referral
                </h5>
                <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedRecord.reasonForReferral}
                </p>
                {selectedRecord.notes && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Notes & Assignment Log:</span>
                    <pre className="mt-1 font-sans whitespace-pre-wrap text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {selectedRecord.notes}
                    </pre>
                  </div>
                )}
              </div>

              {/* RANDOM FOREST DECISION SUPPORT BOX (Strictly separated & with disclaimer) */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-blue-700" />
                    <h5 className="font-bold text-blue-950">
                      Random Forest Risk Classification (Analytical Decision Support)
                    </h5>
                  </div>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-[9.5px] font-bold text-blue-800">
                    Decision Support Only
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-white p-2.5 border border-blue-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Risk Classification</p>
                    <p className="mt-1 font-bold text-rose-700 text-sm">{selectedRecord.rfRiskLevel} Risk</p>
                  </div>
                  <div className="rounded-lg bg-white p-2.5 border border-blue-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Model Confidence</p>
                    <p className="mt-1 font-bold text-blue-800 text-sm">{selectedRecord.rfConfidence}%</p>
                  </div>
                </div>

                <div className="text-[11px] text-blue-900 leading-relaxed">
                  <p className="font-semibold text-blue-950">Contributing Learning Factors:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-800">
                    {selectedRecord.rfFactors?.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                {/* Explicit Disclaimer required by DepEd ARAL Framework */}
                <div className="pt-2 border-t border-blue-100">
                  <p className="text-[10px] text-blue-950 font-medium italic">
                    "Random Forest serves as analytical decision support and does not supersede official DepEd assessment rules."
                  </p>
                </div>
              </div>

              {/* Summer Placement Status Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Summer Placement & Facilitator Assignment
                </h5>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Cohort Program:</span>
                    <p className="font-semibold text-slate-800">{selectedRecord.assignedSummerProgram}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Assigned Facilitator:</span>
                    <p className="font-semibold text-emerald-800">{selectedRecord.assignedTeacherName}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-auto flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setReviewDrawerOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAssign(selectedRecord, Boolean(selectedRecord.assignedTeacherId))}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50"
                >
                  {selectedRecord.assignedTeacherId ? "Reassign Facilitator" : "Assign Facilitator"}
                </button>
                {selectedRecord.summerStatus === "Assigned" && (
                  <button
                    type="button"
                    onClick={() => handleConfirmPlacement(selectedRecord)}
                    className="rounded-lg bg-cnhs-green px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-cnhs-green-dark"
                  >
                    Confirm Placement
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DRAWER 2: LEARNER FULL ARAL HISTORY                      */}
      {/* ======================================================== */}
      {historyDrawerOpen && selectedRecord && (
        <div className="fixed inset-0 z-[70] flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <History size={18} className="text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  ARAL Historical Lifecycle Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-900 text-sm">{selectedRecord.studentName}</h4>
                <p className="text-[11px] text-slate-500">
                  LRN: {selectedRecord.lrn} · {selectedRecord.gradeAndSection}
                </p>
              </div>

              {/* Timeline Steps */}
              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {/* 1. BOSY */}
                <div className="relative flex gap-3 items-start pl-2">
                  <div className="h-3 w-3 rounded-full bg-slate-400 mt-1 ring-4 ring-white" />
                  <div>
                    <p className="font-bold text-slate-800">1. BOSY Phil-IRI Assessment</p>
                    <p className="text-slate-500 text-[11px]">Level: {selectedRecord.bosyLevel} ({selectedRecord.initialAssessmentResult})</p>
                  </div>
                </div>

                {/* 2. ARAL Intervention */}
                <div className="relative flex gap-3 items-start pl-2">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 mt-1 ring-4 ring-white" />
                  <div>
                    <p className="font-bold text-emerald-900">2. Active ARAL Intervention</p>
                    <p className="text-slate-500 text-[11px]">{selectedRecord.interventionHistory}</p>
                  </div>
                </div>

                {/* 3. Midline */}
                <div className="relative flex gap-3 items-start pl-2">
                  <div className="h-3 w-3 rounded-full bg-cyan-500 mt-1 ring-4 ring-white" />
                  <div>
                    <p className="font-bold text-cyan-900">3. Midline Interim Assessment</p>
                    <p className="text-slate-500 text-[11px]">Result: {selectedRecord.midlineResult} · Decision: {selectedRecord.midlineDecision}</p>
                  </div>
                </div>

                {/* 4. EOSY */}
                <div className="relative flex gap-3 items-start pl-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500 mt-1 ring-4 ring-white" />
                  <div>
                    <p className="font-bold text-amber-900">4. EOSY Final Assessment</p>
                    <p className="text-slate-500 text-[11px]">Result: {selectedRecord.eosyResult} · Routed to ARAL Summer</p>
                  </div>
                </div>

                {/* 5. Summer Registry */}
                <div className="relative flex gap-3 items-start pl-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500 mt-1 ring-4 ring-white" />
                  <div>
                    <p className="font-bold text-purple-900">5. Principal Summer Registry</p>
                    <p className="text-slate-500 text-[11px]">
                      Facilitator: {selectedRecord.assignedTeacherName} · Status: {selectedRecord.summerStatus}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t border-slate-200 p-4 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ASSIGN / REASSIGN FACILITATOR                     */}
      {/* ======================================================== */}
      {assignModalOpen && selectedRecord && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {assignmentForm.isReassignment ? "Reassign Summer Facilitator" : "Assign Summer Facilitator"}
              </h3>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Learner: <strong>{selectedRecord.studentName}</strong> ({selectedRecord.gradeAndSection})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Summer Program Cohort</label>
                <input
                  type="text"
                  value={assignmentForm.programName}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, programName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-cnhs-green"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">
                  {assignmentForm.isReassignment ? "New Facilitator" : "Assigned Facilitator"}
                </label>
                <select
                  value={assignmentForm.teacherId}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, teacherId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-cnhs-green"
                >
                  <option value="">Select Facilitator...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTeacherName(t)} ({t.employee_number || "Teacher"})
                    </option>
                  ))}
                </select>
              </div>

              {assignmentForm.isReassignment && (
                <div>
                  <label className="font-bold text-slate-700">Reassignment Reason / Historical Note</label>
                  <textarea
                    rows={2}
                    placeholder="Provide reason for reassigning facilitator (will be preserved in audit history)..."
                    value={assignmentForm.reassignmentReason}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, reassignmentReason: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-cnhs-green"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700">Controlled Summer Status</label>
                <select
                  value={assignmentForm.status}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold outline-none focus:border-cnhs-green"
                >
                  <option value="Referred">Pending Assignment (Referred)</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Active">Active Summer Intervention</option>
                  <option value="Completed">Completed Summer</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                disabled={savingAssignment || !assignmentForm.teacherId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cnhs-green px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-cnhs-green-dark disabled:opacity-50"
              >
                {savingAssignment ? <Loader2 size={13} className="animate-spin" /> : null}
                Save Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
