"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Folder,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  listTeachersForFacilitatorSelect,
  overrideAralAssessor,
  upsertAralFacilitatorAssignment,
} from "@/lib/supabase/queries/aralProgram";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import {
  aggregateAralLearners,
  deriveLearnerCurrentStep,
  formatReadingAssessmentDisplay,
} from "@/lib/monitoring/aralLearnerAggregation";
import { isAralProgramLearner } from "@/lib/monitoring/aralProgress";
import AnimatedModal from "@/components/shared/AnimatedModal";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

const SECTIONS_PAGE_SIZE = 9;
const LEARNERS_PAGE_SIZE = 10;

function parseGradeLabel(gradeSection, gradeLevel) {
  const fromField = String(gradeLevel || "").trim();
  if (/^Grade\s+\d+/i.test(fromField)) {
    return fromField.match(/^(Grade\s+\d+)/i)?.[1] ?? fromField;
  }
  const m = String(gradeSection || "").match(/^(Grade\s+\d+)/i);
  return m ? m[1] : "Other";
}

function sectionDisplayName(gradeSection, grade) {
  const stripped = String(gradeSection || "")
    .replace(/^Grade\s+\d+\s*[—–-]?\s*/i, "")
    .trim();
  return stripped || gradeSection || grade || "Section";
}

function formatFullSectionName(grade, rawSection) {
  const stripped = String(rawSection || "")
    .replace(/^Grade\s+\d+\s*[—–-]?\s*/i, "")
    .trim();
  const cleanSection = stripped || rawSection || "Section";
  return grade && !cleanSection.toLowerCase().startsWith(grade.toLowerCase())
    ? `${grade} – ${cleanSection}`
    : cleanSection;
}

function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

function summarizeSectionFacilitator(learners = []) {
  const assigned = learners.filter((l) => l.aralFacilitatorTeacherId);
  if (!assigned.length) {
    return { label: "None (Unassigned)", teacherId: "", isAssigned: false };
  }
  const ids = new Set(assigned.map((l) => l.aralFacilitatorTeacherId));
  if (ids.size > 1) {
    return { label: "Multiple Facilitators", teacherId: "", isAssigned: true };
  }
  const first = assigned[0];
  return {
    label: first.aralFacilitatorName || "Assigned",
    teacherId: first.aralFacilitatorTeacherId || "",
    isAssigned: true,
  };
}

function summarizeSectionAssessor(learners = []) {
  const assigned = learners.filter((l) => l.assessorTeacherId);
  if (!assigned.length) {
    return {
      label: "Reading assessment teacher not found.",
      teacherId: "",
      isAssigned: false,
    };
  }
  const first = assigned[0];
  return {
    label: first.assessorTeacherName || "Subject Teacher",
    teacherId: first.assessorTeacherId || "",
    isAssigned: true,
    role: first.assessorRole || "Subject Teacher",
  };
}

/**
 * 6 Simplified, familiar statuses for Principal monitoring:
 * - Waiting for Facilitator
 * - Waiting for Assessment
 * - Needs Individual Assessment
 * - Under ARAL Support
 * - Progress Check Due
 * - Completed
 */
function derivePrincipalStatus(learner, sectionFacilitator = null) {
  const isAssigned = Boolean(
    learner.aralFacilitatorTeacherId ||
    sectionFacilitator?.isAssigned
  );

  if (!isAssigned) {
    return "Waiting for Facilitator";
  }

  const step = deriveLearnerCurrentStep(learner);

  if (step === "completed") {
    return "Completed";
  }
  if (step === "progress_check_due") {
    return "Progress Check Due";
  }
  if (
    step === "under_aral_support" ||
    learner.supportStarted ||
    Number(learner.weeklyUpdateCount) > 0
  ) {
    return "Under ARAL Support";
  }
  if (step === "needs_individual_assessment") {
    return "Needs Individual Assessment";
  }
  return "Waiting for Assessment";
}

const STATUS_TONES = {
  "Waiting for Facilitator": "bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60",
  "Waiting for Assessment": "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10",
  "Needs Individual Assessment": "bg-blue-50 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60",
  "Under ARAL Support": "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
  "Progress Check Due": "bg-rose-50 text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60",
  "Completed": "bg-slate-50 text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-white/10",
};

function buildSectionGroups(aralRows = []) {
  const bySection = new Map();

  for (const row of aralRows) {
    const sectionKey = String(row.gradeSection || "Unassigned section").trim();
    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, new Map());
    }
    const learners = bySection.get(sectionKey);
    const studentId = String(row.studentId || row.id || "").trim();
    if (!studentId) continue;
    const existing = learners.get(studentId);

    if (!existing) {
      learners.set(studentId, {
        studentId,
        id: row.id || studentId,
        name: row.name,
        studentNumber: row.studentNumber || row.lrn || "—",
        gradeSection: sectionKey,
        gradeLevel: row.gradeLevel || null,
        schoolYear: row.schoolYear || "SY 2026-2027",
        subjects: row.subject ? [row.subject] : [],
        classIds: row.classId ? [row.classId] : [],
        sourceRows: [row],
        aralFacilitatorTeacherId: row.aralFacilitatorTeacherId || "",
        aralFacilitatorName: row.aralFacilitatorName || "",
        aralAssignmentId: row.aralAssignmentId || null,
        philIriScore: row.philIriScore ?? null,
        gstScore: row.gstScore ?? null,
        gstRawScore: row.gstRawScore ?? null,
        readingLevel: row.readingLevel ?? null,
        screeningInterpretation: row.screeningInterpretation ?? null,
        weeklyUpdateCount: Number(row.weeklyUpdateCount) || 0,
        supportStarted: Boolean(row.supportStarted),
        aralApprovalStatus: row.aralApprovalStatus || null,
        monitoringStatus: row.monitoringStatus || null,
        aralPhase: row.aralPhase || null,
      });
      continue;
    }

    if (row.subject && !existing.subjects.includes(row.subject)) {
      existing.subjects.push(row.subject);
    }
    if (row.classId && !existing.classIds.includes(row.classId)) {
      existing.classIds.push(row.classId);
    }
    existing.sourceRows.push(row);
    if (row.aralFacilitatorTeacherId) {
      existing.aralFacilitatorTeacherId = row.aralFacilitatorTeacherId;
      existing.aralFacilitatorName = row.aralFacilitatorName || existing.aralFacilitatorName;
    }
    if (row.philIriScore != null && existing.philIriScore == null) {
      existing.philIriScore = row.philIriScore;
      existing.readingLevel = row.readingLevel;
    }
    if (row.weeklyUpdateCount) {
      existing.weeklyUpdateCount = Math.max(
        existing.weeklyUpdateCount,
        Number(row.weeklyUpdateCount)
      );
    }
    if (row.supportStarted) {
      existing.supportStarted = true;
    }
  }

  return [...bySection.entries()]
    .map(([gradeSection, learnerMap]) => {
      const learners = [...learnerMap.values()].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      );
      const sample = learners[0];
      const grade = parseGradeLabel(gradeSection, sample?.gradeLevel);
      const facilitator = summarizeSectionFacilitator(learners);
      const assessor = summarizeSectionAssessor(learners);
      const isSameTeacher = Boolean(
        facilitator.isAssigned &&
        assessor.isAssigned &&
        facilitator.teacherId &&
        facilitator.teacherId === assessor.teacherId
      );

      // Section Facilitator Propagation:
      // If the section cohort has an assigned facilitator, propagate to all learners in this section
      if (facilitator.isAssigned && facilitator.teacherId) {
        for (const l of learners) {
          if (!l.aralFacilitatorTeacherId) {
            l.aralFacilitatorTeacherId = facilitator.teacherId;
            l.aralFacilitatorName = facilitator.label;
          }
        }
      }

      // Counts per step
      let waitingAssessment = 0;
      let needsIndividual = 0;
      let underSupport = 0;
      let completed = 0;

      for (const l of learners) {
        const step = deriveLearnerCurrentStep(l);
        if (step === "completed") {
          completed++;
        } else if (
          step === "under_aral_support" ||
          step === "progress_check_due" ||
          l.supportStarted ||
          l.weeklyUpdateCount > 0
        ) {
          underSupport++;
        } else if (step === "needs_individual_assessment") {
          needsIndividual++;
        } else {
          waitingAssessment++;
        }
      }

      return {
        gradeSection,
        grade,
        sectionName: formatFullSectionName(
          grade,
          sectionDisplayName(gradeSection, grade)
        ),
        learners,
        count: learners.length,
        facilitator,
        assessor,
        isSameTeacher,
        waitingAssessment,
        needsIndividual,
        underSupport,
        completed,
      };
    })
    .sort((a, b) => {
      const gDiff = gradeSortKey(a.grade) - gradeSortKey(b.grade);
      if (gDiff !== 0) return gDiff;
      return a.sectionName.localeCompare(b.sectionName);
    });
}

/**
 * Assign Facilitators Panel (Principal Flow 2):
 * - Default Section Cards view with live cohort counts
 * - Cohort Filter Chips: All Sections | Need Facilitator | Assigned
 * - Clean centered Assign Facilitator modal with searchable teacher list
 * - Consolidated 6-Column Learner Drilldown with section facilitator propagation
 * - Search within section learners with zero React key collision
 */
export default function AdminAralFacilitatorAssignPanel({
  students = [],
  onChanged,
  onViewStudent,
  initialCohortFilter = "all",
}) {
  const canonicalAralLearners = useMemo(
    () => aggregateAralLearners(students),
    [students]
  );

  const sectionGroups = useMemo(
    () => buildSectionGroups(canonicalAralLearners),
    [canonicalAralLearners]
  );

  const [cohortFilter, setCohortFilter] = useState(initialCohortFilter);
  useEffect(() => {
    if (initialCohortFilter) {
      setCohortFilter(initialCohortFilter);
    }
  }, [initialCohortFilter]);

  const [activeSection, setActiveSection] = useState(null);
  const [learnerSearch, setLearnerSearch] = useState("");
  const [learnerPage, setLearnerPage] = useState(1);

  const [modalSection, setModalSection] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [teacherError, setTeacherError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const { showToast } = useAppToast();

  // Assessor override modal state
  const [assessorModalSection, setAssessorModalSection] = useState(null);
  const [selectedAssessorId, setSelectedAssessorId] = useState("");
  const [assessorSearch, setAssessorSearch] = useState("");
  const [savingAssessor, setSavingAssessor] = useState(false);

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    setTeacherError(false);
    const result = await listTeachersForFacilitatorSelect();
    if (result.error) {
      setTeacherError(true);
      setTeachers([]);
    } else {
      setTeachers(result.data ?? []);
    }
    setLoadingTeachers(false);
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q))
    );
  }, [teachers, teacherSearch]);

  const filteredAssessorTeachers = useMemo(() => {
    const q = assessorSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q))
    );
  }, [teachers, assessorSearch]);

  const handleOpenAssessorModal = (group) => {
    setAssessorModalSection(group);
    setSelectedAssessorId(group.assessor.teacherId || "");
    setAssessorSearch("");
  };

  const handleConfirmAssessorOverride = async () => {
    if (!assessorModalSection) return;
    setSavingAssessor(true);

    const result = await overrideAralAssessor({
      learners: assessorModalSection.learners,
      assessorTeacherId: selectedAssessorId || null,
      schoolYear:
        assessorModalSection.learners[0]?.schoolYear || "SY 2026-2027",
    });

    setSavingAssessor(false);

    if (result.error) {
      showToast({
        title: "Assessor Override Error",
        message: result.error.message || "Failed to update assessor override.",
        tone: "error",
      });
      return;
    }

    const teacherObj = teachers.find((t) => t.id === selectedAssessorId);
    const teacherName = teacherObj
      ? `${teacherObj.name} (Authorized Master Teacher)`
      : "Default Subject Teacher";

    showToast({
      title: "Assessor Updated",
      message: `${teacherName} set as assessor for ${assessorModalSection.sectionName}.`,
      tone: "success",
    });

    setAssessorModalSection(null);
    onChanged?.();
  };

  // Cohort filtering
  const filteredSectionGroups = useMemo(() => {
    if (cohortFilter === "unassigned") {
      return sectionGroups.filter((g) => !g.facilitator.isAssigned);
    }
    if (cohortFilter === "assigned") {
      return sectionGroups.filter((g) => g.facilitator.isAssigned);
    }
    return sectionGroups;
  }, [sectionGroups, cohortFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSectionGroups.length / SECTIONS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * SECTIONS_PAGE_SIZE;
    return filteredSectionGroups.slice(start, start + SECTIONS_PAGE_SIZE);
  }, [filteredSectionGroups, safePage]);

  // In-section drilldown filtered learners
  const filteredLearners = useMemo(() => {
    if (!activeSection) return [];
    const q = learnerSearch.trim().toLowerCase();
    if (!q) return activeSection.learners;
    return activeSection.learners.filter((l) => {
      const nameHit = String(l.name || "").toLowerCase().includes(q);
      const lrnHit = String(l.studentNumber || "").toLowerCase().includes(q);
      return nameHit || lrnHit;
    });
  }, [activeSection, learnerSearch]);

  const totalLearnerPages = Math.max(
    1,
    Math.ceil(filteredLearners.length / LEARNERS_PAGE_SIZE) || 1
  );
  const safeLearnerPage = Math.min(Math.max(learnerPage, 1), totalLearnerPages);
  const pagedLearners = useMemo(() => {
    const start = (safeLearnerPage - 1) * LEARNERS_PAGE_SIZE;
    return filteredLearners.slice(start, start + LEARNERS_PAGE_SIZE);
  }, [filteredLearners, safeLearnerPage]);

  // Open modal for section assignment
  const handleOpenAssignModal = (group) => {
    setModalSection(group);
    setSelectedTeacherId(group.facilitator.teacherId || "");
    setTeacherSearch("");
  };

  // Submit Facilitator Assignment to all learners in section cohort
  const handleConfirmAssignment = async () => {
    if (!modalSection || !selectedTeacherId) {
      showToast({
        title: "Facilitator Required",
        message: "Please select a reading teacher / facilitator.",
        tone: "error",
      });
      return;
    }

    setSubmitting(true);
    const session = await getAdminSession();
    const profileId = session.data?.id ?? null;
    const learners = modalSection.learners;
    let failed = null;

    const teacherObj = teachers.find((t) => t.id === selectedTeacherId);
    const teacherName = teacherObj ? teacherObj.name : "Assigned Teacher";

    for (const learner of learners) {
      const sourceClassId =
        learner.classIds?.[0] || learner.sourceRows?.[0]?.classId || null;
      const result = await upsertAralFacilitatorAssignment({
        studentId: learner.studentId,
        facilitatorTeacherId: selectedTeacherId,
        sourceClassId,
        schoolYear: learner.schoolYear || "SY 2026-2027",
        assignedByProfileId: profileId,
      });

      if (result.error) {
        failed = result.error.message;
        break;
      }
    }

    setSubmitting(false);

    if (failed) {
      showToast({
        title: "Assignment Error",
        message: failed,
        tone: "error",
      });
      return;
    }

    showToast({
      title: "Facilitator Assigned",
      message: `${teacherName} is now assigned to ${modalSection.sectionName}. Learners are waiting for reading assessment.`,
      tone: "success",
    });

    setModalSection(null);
    onChanged?.();
  };

  const unassignedCount = sectionGroups.filter(
    (g) => !g.facilitator.isAssigned
  ).length;
  const assignedCount = sectionGroups.filter(
    (g) => g.facilitator.isAssigned
  ).length;

  if (!sectionGroups.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-xs">
        No approved ARAL learners waiting for facilitator assignment. Referrals must first be approved in the Review Referrals queue.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Teacher Error Banner if list fails to load */}
      {teacherError ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs text-red-700 shadow-xs">
          <div>
            <p className="font-semibold">Facilitator list could not be loaded.</p>
            <p className="mt-0.5 text-[11px] text-red-600">
              Please check your connection and retry.
            </p>
          </div>
          <button
            type="button"
            onClick={loadTeachers}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 active:scale-95"
          >
            <RefreshCw size={12} />
            <span>Try Again</span>
          </button>
        </div>
      ) : null}

      {/* Main View: Section Cards or Active Section Drilldown */}
      {!activeSection ? (
        <div className="space-y-4">
          {/* Cohort Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              <button
                type="button"
                onClick={() => {
                  setCohortFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95",
                  cohortFilter === "all"
                    ? "bg-cnhs-green-dark text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                <span>All Cohorts</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    cohortFilter === "all"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  )}
                >
                  {sectionGroups.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCohortFilter("unassigned");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95",
                  cohortFilter === "unassigned"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                <span>Need Facilitator</span>
                {unassignedCount > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                      cohortFilter === "unassigned"
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {unassignedCount}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCohortFilter("assigned");
                  setPage(1);
                }}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all active:scale-95",
                  cohortFilter === "assigned"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                <span>Assigned & In Progress</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    cohortFilter === "assigned"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                  )}
                >
                  {assignedCount}
                </span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Showing {filteredSectionGroups.length} section cohort
              {filteredSectionGroups.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Section Cards Grid */}
          {pagedSections.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-white/5 dark:bg-[var(--card)]">
              No section cohorts match the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pagedSections.map((group) => {
                const isAssigned = group.facilitator.isAssigned;

                return (
                  <div
                    key={group.gradeSection}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-cnhs-green/40 hover:shadow-md dark:border-white/5 dark:bg-[var(--card)]"
                  >
                    <div>
                      {/* Header: Section & Grade */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {group.grade}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {group.sectionName}
                          </h3>
                        </div>
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                          {group.count} learner{group.count === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-3.5 space-y-2">
                        {/* Assessment Teacher Block (Automatically resolved by Subject Teacher) */}
                        <div
                          className={cn(
                            "rounded-xl border p-2.5",
                            group.assessor.isAssigned
                              ? "border-slate-100 bg-slate-50/70 dark:border-white/5 dark:bg-white/[0.02]"
                              : "border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Reading Assessor (Subject Teacher)
                            </span>
                            {!group.assessor.isAssigned && (
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                                Action Needed
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full shrink-0",
                                group.assessor.isAssigned
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                              )}
                            />
                            <p
                              className={cn(
                                "truncate text-xs font-semibold",
                                group.assessor.isAssigned
                                  ? "text-slate-900 dark:text-slate-100"
                                  : "text-amber-800 dark:text-amber-300"
                              )}
                            >
                              {group.assessor.label}
                            </p>
                          </div>
                          {!group.assessor.isAssigned && (
                            <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                              Assign language subject teacher in Classes &amp; Sections
                            </p>
                          )}
                        </div>

                        {/* ARAL Facilitator Block (School head assigned support teacher) */}
                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            ARAL Facilitator (Support)
                          </span>
                            <div className="mt-1 flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full shrink-0",
                                  isAssigned ? "bg-emerald-500" : "bg-amber-400"
                                )}
                              />
                              <p
                                className={cn(
                                  "truncate text-xs font-semibold",
                                  isAssigned
                                    ? "text-slate-900 dark:text-slate-100"
                                    : "text-amber-700 dark:text-amber-400"
                                )}
                              >
                                {group.facilitator.label}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Summary Counts (4 clean boxes) */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                          <span className="block text-[10px] font-medium text-slate-500">
                            Waiting Assessment
                          </span>
                          <span className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {group.waitingAssessment}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                          <span className="block text-[10px] font-medium text-slate-500">
                            Needs Individual
                          </span>
                          <span className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {group.needsIndividual}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                          <span className="block text-[10px] font-medium text-slate-500">
                            Under Support
                          </span>
                          <span className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {group.underSupport}
                          </span>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                          <span className="block text-[10px] font-medium text-slate-500">
                            Completed
                          </span>
                          <span className="text-base font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {group.completed}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on Card */}
                    <div className="mt-5 border-t border-slate-100 pt-3.5 dark:border-white/5">
                      {!isAssigned ? (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(group)}
                          className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] active:scale-95"
                        >
                          <UserPlus size={13} />
                          Assign Facilitator
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSection(group);
                              setLearnerSearch("");
                              setLearnerPage(1);
                            }}
                            className="inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl bg-cnhs-green-dark px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] active:scale-95"
                          >
                            <Eye size={12} />
                            View Section Learners
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(group)}
                            className="inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <AdminTablePagination
            page={safePage}
            pageSize={SECTIONS_PAGE_SIZE}
            total={filteredSectionGroups.length}
            onPageChange={setPage}
            itemLabel="sections"
          />
        </div>
      ) : (
        /* Section Learners Drilldown Table (Consolidated 6 Columns) */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
          {/* Drilldown Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-3.5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <ChevronLeft size={13} />
                All Sections
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeSection.sectionName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {activeSection.isSameTeacher ? (
                    <>
                      Teacher:{" "}
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeSection.facilitator.label}
                      </strong>{" "}
                      (Assessment + ARAL Support)
                    </>
                  ) : (
                    <>
                      Assessor:{" "}
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeSection.assessor.label}
                      </strong>{" "}
                      · Facilitator:{" "}
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeSection.facilitator.label}
                      </strong>
                    </>
                  )}{" "}
                  · {activeSection.count} learner{activeSection.count === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* In-section Search */}
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={learnerSearch}
                  onChange={(e) => {
                    setLearnerSearch(e.target.value);
                    setLearnerPage(1);
                  }}
                  placeholder="Search learner or LRN..."
                  className="h-8 w-[200px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 sm:w-[240px]"
                />
              </div>

              <button
                type="button"
                onClick={() => handleOpenAssignModal(activeSection)}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <UserPlus size={12} />
                Reassign Facilitator
              </button>
            </div>
          </div>

          {/* 6 Clean Columns Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Reading Assessment</th>
                  <th className="px-5 py-3">Current Support</th>
                  <th className="px-5 py-3">Facilitator</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {pagedLearners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No matching learners in this section.
                    </td>
                  </tr>
                ) : (
                  pagedLearners.map((learner) => {
                    const status = derivePrincipalStatus(
                      learner,
                      activeSection.facilitator
                    );
                    const assessmentDisplay =
                      formatReadingAssessmentDisplay(learner);

                    // Current support display logic (guard against "Ongoing sessions" when not started)
                    const hasUpdates = Number(learner.weeklyUpdateCount) > 0;
                    const supportDisplay = hasUpdates
                      ? `${learner.weeklyUpdateCount} session update(s)`
                      : learner.supportStarted
                        ? "Active Support"
                        : status === "Waiting for Facilitator"
                          ? "None (Waiting for Facilitator)"
                          : "None (Waiting for Assessment)";

                    // Facilitator display inherits section facilitator if assigned
                    const facilitatorDisplay =
                      learner.aralFacilitatorName ||
                      (activeSection.facilitator.isAssigned
                        ? activeSection.facilitator.label
                        : "None (Unassigned)");

                    // Unique stable key per section and student
                    const rowKey = `${activeSection.gradeSection}::${learner.studentId}`;

                    return (
                      <tr
                        key={rowKey}
                        className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                      >
                        {/* 1. Learner */}
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {learner.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            LRN: {learner.studentNumber || learner.lrn || "—"}
                          </p>
                        </td>

                        {/* 2. Reading Assessment */}
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {assessmentDisplay}
                          </span>
                        </td>

                        {/* 3. Current Support */}
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "text-xs",
                              hasUpdates || learner.supportStarted
                                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                : "text-slate-400 dark:text-slate-500"
                            )}
                          >
                            {supportDisplay}
                          </span>
                        </td>

                        {/* 4. Facilitator (Matches Section Facilitator) */}
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {facilitatorDisplay}
                        </td>

                        {/* 5. Status */}
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              STATUS_TONES[status] ||
                                "bg-slate-100 text-slate-600"
                            )}
                          >
                            {status}
                          </span>
                        </td>

                        {/* 6. Action */}
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onViewStudent?.(
                                learner.sourceRows?.[0] || learner
                              )
                            }
                            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          >
                            <Eye size={12} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-4 py-2.5 dark:border-white/5">
            <AdminTablePagination
              page={safeLearnerPage}
              pageSize={LEARNERS_PAGE_SIZE}
              total={filteredLearners.length}
              onPageChange={setLearnerPage}
              itemLabel="learners"
            />
          </div>
        </div>
      )}

      {/* Centered Assign Facilitator Modal */}
      {modalSection ? (
        <AnimatedModal
          open={Boolean(modalSection)}
          onClose={() => setModalSection(null)}
          labelledBy="assign-facilitator-title"
        >
          <div className="w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-white/5">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                  <UserPlus size={11} />
                  Assign Reading Facilitator
                </span>
                <h2
                  id="assign-facilitator-title"
                  className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {modalSection.sectionName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Assigning facilitator to {modalSection.count} approved learner
                  {modalSection.count === 1 ? "" : "s"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSection(null)}
                aria-label="Close modal"
                className="shrink-0 cursor-pointer rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body: Teacher Search & Selection List */}
            <div className="space-y-3 px-5 py-4 text-xs">
              {/* Search Teacher Input */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  placeholder="Search facilitator name or email..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              {/* Teacher Candidates List */}
              <div className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5 dark:bg-white/[0.02]">
                {loadingTeachers ? (
                  <div className="flex h-32 items-center justify-center gap-2 text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading facilitators...</span>
                  </div>
                ) : filteredTeachers.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center text-slate-400">
                    <p>No matching teachers found.</p>
                  </div>
                ) : (
                  filteredTeachers.map((teacher) => {
                    const isSelected = selectedTeacherId === teacher.id;

                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => setSelectedTeacherId(teacher.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-cnhs-green bg-emerald-50 text-cnhs-green-dark shadow-xs dark:bg-emerald-950/40"
                            : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {teacher.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {teacher.email || "No email on record"}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            isSelected
                              ? "border-cnhs-green bg-cnhs-green-dark text-white"
                              : "border-slate-300 bg-white"
                          )}
                        >
                          {isSelected ? <CheckCircle2 size={12} /> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Note on workflow state transition */}
              <div className="rounded-xl bg-slate-100/70 p-3 text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Workflow Safeguard:
                </span>{" "}
                Assigning a facilitator moves learners into{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Waiting for Assessment
                </span>
                . Active support only begins after the initial assessment is completed.
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setModalSection(null)}
                className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting || !selectedTeacherId}
                onClick={handleConfirmAssignment}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Confirm Assignment
              </button>
            </div>
          </div>
        </AnimatedModal>
      ) : null}

      {/* Centered Change Assessor modal removed from normal workflow */}
      {false && assessorModalSection ? (
        <AnimatedModal
          open={Boolean(assessorModalSection)}
          onClose={() => setAssessorModalSection(null)}
          labelledBy="change-assessor-title"
        >
          <div className="w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-white/5">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <UserCog size={11} />
                  Phil-IRI Assessor Override
                </span>
                <h2
                  id="change-assessor-title"
                  className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {assessorModalSection.sectionName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  By default, assessments are handled by the Subject Teacher. You may assign an authorized Master Teacher override below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssessorModalSection(null)}
                aria-label="Close modal"
                className="shrink-0 cursor-pointer rounded-full p-1.5 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Current Default Assessor Info */}
            <div className="border-b border-slate-100 bg-blue-50/40 px-5 py-2.5 text-xs text-blue-900 dark:border-white/5 dark:bg-blue-950/20 dark:text-blue-200">
              <span className="font-semibold">Current Resolution: </span>
              {assessorModalSection.assessor.label} ({assessorModalSection.assessor.role || "Subject Teacher"})
            </div>

            {/* Body */}
            <div className="space-y-3 px-5 py-4 text-xs">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={assessorSearch}
                  onChange={(e) => setAssessorSearch(e.target.value)}
                  placeholder="Search Master Teacher name or email..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              {/* Revert to default option */}
              <button
                type="button"
                onClick={() => setSelectedAssessorId("")}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                  !selectedAssessorId
                    ? "border-blue-500 bg-blue-50/80 text-blue-900 shadow-xs dark:bg-blue-950/40 dark:text-blue-200"
                    : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03]"
                )}
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Use Default Subject Teacher
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Automatic DepEd Form 1/3 resolution: English/Filipino Subject Teacher
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    !selectedAssessorId
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 bg-white"
                  )}
                >
                  {!selectedAssessorId ? <CheckCircle2 size={12} /> : null}
                </div>
              </button>

              {/* Teacher Candidates List */}
              <div className="max-h-[220px] space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5 dark:bg-white/[0.02]">
                {loadingTeachers ? (
                  <div className="flex h-24 items-center justify-center gap-2 text-slate-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading teachers...</span>
                  </div>
                ) : filteredAssessorTeachers.length === 0 ? (
                  <div className="flex h-24 flex-col items-center justify-center text-slate-400">
                    <p>No matching teachers found.</p>
                  </div>
                ) : (
                  filteredAssessorTeachers.map((teacher) => {
                    const isSelected = selectedAssessorId === teacher.id;

                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => setSelectedAssessorId(teacher.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-blue-500 bg-blue-50 text-blue-950 shadow-xs dark:bg-blue-950/40 dark:text-blue-200"
                            : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {teacher.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {teacher.email || "Teacher"}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white"
                          )}
                        >
                          {isSelected ? <CheckCircle2 size={12} /> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setAssessorModalSection(null)}
                className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingAssessor}
                onClick={handleConfirmAssessorOverride}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white shadow-xs transition hover:bg-blue-800 active:scale-95 disabled:opacity-50"
              >
                {savingAssessor ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Save Assessor
              </button>
            </div>
          </div>
        </AnimatedModal>
      ) : null}
    </section>
  );
}
