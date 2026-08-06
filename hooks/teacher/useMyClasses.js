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
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useTeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [profile, setProfile] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const refresh = useCallback(async () => {
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

    const classesResult = await getTeacherClasses(teacherId);
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
    const nextAvailable =
      group?.availableTerms?.length > 0
        ? group.availableTerms
        : classWithRoster.availableTerms ?? [classQuarter];

    setClassItem({
      ...classWithRoster,
      isTermGroup: Boolean(group?.isTermGroup),
      termClassIds: nextTermIds,
      availableTerms: nextAvailable,
      quarterLabel: group?.isTermGroup
        ? termLabel(classQuarter)
        : classWithRoster.quarterLabel,
    });
    setTermClassIds(nextTermIds);
    setAvailableTerms(nextAvailable);
    setEnrollments(studentsResult.data ?? []);
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

    setViewQuarter(classQuarter);
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
    const gradeStats = buildGradeStatsByStudent(gradeRows, {
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
    termOptions: (availableTerms.length > 0
      ? availableTerms
      : [1, 2, 3, 4]
    ).map((n) => ({
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

      const [classResult, studentResult] = await Promise.all([
        getClassById(classId, { teacherId }),
        getStudentInClass(classId, studentId, { teacherId }),
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

      const gradesResult = await getStudentGrades(classId, studentId, {
        schoolYear: mappedClass.schoolYear,
      });

      if (!active) return;

      if (gradesResult.error) {
        setError(gradesResult.error.message);
        setLoading(false);
        return;
      }

      const gradeRows = gradesResult.data ?? [];
      const summary = summarizeStudentGrades(gradeRows);
      const mappedStudent = mapEnrollmentToStudent(
        studentResult.data,
        summary
      );

      setClassItem(mappedClass);
      setStudent({
        ...mappedStudent,
        grade: mappedClass.grade,
        section: mappedClass.section,
        quarter: mappedClass.quarterLabel || mappedClass.currentQuarter,
        schoolYear: mappedClass.schoolYear,
        assignedClass: `${mappedClass.gradeSection} · ${mappedClass.subject}`,
        averageGrade: summary.generalAverage,
        weakSubject: summary.weakestSubject,
        academicSummary: {
          quarterLabel: "Grades per Quarter",
          columnLabel: "Quarter",
          subjects: summary.subjects,
          generalAverage: summary.generalAverage,
        },
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
