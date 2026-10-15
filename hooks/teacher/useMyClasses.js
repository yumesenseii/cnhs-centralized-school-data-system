"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getClassById,
  getClassGrades,
  getClassStudents,
  getCurrentTeacherSession,
  getStudentGrades,
  getStudentInClass,
  getTeacherClasses,
} from "@/lib/supabase/queries/myClasses";
import {
  buildClassKpis,
  buildGradeStatsByStudent,
  buildMyClassesKpis,
  groupClassesForMyClassesList,
  mapClassRecord,
  mapEnrollmentToStudent,
  summarizeStudentGrades,
} from "@/lib/teacher/myClassesMappers";
import { parseTermNumber, TERM_OPTIONS, termLabel } from "@/lib/academic/termLabels";
import { syncSiblingClassRosters } from "@/lib/academic/siblingTermClasses";
import { createClient } from "@/lib/supabase/client";
import { deriveLearnerMonitoringState } from "@/lib/monitoring/academicMonitoringState";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useTeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [profile, setProfile] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const refresh = useCallback(async (opts = {}) => {
    beginLoad();
    setError("");

    const sessionResult = await getCurrentTeacherSession();
    if (sessionResult.error || !sessionResult.data) {
      setError(
        sessionResult.error?.message ?? "Unable to load teacher profile."
      );
      endLoad(false);
      return;
    }

    const { profile: nextProfile, teacher: nextTeacher, teacherId } =
      sessionResult.data;
    setProfile(nextProfile);
    setTeacher(nextTeacher);

    const classesResult = await getTeacherClasses(teacherId, {
      bypassCache: Boolean(opts?.bypassCache ?? opts?.force),
    });
    if (classesResult.error) {
      setError(classesResult.error.message);
      endLoad(false);
      return;
    }

    const mapped = (classesResult.data ?? []).map(mapClassRecord);
    const grouped = groupClassesForMyClassesList(mapped);
    setClasses(grouped);
    setKpis(buildMyClassesKpis(grouped));
    endLoad(true);
  }, [beginLoad, endLoad]);

  useEffect(() => {
    refresh();

    function handleInvalidation() {
      refresh({ bypassCache: true });
    }
    if (typeof window !== "undefined") {
      window.addEventListener("cnhs-classes-invalidated", handleInvalidation);
      return () => {
        window.removeEventListener("cnhs-classes-invalidated", handleInvalidation);
      };
    }
  }, [refresh]);

  return {
    classes,
    kpis,
    profile,
    teacher,
    teacherId: teacher?.id ?? null,
    loading,
    refreshing,
    error,
    refresh,
  };
}

export function useClassDetails(classId) {
  const [classItem, setClassItem] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [gradeRows, setGradeRows] = useState([]);
  const [allTermGradeRows, setAllTermGradeRows] = useState([]);
  const [viewQuarter, setViewQuarter] = useState(null);
  const [termClassIds, setTermClassIds] = useState({});
  const [availableTerms, setAvailableTerms] = useState([1, 2, 3, 4]);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad, resetLoaded } =
    useSoftLoadState(true);

  useEffect(() => {
    resetLoaded();
    setClassItem(null);
    setViewQuarter(null);
  }, [classId, resetLoaded]);

  const refresh = useCallback(async () => {
    if (!classId) return;
    beginLoad();
    setError("");

    const sessionResult = await getCurrentTeacherSession();
    if (sessionResult.error || !sessionResult.data) {
      setError(
        sessionResult.error?.message ?? "Unable to load teacher profile."
      );
      endLoad(false);
      return;
    }

    const { teacherId } = sessionResult.data;

    const classResult = await getClassById(classId, { teacherId });
    if (classResult.error || !classResult.data) {
      setError(classResult.error?.message ?? "Class not found.");
      endLoad(false);
      return;
    }

    const mappedClass = mapClassRecord(classResult.data);
    const sectionAdviserId = classResult.data?.sections?.adviser_id;
    mappedClass.isAdviser = Boolean(teacherId && sectionAdviserId === teacherId);

    const classQuarter =
      parseTermNumber(mappedClass.quarterNumber) ||
      parseTermNumber(mappedClass.quarter) ||
      parseTermNumber(mappedClass.quarterLabel) ||
      1;

    const [studentsResult, gradesResult, siblingsResult] = await Promise.all([
      getClassStudents(classId, { teacherId }),
      getClassGrades(classId),
      getTeacherClasses(teacherId),
    ]);

    if (studentsResult.error) {
      setError(studentsResult.error.message);
      endLoad(false);
      return;
    }
    if (gradesResult.error) {
      setError(gradesResult.error.message);
      endLoad(false);
      return;
    }

    const classWithRoster = mapClassRecord({
      ...classResult.data,
      class_students: studentsResult.data ?? [],
    });

    const family = {
      teacherId,
      subjectId: classWithRoster.subjectId,
      sectionId: classWithRoster.sectionId,
      schoolYear: classWithRoster.schoolYear,
    };
    if (family.subjectId && family.sectionId && family.schoolYear) {
      await syncSiblingClassRosters(createClient(), family);
    }

    const siblingMapped = (siblingsResult.data ?? []).map(mapClassRecord);
    const grouped = groupClassesForMyClassesList(siblingMapped);
    const group =
      grouped.find(
        (item) =>
          item.id === classId ||
          (item.relatedClassIds ?? []).includes(classId) ||
          Object.values(item.termClassIds ?? {}).includes(classId)
      ) ?? null;

    const nextTermIds = group?.termClassIds ?? classWithRoster.termClassIds ?? {
      [classQuarter]: classId,
    };
    const nextAvailable = [1, 2, 3, 4];

    let nextEnrollments = studentsResult.data ?? [];
    if (family.subjectId && family.sectionId && family.schoolYear) {
      const refreshed = await getClassStudents(classId, { teacherId });
      if (!refreshed.error && refreshed.data) {
        nextEnrollments = refreshed.data;
      }
    }

    setClassItem({
      ...classWithRoster,
      students: nextEnrollments.length,
      hasLearners: nextEnrollments.length > 0,
      isTermGroup: Boolean(group?.isTermGroup) || Object.keys(nextTermIds).length > 1,
      termClassIds: nextTermIds,
      availableTerms: nextAvailable,
      quarterLabel: group?.isTermGroup
        ? termLabel(classQuarter)
        : classWithRoster.quarterLabel,
    });
    setTermClassIds(nextTermIds);
    setAvailableTerms(nextAvailable);
    setEnrollments(nextEnrollments);
    setGradeRows(gradesResult.data ?? []);

    const siblingIds = [
      ...new Set(
        Object.values(nextTermIds).filter(Boolean).map(String)
      ),
    ];
    if (siblingIds.length <= 1) {
      setAllTermGradeRows(gradesResult.data ?? []);
    } else {
      const siblingGradeResults = await Promise.all(
        siblingIds.map((id) => getClassGrades(id))
      );
      const firstError = siblingGradeResults.find((r) => r.error);
      if (firstError?.error) {
        setAllTermGradeRows(gradesResult.data ?? []);
      } else {
        setAllTermGradeRows(
          siblingGradeResults.flatMap((r) => r.data ?? [])
        );
      }
    }

    setViewQuarter((current) => current ?? classQuarter);
    endLoad(true);
  }, [classId, beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const preferredQuarter =
    viewQuarter ??
    parseTermNumber(classItem?.quarterNumber) ??
    parseTermNumber(classItem?.quarterLabel) ??
    1;

  const students = (() => {
    const sourceRows =
      allTermGradeRows.length > 0 ? allTermGradeRows : gradeRows;
    const gradeStats = buildGradeStatsByStudent(sourceRows, {
      preferredQuarter,
    });
    return enrollments.map((enrollment) =>
      mapEnrollmentToStudent(
        enrollment,
        gradeStats.get(enrollment.student_id) ?? null
      )
    );
  })();

  const kpis = classItem ? buildClassKpis(classItem, students) : [];

  return {
    classItem,
    students,
    kpis,
    loading,
    refreshing,
    error,
    refresh,
    viewQuarter: preferredQuarter,
    setViewQuarter,
    gradeRows,
    allTermGradeRows,
    termClassIds,
    availableTerms:
      availableTerms.length > 0 ? availableTerms : TERM_OPTIONS.map((t) => Number(t.value)),
    termOptions: [1, 2, 3].map((n) => ({
      value: n,
      label: termLabel(n),
      classId: termClassIds[n] ?? null,
    })),
  };
}

export function useStudentProfile(classId, studentId) {
  const [classItem, setClassItem] = useState(null);
  const [student, setStudent] = useState(null);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const sessionResult = await getCurrentTeacherSession();
      if (!active) return;

      if (sessionResult.error || !sessionResult.data) {
        setError(
          sessionResult.error?.message ?? "Unable to load teacher profile."
        );
        setLoading(false);
        return;
      }

      const { teacherId } = sessionResult.data;

      const supabase = createClient();
      const [classResult, studentResult, siblingsResult, monitoringResult, aralResult] = await Promise.all([
        getClassById(classId, { teacherId }),
        getStudentInClass(classId, studentId, { teacherId }),
        getTeacherClasses(teacherId),
        supabase
          .from("monitoring_records")
          .select("id, student_id, class_id, monitoring_status, intervention_given, teacher_remarks, observation_date, student_progress, created_at")
          .eq("student_id", studentId)
          .order("observation_date", { ascending: false }),
        supabase
          .from("aral_recommendation_approvals")
          .select("id, student_id, status, approval_status, principal_notes")
          .eq("student_id", studentId)
          .maybeSingle(),
      ]);

      if (!active) return;

      if (classResult.error || !classResult.data) {
        setError(classResult.error?.message ?? "Class not found.");
        setLoading(false);
        return;
      }

      if (studentResult.error || !studentResult.data) {
        setError(
          studentResult.error?.message ?? "Student not found in this class."
        );
        setLoading(false);
        return;
      }

      const mappedClass = mapClassRecord(classResult.data);
      const siblingMapped = (siblingsResult.data ?? []).map(mapClassRecord);
      const grouped = groupClassesForMyClassesList(siblingMapped);
      const group =
        grouped.find(
          (item) =>
            item.id === classId ||
            (item.relatedClassIds ?? []).includes(classId) ||
            Object.values(item.termClassIds ?? {}).includes(classId)
        ) ?? null;

      const termClassIds = group?.termClassIds ?? mappedClass.termClassIds ?? {};
      const siblingIds = [
        ...new Set([
          classId,
          ...Object.values(termClassIds).filter(Boolean).map(String),
        ]),
      ];

      const gradesResult = await getStudentGrades(classId, studentId, {
        classIds: siblingIds,
        subjectId: mappedClass.subjectId,
        schoolYear: mappedClass.schoolYear,
      });

      if (!active) return;

      if (gradesResult.error) {
        setError(gradesResult.error.message);
        setLoading(false);
        return;
      }

      const latestMonitoring = monitoringResult?.data?.[0] ?? null;
      const aralData = aralResult?.data ?? null;

      const gradeRows = gradesResult.data ?? [];
      const summary = summarizeStudentGrades(gradeRows);
      const mappedStudent = mapEnrollmentToStudent(
        studentResult.data,
        summary
      );

      const learnerBundle = {
        ...mappedStudent,
        id: studentId,
        student_id: studentId,
        subject: mappedClass.subject,
        currentGrade: summary.currentGrade,
        classSubjectGrade: summary.currentGrade,
        previousGrade: summary.previousGrade,
        monitoringStatus: latestMonitoring?.monitoring_status,
        monitoring_status: latestMonitoring?.monitoring_status,
        remedialStatus: latestMonitoring?.monitoring_status,
        interventionStatus: latestMonitoring?.monitoring_status,
        interventionGiven: latestMonitoring?.intervention_given,
        intervention_given: latestMonitoring?.intervention_given,
        teacherRemarks: latestMonitoring?.teacher_remarks,
        latestObservationDate: latestMonitoring?.observation_date,
        aralApprovalStatus: aralData?.status || aralData?.approval_status,
      };

      const monitoringState = deriveLearnerMonitoringState(learnerBundle);

      setClassItem(mappedClass);
      setStudent({
        ...mappedStudent,
        grade: mappedClass.grade,
        section: mappedClass.section,
        quarter: termLabel(mappedClass.quarterNumber || mappedClass.quarter) || mappedClass.quarterLabel,
        schoolYear: mappedClass.schoolYear,
        assignedClass: `${mappedClass.gradeSection} · ${mappedClass.subject}`,
        summary,
        monitoringState,
        latestMonitoring,
        aralData,
      });
      setGrades(gradeRows);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [classId, studentId]);

  return { classItem, student, grades, loading, error };
}
