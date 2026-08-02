"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMonitoringRecord,
  getAdminMonitoringRoster,
  getStudentMonitoringDetail,
  getTeacherMonitoringRoster,
  resolveTeacherSessionForMonitoring,
} from "@/lib/supabase/queries/monitoring";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import {
  getAralAssignmentMapByStudent,
  isCurrentTeacherAralFacilitator,
} from "@/lib/supabase/queries/aralProgram";
import { syncRecommendationNotifications } from "@/lib/notifications/syncRecommendationNotifications";
import {
  buildAdminMonitoringStats,
  buildFilterOptions,
  buildMonitoringKpis,
  buildMonitoringRoster,
  mapMonitoringDetail,
} from "@/lib/teacher/monitoringMappers";

export function useTeacherMonitoring() {
  const [students, setStudents] = useState([]);
  const [classSummaries, setClassSummaries] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const session = await resolveTeacherSessionForMonitoring();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Unable to load teacher session.");
      setLoading(false);
      return;
    }

    setProfile(session.data.profile);
    setTeacher(session.data.teacher);

    const result = await getTeacherMonitoringRoster({
      teacherId: session.data.teacherId,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const roster = await buildMonitoringRoster(result.data);
    setStudents(roster.students);
    setClassSummaries(roster.classSummaries);
    setKpis(buildMonitoringKpis(roster.students, roster.classSummaries));
    setLoading(false);

    // Recommendations are computed, not stored, so the roster is the event
    // source. Deduplicated inserts keep repeated refreshes idempotent.
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
      classSummaries[0]?.quarterLabel ||
      students[0]?.quarter ||
      "Term 1";
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
    refresh,
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

    const session = await getAdminSession();
    if (session.error) {
      setError(session.error.message);
      setLoading(false);
      return;
    }

    const result = await getAdminMonitoringRoster({
      schoolYear: filters.schoolYear || null,
      quarter: filters.quarterNumber || null,
      gradeLevel: filters.gradeLevel || null,
      sectionName: filters.sectionName || null,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    const roster = await buildMonitoringRoster(result.data);
    const assignmentMap = await getAralAssignmentMapByStudent({
      schoolYear:
        filters.schoolYear ||
        roster.students[0]?.schoolYear ||
        "SY 2026-2027",
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
