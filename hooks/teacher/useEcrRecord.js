"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeLearnerRow,
  computeFinalFromTerms,
  parseRecordedGrade,
  termGradeDescription,
} from "@/lib/ecr/computeGrades";
import {
  compareLearnersBySurname,
  getLearnerRowStatus,
} from "@/lib/ecr/gridLayout";
import { scoreKey } from "@/lib/ecr/constants";
import {
  getOrCreateEcrWorkbook,
  loadEcrTermSheet,
  loadEcrWorkbookSummary,
  saveEcrTermSheet,
  syncEcrAveToGrades,
} from "@/lib/supabase/queries/ecr";
import {
  getClassStudents,
  getClassById,
  getCurrentTeacherSession,
  getTeacherClasses,
} from "@/lib/supabase/queries/myClasses";
import {
  formatStudentName,
  mapEnrollmentToStudent,
} from "@/lib/teacher/myClassesMappers";
import { formatSf2LearnerName } from "@/lib/attendance/sf2Daily";
import { parseTermNumber } from "@/lib/academic/termLabels";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

function buildSiblingClassMap(classItem, teacherClasses = []) {
  const subjectId = classItem?.subjectId ?? classItem?.subject_id;
  const sectionId = classItem?.sectionId ?? classItem?.section_id;
  const schoolYear = classItem?.schoolYear ?? classItem?.school_year;
  const teacherId = classItem?.teacherId ?? classItem?.teacher_id;
  const map = {};
  const selfQ =
    parseTermNumber(classItem?.quarter) ||
    parseTermNumber(classItem?.currentQuarter) ||
    1;
  map[selfQ] = classItem?.id;

  for (const row of teacherClasses) {
    if (teacherId && row.teacher_id && row.teacher_id !== teacherId) continue;
    if (subjectId && row.subject_id !== subjectId) continue;
    if (sectionId && row.section_id !== sectionId) continue;
    if (schoolYear && row.school_year !== schoolYear) continue;
    const q = parseTermNumber(row.quarter);
    if (!q) continue;
    map[q] = row.id;
  }
  return map;
}

function scoresByStudentFromRows(rows = []) {
  const map = {};
  for (const row of rows) {
    const bucket = map[row.student_id] ?? {};
    bucket[scoreKey(row.component, row.item_index)] =
      row.raw_score === null || row.raw_score === undefined
        ? ""
        : String(row.raw_score);
    map[row.student_id] = bucket;
  }
  return map;
}

function unwrapRelation(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function useEcrRecord(classId) {
  const [error, setError] = useState("");
  const [classItem, setClassItem] = useState(null);
  const [students, setStudents] = useState([]);
  const [workbook, setWorkbook] = useState(null);
  const [activeTerm, setActiveTerm] = useState(1);
  const [config, setConfig] = useState([]);
  const [studentScores, setStudentScores] = useState({});
  const [importedComputed, setImportedComputed] = useState({});
  const [summaryRows, setSummaryRows] = useState([]);
  const [siblingClassMap, setSiblingClassMap] = useState({});
  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const suppressDirtyRef = useRef(true);
  const autoSaveTimerRef = useRef(null);
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const activeTermSheet = useMemo(() => {
    return (workbook?.ecr_term_sheets ?? []).find(
      (s) => Number(s.term) === Number(activeTerm)
    );
  }, [workbook, activeTerm]);

  const computedByStudent = useMemo(() => {
    const map = {};
    for (const student of students) {
      const scores = studentScores[student.id] ?? {};
      const live = computeLearnerRow(scores, config);
      const imported = importedComputed[student.id];
      const hasLiveScores = Object.values(scores).some(
        (v) => v !== "" && v !== null && v !== undefined
      );
      if (hasLiveScores && live?.term_grade != null) {
        map[student.id] = live;
      } else if (imported?.term_grade != null) {
        map[student.id] = {
          ...(live ?? {}),
          ...imported,
          term_grade: imported.term_grade,
          description: termGradeDescription(imported.term_grade),
        };
      } else {
        map[student.id] = live;
      }
    }
    return map;
  }, [students, studentScores, config, importedComputed]);

  const gradedProgress = useMemo(() => {
    let graded = 0;
    for (const student of students) {
      const status = getLearnerRowStatus(
        studentScores[student.id] ?? {},
        config,
        { termGrade: computedByStudent[student.id]?.term_grade }
      );
      if (status !== "empty") graded += 1;
    }
    return { graded, total: students.length };
  }, [students, studentScores, config, computedByStudent]);

  const loadTermData = useCallback(
    async (termSheetId) => {
      if (!termSheetId) return;
      suppressDirtyRef.current = true;
      const result = await loadEcrTermSheet(termSheetId);
      if (result.error) {
        setError(result.error.message || "Unable to load term sheet.");
        return;
      }
      setConfig(result.data.config ?? []);
      const scoreMap = scoresByStudentFromRows(result.data.scores ?? []);
      setStudentScores((prev) => {
        const next = { ...prev };
        for (const student of students) {
          next[student.id] = scoreMap[student.id] ?? next[student.id] ?? {};
        }
        return next;
      });
      const computedMap = {};
      for (const row of result.data.computed ?? []) {
        if (!row?.student_id) continue;
        computedMap[row.student_id] = {
          term_grade: parseRecordedGrade(row.term_grade),
          description: termGradeDescription(row.term_grade),
          initial_grade: row.initial_grade ?? null,
          ww_total: row.ww_total ?? null,
          ww_ps: row.ww_ps ?? null,
          ww_ws: row.ww_ws ?? null,
          pt_total: row.pt_total ?? null,
          pt_ps: row.pt_ps ?? null,
          pt_ws: row.pt_ws ?? null,
          qa_total: row.qa_total ?? null,
          qa_ps: row.qa_ps ?? null,
          qa_ws: row.qa_ws ?? null,
        };
      }
      setImportedComputed(computedMap);
      setDirty(false);
      setTimeout(() => {
        suppressDirtyRef.current = false;
      }, 50);
    },
    [students]
  );

  const loadSummary = useCallback(async () => {
    if (!workbook?.id) return;
    const result = await loadEcrWorkbookSummary(workbook.id);
    if (result.error) {
      setError(result.error.message || "Unable to load summary.");
      return;
    }

    const byStudent = {};
    for (const block of result.data.termData ?? []) {
      for (const row of block.computed) {
        const entry = byStudent[row.student_id] ?? { 1: null, 2: null, 3: null };
        entry[block.term] = row.term_grade;
        byStudent[row.student_id] = entry;
      }
    }

    const rows = students.map((student) => {
      const terms = byStudent[student.id] ?? { 1: null, 2: null, 3: null };
      const live = computedByStudent[student.id];
      if (activeTerm && live?.term_grade != null) {
        terms[activeTerm] = live.term_grade;
      }
      const finalGrade = computeFinalFromTerms([terms[1], terms[2], terms[3]]);
      return {
        studentId: student.id,
        name: formatSf2LearnerName(student),
        sex: student.sex ?? student.gender,
        terms,
        finalGrade,
      };
    });
    setSummaryRows(rows);
  }, [workbook?.id, students, computedByStudent, activeTerm]);

  const refresh = useCallback(async () => {
    if (!classId) return;
    beginLoad();
    setError("");
    suppressDirtyRef.current = true;

    try {
      const session = await getCurrentTeacherSession();
      if (session.error || !session.data?.teacherId) {
        setError(session.error?.message ?? "Unable to load teacher session.");
        endLoad(false);
        return;
      }

      const [classResult, enrollResult, classesResult] = await Promise.all([
        getClassById(classId),
        getClassStudents(classId),
        getTeacherClasses(session.data.teacherId),
      ]);

      if (classResult.error || !classResult.data) {
        setError(classResult.error?.message ?? "Class not found.");
        endLoad(false);
        return;
      }

      const teacher = unwrapRelation(classResult.data.teachers);
      const teacherName = formatStudentName(teacher) || session.data?.profile?.full_name || "Teacher";

      const mappedClass = {
        id: classResult.data.id,
        subject: classResult.data.subjects?.subject_name ?? "Subject",
        subjectId: classResult.data.subject_id,
        section: classResult.data.sections?.section_name ?? "",
        gradeLevel: classResult.data.sections?.grade_level ?? "",
        schoolYear: classResult.data.school_year,
        teacherId: classResult.data.teacher_id,
        teacherName,
        quarter: classResult.data.quarter,
      };

      const roster = (enrollResult.data ?? [])
        .map(mapEnrollmentToStudent)
        .sort(compareLearnersBySurname);

      const siblingMap = buildSiblingClassMap(
        mappedClass,
        classesResult.data ?? []
      );

      const wb = await getOrCreateEcrWorkbook({
        classId,
        schoolYear: mappedClass.schoolYear,
        teacherId: session.data.teacherId,
        subjectName: mappedClass.subject,
      });

      if (wb.error || !wb.data) {
        setError(wb.error?.message ?? "Unable to load this E-Record.");
        endLoad(false);
        return;
      }

      setClassItem(mappedClass);
      setStudents(roster);
      setWorkbook(wb.data);
      setSiblingClassMap(siblingMap);

      const termSheet = (wb.data.ecr_term_sheets ?? []).find(
        (s) => Number(s.term) === Number(activeTerm)
      );
      if (termSheet?.id) {
        const sheetResult = await loadEcrTermSheet(termSheet.id);
        if (!sheetResult.error && sheetResult.data) {
          setConfig(sheetResult.data.config ?? []);
          const scoreMap = scoresByStudentFromRows(sheetResult.data.scores ?? []);
          const nextScores = {};
          for (const student of roster) {
            nextScores[student.id] = scoreMap[student.id] ?? {};
          }
          setStudentScores(nextScores);
          const computedMap = {};
          for (const row of sheetResult.data.computed ?? []) {
            if (!row?.student_id) continue;
            computedMap[row.student_id] = {
              term_grade: parseRecordedGrade(row.term_grade),
              description: termGradeDescription(row.term_grade),
              initial_grade: row.initial_grade ?? null,
              ww_total: row.ww_total ?? null,
              ww_ps: row.ww_ps ?? null,
              ww_ws: row.ww_ws ?? null,
              pt_total: row.pt_total ?? null,
              pt_ps: row.pt_ps ?? null,
              pt_ws: row.pt_ws ?? null,
              qa_total: row.qa_total ?? null,
              qa_ps: row.qa_ps ?? null,
              qa_ws: row.qa_ws ?? null,
            };
          }
          setImportedComputed(computedMap);
        }
      } else {
        setImportedComputed({});
      }

      setDirty(false);
      setTimeout(() => {
        suppressDirtyRef.current = false;
      }, 50);
      endLoad(true);
    } catch (err) {
      setError(err?.message ?? "Unable to load E-Record.");
      endLoad(false);
    }
  }, [classId, beginLoad, endLoad, activeTerm]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per class
  }, [classId]);

  useEffect(() => {
    if (!activeTermSheet?.id || loading) return;
    loadTermData(activeTermSheet.id);
  }, [activeTermSheet?.id, loading, loadTermData]);

  useEffect(() => {
    if (activeTerm === "summary") {
      loadSummary();
    }
  }, [activeTerm, loadSummary]);

  const setScore = useCallback((studentId, key, value) => {
    if (!suppressDirtyRef.current) setDirty(true);
    setStudentScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [key]: value,
      },
    }));
  }, []);

  const updateConfig = useCallback((configId, patch) => {
    if (!suppressDirtyRef.current) setDirty(true);
    setConfig((prev) => {
      const target = prev.find((row) => row.id === configId);
      if (!target) return prev;
      if (patch.component_weight !== undefined) {
        return prev.map((row) =>
          row.component === target.component
            ? { ...row, component_weight: patch.component_weight }
            : row
        );
      }
      return prev.map((row) =>
        row.id === configId ? { ...row, ...patch } : row
      );
    });
  }, []);

  const saveDraft = useCallback(async () => {
    if (!activeTermSheet?.id || !classItem) return { ok: false };
    setError("");
    const result = await saveEcrTermSheet({
      termSheetId: activeTermSheet.id,
      config,
      studentScores,
      publish: false,
      classMeta: {
        workbookId: workbook?.id,
        classId: classItem.id,
        subjectId: classItem.subjectId,
        schoolYear: classItem.schoolYear,
        term: activeTerm,
      },
    });
    if (result.error) {
      setError(result.error.message || "Unable to save draft.");
      return { ok: false };
    }
    setDirty(false);
    setLastSavedAt(new Date());
    return { ok: true };
  }, [activeTermSheet, classItem, config, studentScores, workbook, activeTerm]);

  useEffect(() => {
    if (!dirty || loading || activeTerm === "summary" || suppressDirtyRef.current) {
      return undefined;
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaving(true);
      const result = await saveDraft();
      if (!result.ok) setDirty(true);
      setAutoSaving(false);
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dirty, studentScores, config, loading, activeTerm, saveDraft]);

  const publishGrades = useCallback(async () => {
    if (!activeTermSheet?.id || !classItem) return { ok: false };
    setError("");
    const result = await saveEcrTermSheet({
      termSheetId: activeTermSheet.id,
      config,
      studentScores,
      publish: true,
      classMeta: {
        workbookId: workbook?.id,
        classId: classItem.id,
        subjectId: classItem.subjectId,
        schoolYear: classItem.schoolYear,
        term: activeTerm,
      },
    });
    if (result.error) {
      setError(result.error.message || "Unable to publish grades.");
      return { ok: false };
    }
    setDirty(false);
    setLastSavedAt(new Date());
    return { ok: true };
  }, [activeTermSheet, classItem, config, studentScores, workbook, activeTerm]);

  const loadAllTermDataForExport = useCallback(async () => {
    if (!workbook?.ecr_term_sheets?.length) return {};

    const termData = {};
    await Promise.all(
      (workbook.ecr_term_sheets ?? []).map(async (sheet) => {
        const term = Number(sheet.term);
        if (!Number.isFinite(term) || term < 1 || term > 3) return;
        const result = await loadEcrTermSheet(sheet.id);
        if (result.error) return;
        const sheetConfig = result.data.config ?? [];
        const scores = scoresByStudentFromRows(result.data.scores ?? []);
        const computed = {};
        for (const student of students) {
          computed[student.id] = computeLearnerRow(
            scores[student.id] ?? {},
            sheetConfig
          );
        }
        termData[term] = {
          config: sheetConfig,
          studentScores: scores,
          computedByStudent: computed,
        };
      })
    );
    return termData;
  }, [workbook, students]);

  const publishAve = useCallback(async () => {
    if (!workbook?.id || !classItem) return { ok: false };
    const studentTermGrades = {};
    for (const row of summaryRows) {
      studentTermGrades[row.studentId] = row.terms;
    }
    const result = await syncEcrAveToGrades({
      workbookId: workbook.id,
      classId: classItem.id,
      subjectId: classItem.subjectId,
      schoolYear: classItem.schoolYear,
      studentTermGrades,
      siblingClassMap,
    });
    if (result.error) {
      setError(result.error.message || "Unable to publish final grades.");
      return { ok: false };
    }
    return { ok: true };
  }, [workbook, classItem, summaryRows, siblingClassMap]);

  return {
    loading,
    refreshing,
    error,
    classItem,
    students,
    workbook,
    activeTerm,
    setActiveTerm,
    config,
    studentScores,
    computedByStudent,
    summaryRows,
    gradedProgress,
    dirty,
    autoSaving,
    lastSavedAt,
    setScore,
    updateConfig,
    saveDraft,
    publishGrades,
    publishAve,
    loadAllTermDataForExport,
    refresh,
  };
}
