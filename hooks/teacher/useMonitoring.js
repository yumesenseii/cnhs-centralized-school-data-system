"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMonitoringRecord,
  getStudentMonitoringDetail,
  resolveTeacherSessionForMonitoring,
} from "@/lib/supabase/queries/monitoring";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import {
  getCachedAdminRoster,
  getCachedBuiltMonitoringRoster,
  invalidateAdminRosterCache,
} from "@/lib/admin/adminRosterCache";
import {
  getEmptyAdminMonitoringStats,
  hasAdminMonitoringUiSnapshot,
  peekAdminMonitoringUiSnapshot,
  saveAdminMonitoringUiSnapshot,
} from "@/lib/admin/adminMonitoringUiCache";
import {
  getCachedBuiltTeacherRoster,
  getCachedTeacherRoster,
  invalidateTeacherRosterCache,
} from "@/lib/teacher/teacherRosterCache";
import {
  hasTeacherMonitoringUiSnapshot,
  peekTeacherMonitoringUiSnapshot,
  saveTeacherMonitoringUiSnapshot,
} from "@/lib/teacher/teacherMonitoringUiCache";
import {
  getAralAssignmentMapByStudent,
  isCurrentTeacherAralFacilitator,
} from "@/lib/supabase/queries/aralProgram";
import { listAralApprovals } from "@/lib/supabase/queries/aralApprovals";
import { attachAralApprovals } from "@/lib/monitoring/aralApproval";
import { syncRecommendationNotifications } from "@/lib/notifications/syncRecommendationNotifications";
import {
  buildAdminMonitoringStats,
  buildFilterOptions,
  buildMonitoringKpis,
  mapMonitoringDetail,
} from "@/lib/teacher/monitoringMappers";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function filterRosterPayload(
  payload,
  { gradeLevel = null, sectionName = null } = {}
) {
  let classes = payload?.classes ?? [];
  if (gradeLevel !== null && gradeLevel !== undefined && gradeLevel !== "") {
    classes = classes.filter(
      (row) => Number(unwrap(row.sections)?.grade_level) === Number(gradeLevel)
    );
  }
  if (sectionName) {
    classes = classes.filter(
      (row) => unwrap(row.sections)?.section_name === sectionName
    );
  }
  const classIds = new Set(classes.map((row) => row.id));
  return {
    classes,
    enrollments: (payload?.enrollments ?? []).filter((row) =>
      classIds.has(row.class_id)
    ),
    grades: (payload?.grades ?? []).filter((row) => classIds.has(row.class_id)),
    monitoringRecords: (payload?.monitoringRecords ?? []).filter((row) =>
      classIds.has(row.class_id)
    ),
  };
}

export function useTeacherMonitoring() {
  const cached = peekTeacherMonitoringUiSnapshot();
  const hadSnapshot = hasTeacherMonitoringUiSnapshot();

  const [students, setStudents] = useState(() => cached?.students ?? []);
  const [classSummaries, setClassSummaries] = useState(
    () => cached?.classSummaries ?? []
  );
  const [kpis, setKpis] = useState(() => cached?.kpis ?? []);
  const [teacher, setTeacher] = useState(() => cached?.teacher ?? null);
  const [profile, setProfile] = useState(() => cached?.profile ?? null);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(
    !hadSnapshot,
    hadSnapshot
  );

  const refresh = useCallback(async ({ bustCache = false } = {}) => {
    beginLoad();
    setError("");

    if (bustCache) invalidateTeacherRosterCache();

    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      endLoad(false);
      return;
    }

    setProfile(session.data.profile);
    setTeacher(session.data.teacher);

    const result = await getCachedTeacherRoster({
      teacherId: session.data.teacherId,
    });

    if (result.error) {
      setError(result.error.message);
      endLoad(false);
      return;
    }

    const roster = await getCachedBuiltTeacherRoster(result.data, {
      teacherId: session.data.teacherId,
    });

    const schoolYear =
      roster.students[0]?.schoolYear ||
      roster.classSummaries[0]?.schoolYear ||
      null;
    const approvals = await listAralApprovals({ schoolYear });
    const studentsWithApprovals = attachAralApprovals(
      roster.students,
      approvals.data ?? new Map()
    );

    const nextKpis = buildMonitoringKpis(
      studentsWithApprovals,
      roster.classSummaries
    );

    setStudents(studentsWithApprovals);
    setClassSummaries(roster.classSummaries);
    setKpis(nextKpis);
    saveTeacherMonitoringUiSnapshot({
      students: studentsWithApprovals,
      classSummaries: roster.classSummaries,
      kpis: nextKpis,
      teacher: session.data.teacher,
      profile: session.data.profile,
    });
    endLoad(true);

    syncRecommendationNotifications({
      profileId: session.data.profile?.id ?? null,
      students: studentsWithApprovals,
      classSummaries: roster.classSummaries,
    });
  }, [beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filterOptions = useMemo(
    () => buildFilterOptions(students, classSummaries),
    [students, classSummaries]
  );

  const controls = useMemo(() => {
    const schoolYear =
      classSummaries[0]?.schoolYear ||
      students[0]?.schoolYear ||
      "SY 2026-2027";
    const quarter =
      classSummaries[0]?.quarterLabel || students[0]?.quarter || "Term 1";
    return { schoolYear, quarter };
  }, [classSummaries, students]);

  return {
    students,
    classSummaries,
    kpis,
    filterOptions,
    controls,
    teacher,
    profile,
    teacherId: teacher?.id ?? null,
    loading,
    refreshing,
    error,
    refresh: () => refresh({ bustCache: true }),
  };
}

export function useStudentMonitoringDetail(classId, studentId) {
  const [detail, setDetail] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { loading, refreshing, beginLoad, endLoad, resetLoaded } =
    useSoftLoadState(true);

  useEffect(() => {
    resetLoaded();
    setDetail(null);
  }, [classId, studentId, resetLoaded]);

  const refresh = useCallback(async () => {
    if (!classId || !studentId) return;
    beginLoad();
    setError("");

    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      endLoad(false);
      return;
    }

    setTeacher(session.data.teacher);

    const result = await getStudentMonitoringDetail({
      classId,
      studentId,
      teacherId: session.data.teacherId,
    });

    if (result.error) {
      setError(result.error.message);
      endLoad(false);
      return;
    }

    setDetail(await mapMonitoringDetail(result.data));

    const facilitatorCheck = await isCurrentTeacherAralFacilitator(studentId);
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            isAralFacilitator: Boolean(facilitatorCheck.data),
          }
        : prev
    );
    endLoad(true);
  }, [classId, studentId, beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveRecord = useCallback(
    async (form) => {
      if (!detail || !teacher?.id) {
        return { ok: false, error: new Error("Missing student or teacher context.") };
      }

      setSaving(true);
      const result = await createMonitoringRecord({
        student_id: detail.studentId,
        class_id: detail.classId,
        teacher_id: teacher.id,
        observation_date: form.observationDate,
        intervention_given: form.interventionGiven,
        teacher_remarks: form.teacherRemarks,
        student_progress: form.studentProgress,
        follow_up_needed: form.followUpNeeded,
        monitoring_status: form.monitoringStatus,
        school_year: detail.schoolYear,
        quarter: detail.quarterNumber,
      });
      setSaving(false);

      if (result.error) return { ok: false, error: result.error };
      await refresh();
      return { ok: true, data: result.data };
    },
    [detail, teacher, refresh]
  );

  return {
    detail,
    teacher,
    loading,
    refreshing,
    error,
    saving,
    refresh,
    saveRecord,
  };
}

export function useAdminMonitoring() {
  const cached = peekAdminMonitoringUiSnapshot();
  const hadSnapshot = hasAdminMonitoringUiSnapshot();

  const [students, setStudents] = useState(() => cached?.students ?? []);
  const [classSummaries, setClassSummaries] = useState(
    () => cached?.classSummaries ?? []
  );
  const [stats, setStats] = useState(
    () => cached?.stats ?? getEmptyAdminMonitoringStats()
  );
  const [profile, setProfile] = useState(() => cached?.profile ?? null);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(
    !hadSnapshot,
    hadSnapshot
  );

  const refresh = useCallback(async (filters = {}) => {
    beginLoad();
    setError("");

    try {
      if (filters.bustCache) invalidateAdminRosterCache();

      const session = await getAdminSession();
      if (session.error) {
        setError(session.error.message || "Unable to verify admin session.");
        return;
      }
      setProfile(session.data ?? null);

      const schoolYear = filters.schoolYear || null;
      const quarter = filters.quarterNumber || null;

      const result = await getCachedAdminRoster({ schoolYear, quarter });

      if (result.error) {
        setError(
          result.error.message || "Unable to load monitoring data. Try Refresh."
        );
        return;
      }

      const scoped = filterRosterPayload(result.data, {
        gradeLevel: filters.gradeLevel || null,
        sectionName: filters.sectionName || null,
      });

      const scope =
        filters.gradeLevel || filters.sectionName
          ? `g${filters.gradeLevel || "all"}-s${filters.sectionName || "all"}`
          : "default";

      const roster = await getCachedBuiltMonitoringRoster(scoped, {
        schoolYear,
        quarter,
        scope,
      });

      const resolvedSchoolYear =
        schoolYear || roster.students[0]?.schoolYear || "SY 2026-2027";

      let facilitatorMap = new Map();
      try {
        const assignmentMap = await getAralAssignmentMapByStudent({
          schoolYear: resolvedSchoolYear,
        });
        if (assignmentMap.error) {
          console.warn(
            "[admin monitoring] facilitator assignments unavailable",
            assignmentMap.error
          );
        } else {
          facilitatorMap = assignmentMap.data ?? new Map();
        }
      } catch (assignmentErr) {
        console.warn(
          "[admin monitoring] facilitator assignments fetch failed",
          assignmentErr
        );
      }

      const studentsWithFacilitators = roster.students.map((student) => {
        const assignment = facilitatorMap.get(student.studentId);
        if (!assignment) {
          return {
            ...student,
            aralFacilitatorAssigned: false,
            aralFacilitatorTeacherId: null,
            aralFacilitatorName: null,
            aralAssignmentId: null,
          };
        }
        return {
          ...student,
          aralFacilitatorAssigned: true,
          aralFacilitatorTeacherId: assignment.facilitatorTeacherId,
          aralFacilitatorName: assignment.facilitatorName,
          aralAssignmentId: assignment.id,
        };
      });

      let approvalMap = new Map();
      try {
        const approvals = await listAralApprovals({
          schoolYear: resolvedSchoolYear,
          // Always load all terms so Term 1 Send-to-HT rows stay visible under All Terms
          // and when the page term filter differs from the report term.
          quarter: null,
        });
        approvalMap = approvals.data ?? new Map();
      } catch (approvalErr) {
        console.warn("[admin monitoring] approval fetch failed", approvalErr);
      }

      const studentsWithApprovals = attachAralApprovals(
        studentsWithFacilitators,
        approvalMap
      );

      const nextStats = buildAdminMonitoringStats(
        studentsWithApprovals,
        roster.classSummaries
      );

      setStudents(studentsWithApprovals);
      setClassSummaries(roster.classSummaries);
      setStats(nextStats);
      saveAdminMonitoringUiSnapshot({
        students: studentsWithApprovals,
        classSummaries: roster.classSummaries,
        stats: nextStats,
        profile: session.data ?? null,
      });
    } catch (err) {
      console.error("[admin monitoring] refresh failed", err);
      setError(
        err?.message || "Unable to refresh monitoring data. Please try again."
      );
    } finally {
      endLoad(true);
    }
  }, [beginLoad, endLoad]);

  useEffect(() => {
    // Soft revisit: paint cached UI immediately; quiet background refresh.
    // Hard wipe only when Refresh passes bustCache (roster TTL invalidated).
    refresh();
  }, [refresh]);

  const filterOptions = useMemo(
    () => buildFilterOptions(students, classSummaries),
    [students, classSummaries]
  );

  const openStudent = useCallback(async (learner) => {
    if (!learner?.classId || !learner?.studentId) return;
    setDetailLoading(true);
    const result = await getStudentMonitoringDetail({
      classId: learner.classId,
      studentId: learner.studentId,
    });
    if (!result.error) {
      setSelectedDetail(await mapMonitoringDetail(result.data));
    }
    setDetailLoading(false);
  }, []);

  const closeStudent = useCallback(() => {
    setSelectedDetail(null);
  }, []);

  return {
    students,
    classSummaries,
    stats,
    profile,
    filterOptions,
    loading,
    refreshing,
    error,
    refresh,
    selectedDetail,
    detailLoading,
    openStudent,
    closeStudent,
  };
}
