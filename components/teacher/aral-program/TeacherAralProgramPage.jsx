"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Archive,
  Users,
  CheckCircle2,
  ChevronLeft,
  Folder,
  Loader2,
  AlertCircle,
  Filter,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import PageHelp from "@/components/shared/PageHelp";
import AppSelect from "@/components/shared/AppSelect";
import { useAppToast } from "@/components/shared/AppToast";
import { createClient } from "@/lib/supabase/client";
import {
  resolveTeacherSessionForMonitoring,
  routeEosyPostAssessment,
} from "@/lib/supabase/queries/monitoring";
import { listMyAralFacilitatorAssignments } from "@/lib/supabase/queries/aralProgram";
import AralStudentCard from "@/components/teacher/aral-program/AralStudentCard";
import { cn } from "@/lib/utils";

export default function TeacherAralProgramPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teacherName, setTeacherName] = useState("Facilitator");
  const [teacherId, setTeacherId] = useState(null);

  // Raw assignments & split queues
  const [activeLearners, setActiveLearners] = useState([]);
  const [archivedLearners, setArchivedLearners] = useState([]);

  // Active workspace tab: "active" | "archive"
  const [viewTab, setViewTab] = useState("active");
  const [selectedSection, setSelectedSection] = useState("All Sections");
  const [search, setSearch] = useState("");
  const { showToast } = useAppToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data?.teacherId) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setLoading(false);
      return;
    }

    setTeacherId(session.data.teacherId);

    const profile = session.data.profile;
    const teacher = session.data.teacher;
    if (teacher) {
      const parts = [teacher.first_name, teacher.middle_name, teacher.last_name]
        .map((p) => String(p ?? "").trim())
        .filter(Boolean);
      setTeacherName(
        parts.join(" ") || teacher.email || profile?.full_name || "Facilitator"
      );
    } else if (profile?.full_name) {
      setTeacherName(profile.full_name);
    }

    const result = await listMyAralFacilitatorAssignments(session.data.teacherId);
    if (result.error) {
      setError(result.error.message);
      setActiveLearners([]);
      setArchivedLearners([]);
      setLoading(false);
      return;
    }

    const rawList = result.data ?? [];
    const studentIds = rawList.map((a) => a.studentId).filter(Boolean);

    // Fetch latest monitoring status & scores for each assigned learner
    let monitoringMap = new Map();
    if (studentIds.length) {
      const supabase = createClient();
      const { data: records } = await supabase
        .from("monitoring_records")
        .select(
          "id, student_id, monitoring_status, next_action, reading_level, phil_iri_score, crla_score"
        )
        .in("student_id", studentIds)
        .order("updated_at", { ascending: false });

      for (const r of records || []) {
        if (!monitoringMap.has(r.student_id)) {
          monitoringMap.set(r.student_id, r);
        }
      }
    }

    const actives = [];
    const archives = [];

    for (const item of rawList) {
      const mon = monitoringMap.get(item.studentId);
      const monStatus = mon?.monitoring_status || "Ongoing";
      const nextAction = mon?.next_action || "";

      const enhanced = {
        ...item,
        monitoringRecordId: mon?.id || null,
        monitoringStatus: monStatus,
        nextAction,
        readingLevel: mon?.reading_level || null,
        philIriScore: mon?.phil_iri_score || null,
        crlaScore: mon?.crla_score || null,
      };

      // Deficient -> cleared from view (routed to Principal's summer registry)
      if (
        nextAction === "Summer Remedial Referral" ||
        monStatus === "Needs Further Support"
      ) {
        continue;
      }

      // Proficient / Exited -> goes to archive
      if (monStatus === "Completed") {
        archives.push(enhanced);
      } else {
        actives.push(enhanced);
      }
    }

    setActiveLearners(actives);
    setArchivedLearners(archives);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Section options for filtering
  const sectionOptions = useMemo(() => {
    const all = [...activeLearners, ...archivedLearners];
    const sections = [...new Set(all.map((l) => l.gradeSection).filter(Boolean))];
    return ["All Sections", ...sections];
  }, [activeLearners, archivedLearners]);

  // Filter current active list
  const filteredActiveLearners = useMemo(() => {
    let list = activeLearners;
    if (selectedSection !== "All Sections") {
      list = list.filter((l) => l.gradeSection === selectedSection);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.studentName?.toLowerCase().includes(q) ||
          l.studentNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeLearners, selectedSection, search]);

  // Filter archive list
  const filteredArchivedLearners = useMemo(() => {
    let list = archivedLearners;
    if (selectedSection !== "All Sections") {
      list = list.filter((l) => l.gradeSection === selectedSection);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.studentName?.toLowerCase().includes(q) ||
          l.studentNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [archivedLearners, selectedSection, search]);

  // Handle EOSY Post-Assessment Selection
  const handleOutcomeSelect = async (learner, outcome) => {
    const { error } = await routeEosyPostAssessment({
      monitoringRecordId: learner.monitoringRecordId,
      studentId: learner.studentId,
      outcome,
    });

    if (error) {
      showToast("error", error.message || "Failed to route assessment outcome.");
      return;
    }

    if (outcome === "proficient") {
      // Move from active to archive optimistically
      setActiveLearners((prev) =>
        prev.filter((l) => l.studentId !== learner.studentId)
      );
      setArchivedLearners((prev) => [
        { ...learner, monitoringStatus: "Completed" },
        ...prev,
      ]);
      showToast(
        "success",
        `${learner.studentName} marked Proficient and moved to Completed Archive.`
      );
    } else {
      // Deficient -> immediately clear from teacher's screen and route to summer program
      setActiveLearners((prev) =>
        prev.filter((l) => l.studentId !== learner.studentId)
      );
      showToast(
        "info",
        `${learner.studentName} marked Deficient and routed to the Principal's Summer Allocation Registry.`
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-8"
    >
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <span className="font-semibold text-slate-600">ARAL Monitoring</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <PageHelp
              summary="Minimalist face-to-face teaching workspace for assigned ARAL learners."
              steps={[
                "Review each learner's rule-based Personalized Learning Plan (PLP).",
                "Check off session milestones as guided practice and drills are completed.",
                "Administer the EOSY Post-Assessment: select Proficient to archive or Deficient to refer to Summer.",
                "Free of data clutter, uploads, or macro analytics to preserve teaching focus.",
              ]}
            />
            <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
              {(close) => <TeacherSidebar mobile onNavigate={close} />}
            </MobileNavSheet>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                ARAL Teaching Workspace
              </h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                CNHS LEARN
              </span>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Facilitator: <strong className="text-slate-700">{teacherName}</strong> · Focused intervention execution, PLP targets, and post-assessment outcomes.
            </p>
          </div>

          {/* Quick Counter Pills */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <Sparkles size={14} className="text-emerald-600" />
              <span className="text-[11px] font-bold text-slate-700">
                {activeLearners.length} Active
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <CheckCircle2 size={14} className="text-blue-600" />
              <span className="text-[11px] font-bold text-slate-700">
                {archivedLearners.length} Exited
              </span>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-[12px] text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
          Loading assigned learners…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Visual Section Switcher & Filters */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] sm:flex-row sm:items-center sm:justify-between">
            {/* Two Visual Sections */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setViewTab("active")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all",
                  viewTab === "active"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Sparkles size={13} className="text-emerald-600" />
                <span>Active Workspace Roster</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    viewTab === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  {activeLearners.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewTab("archive")}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all",
                  viewTab === "archive"
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Archive size={13} className="text-blue-600" />
                <span>Archive / Completed History</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    viewTab === "archive"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  {archivedLearners.length}
                </span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search learner…"
                className="h-9 w-48 rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition-colors focus:border-emerald-500 focus:bg-white"
              />
              {sectionOptions.length > 2 && (
                <AppSelect
                  label="Section"
                  value={selectedSection}
                  onChange={setSelectedSection}
                  options={sectionOptions}
                  triggerClassName="h-9 rounded-lg px-3 text-[12px] bg-slate-50 border-slate-200"
                />
              )}
            </div>
          </div>

          {/* Section A: Active Workspace Roster */}
          {viewTab === "active" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800">
                    Active ARAL Learners
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Direct instructional cards with PLP prescriptions, milestone tracking, and EOSY post-assessment routing.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Showing {filteredActiveLearners.length} of {activeLearners.length}
                </span>
              </div>

              {filteredActiveLearners.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredActiveLearners.map((learner) => (
                    <AralStudentCard
                      key={learner.id || `${learner.studentId}-${learner.classId || learner.subject || ""}`}
                      learner={learner}
                      onOutcomeSelect={handleOutcomeSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    No active ARAL learners in this view
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500 max-w-md mx-auto">
                    {activeLearners.length === 0
                      ? "All assigned ARAL learners have either achieved proficiency and exited to the archive, or have been referred to Summer Remedials."
                      : "No learners match your search query or section filter."}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Section B: Archive / Completed History Grid */}
          {viewTab === "archive" && (
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800">
                    Completed & Exited Learners Archive
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Learners who met proficiency standards (≥ 75%) and successfully exited the ARAL intervention program.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Showing {filteredArchivedLearners.length} of {archivedLearners.length}
                </span>
              </div>

              {filteredArchivedLearners.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredArchivedLearners.map((learner) => (
                    <AralStudentCard
                      key={learner.id || `${learner.studentId}-${learner.classId || learner.subject || ""}`}
                      learner={learner}
                      isArchive={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
                    <Archive size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Archive is currently empty
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500 max-w-md mx-auto">
                    Learners will appear here once they complete their session milestones and pass the EOSY Post-Assessment with a proficient score.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </motion.div>
  );
}
