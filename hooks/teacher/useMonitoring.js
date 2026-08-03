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
  getCachedBuiltTeacherRoster,
  getCachedTeacherRoster,
  invalidateTeacherRosterCache,
} from "@/lib/teacher/teacherRosterCache";
import {
  getAralAssignmentMapByStudent,
  isCurrentTeacherAralFacilitator,
} from "@/lib/supabase/queries/aralProgram";
import { syncRecommendationNotifications } from "@/lib/notifications/syncRecommendationNotifications";
import {
  buildAdminMonitoringStats,
  buildFilterOptions,
  buildMonitoringKpis,
  mapMonitoringDetail,
} from "@/lib/teacher/monitoringMappers";

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
  const [students, setStudents] = useState([]);
  const [classSummaries, setClassSummaries] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ bustCache = false } = {}) => {
    setLoading(true);
    setError("");

    if (bustCache) invalidateTeacherRosterCache();

    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setLoading(false);
      return;
    }

    setProfile(session.data.profile);
    setTeacher(session.data.teacher);

    const result = await getCachedTeacherRoster({
      teacherId: session.data.teacherId,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const roster = await getCachedBuiltTeacherRoster(result.data, {
      teacherId: session.data.teacherId,
    });
    setStudents(roster.students);
    setClassSummaries(roster.classSummaries);
    setKpis(buildMonitoringKpis(roster.students, roster.classSummaries));
    setLoading(false);

    syncRecommendationNotifications({
      profileId: session.data.profile?.id ?? null,
      students: roster.students,
      classSummaries: roster.classSummaries,
    });
  }, []);

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
    error,
    refresh: () => refresh({ bustCache: true }),
  };
}

export function useStudentMonitoringDetail(classId, studentId) {
  const [detail, setDetail] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!classId || !studentId) return;
    setLoading(true);
    setError("");

    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setLoading(false);
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
      setLoading(false);
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
    setLoading(false);
  }, [classId, studentId]);

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
    error,
    saving,
    refresh,
    saveRecord,
  };
}

export function useAdminMonitoring() {
  const [students, setStudents] = useState([]);
  const [classSummaries, setClassSummaries] = useState([]);
  const [stats, setStats] = useState({
    totalAtRisk: 0,
    aral: 0,
    remediation: 0,
    completed: 0,
    ongoing: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async (filters = {}) => {
    setLoading(true);
    setError("");

    if (filters.bustCache) invalidateAdminRosterCache();

    const session = await getAdminSession();
    if (session.error) {
      setError(session.error.message);
      setLoading(false);
      return;
    }

    const schoolYear = filters.schoolYear || null;
    const quarter = filters.quarterNumber || null;

    const result = await getCachedAdminRoster({ schoolYear, quarter });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
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

    const assignmentMap = await getAralAssignmentMapByStudent({
      schoolYear:
        schoolYear || roster.students[0]?.schoolYear || "SY 2026-2027",
    });

    const studentsWithFacilitators = roster.students.map((student) => {
      const assignment = assignmentMap.data?.get(student.studentId);
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

    setStudents(studentsWithFacilitators);
    setClassSummaries(roster.classSummaries);
    setStats(
      buildAdminMonitoringStats(
        studentsWithFacilitators,
        roster.classSummaries
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
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
    filterOptions,
    loading,
    error,
    refresh,
    selectedDetail,
    detailLoading,
    openStudent,
    closeStudent,
  };
}
