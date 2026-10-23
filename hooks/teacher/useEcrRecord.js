"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeFinalFromTerms } from "@/lib/ecr/computeGrades";
import { parseValidGrade } from "@/lib/ecr/gradeIntegrity";
import { compareLearnersBySurname } from "@/lib/ecr/gridLayout";
import { getEcrTemplateForSubject } from "@/lib/ecr/constants";
import { buildEcrTermView } from "@/lib/ecr/recordData";
import { getOrCreateEcrWorkbook, loadEcrClassFamily, loadEcrTermSheet, saveEcrTermSheet, syncEcrAveToGrades } from "@/lib/supabase/queries/ecr";
import { getClassStudents, getClassById, getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { formatStudentName, mapEnrollmentToStudent } from "@/lib/teacher/myClassesMappers";
import { formatSf2LearnerName } from "@/lib/attendance/sf2Daily";
import { parseTermNumber } from "@/lib/academic/termLabels";
import { resolveTermSheetAccess } from "@/lib/academic/academicTermPolicy";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

const one = (value) => Array.isArray(value) ? value[0] : value;
const scoreRows = (scores = {}) => Object.entries(scores).flatMap(([student_id, row]) => Object.entries(row).map(([key, raw_score]) => {
  const [component, item_index] = key.split(":");
  return { student_id, component, item_index: Number(item_index), raw_score };
}));

function termView(family, term, students, subject, draft) {
  const block = family?.termData?.[term];
  return buildEcrTermView({ students,
    config: draft?.config || block?.config || getEcrTemplateForSubject(subject).map((row) => ({ ...row, id: `new:${row.component}:${row.item_index}` })),
    scoreRows: draft ? scoreRows(draft.scores) : block?.scores || [], computedRows: block?.computed || [],
    officialGrades: (family?.officialGrades || []).filter((row) => Number(row.quarter) === Number(term)),
    status: block?.termSheet.status || "draft",
    useLiveCalculation: (studentId) => Boolean(draft?.dirty && (draft.configChanged || draft.changedStudents?.includes(studentId))),
  });
}

export function useEcrRecord(classId) {
  const [error, setError] = useState("");
  const [classItem, setClassItem] = useState(null);
  const [family, setFamily] = useState(null);
  const [rosters, setRosters] = useState({});
  const [activeTerm, changeTerm] = useState(1);
  const [drafts, setDrafts] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const loadVersion = useRef(0);
  const initializedClass = useRef(null);
  const writeInFlight = useRef(null);
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const refresh = useCallback(async () => {
    if (!classId) return;
    const request = ++loadVersion.current;
    beginLoad();
    setError("");
    try {
      const session = await getCurrentTeacherSession();
      if (session.error || !session.data?.teacherId) throw session.error || new Error("Teacher session required.");
      const [classResult, sourceResult] = await Promise.all([
        getClassById(classId, { teacherId: session.data.teacherId }),
        loadEcrClassFamily({ classId, teacherId: session.data.teacherId }),
      ]);
      if (classResult.error || sourceResult.error || !classResult.data) throw classResult.error || sourceResult.error || new Error("Class not found.");
      const row = classResult.data;
      const source = sourceResult.data;
      const rosterResults = await Promise.all(source.classes.map(async (assigned) => {
        const result = await getClassStudents(assigned.id, { teacherId: session.data.teacherId });
        if (result.error) throw result.error;
        return [assigned.id, (result.data || []).map(mapEnrollmentToStudent).sort(compareLearnersBySurname)];
      }));
      if (request !== loadVersion.current) return;
      const subjects = one(row.subjects);
      const section = one(row.sections);
      setClassItem({ id: row.id, subject: subjects?.subject_name || "Subject", subjectId: row.subject_id,
        sectionId: row.section_id, section: section?.section_name || "", gradeLevel: section?.grade_level || "",
        schoolYear: row.school_year, teacherId: row.teacher_id,
        teacherName: formatStudentName(one(row.teachers)) || session.data.profile?.full_name || "Teacher", quarter: row.quarter });
      setFamily(source);
      setRosters(Object.fromEntries(rosterResults));
      if (initializedClass.current !== classId) {
        initializedClass.current = classId;
        setDrafts({});
        const term = parseTermNumber(row.quarter);
        changeTerm(term >= 1 && term <= 3 ? term : 1);
      }
      endLoad(true);
    } catch (failure) {
      if (request === loadVersion.current) { setError(failure.message || "Unable to load E-Record."); endLoad(false); }
    }
  }, [classId, beginLoad, endLoad]);

  useEffect(() => {
    refresh();
    const version = loadVersion;
    return () => { version.current++; };
  }, [refresh]);
  const allStudents = useMemo(() => [...new Map(Object.values(rosters).flat().map((student) => [student.id, student])).values()].sort(compareLearnersBySurname), [rosters]);
  const students = useMemo(() => activeTerm === "summary" ? allStudents : rosters[family?.classMap?.[activeTerm]] || rosters[classId] || [], [activeTerm, allStudents, rosters, family, classId]);
  const draft = drafts[activeTerm];
  const view = useMemo(() => termView(family, activeTerm, students, classItem?.subject, draft), [family, activeTerm, students, classItem?.subject, draft]);
  const activeTermSheet = family?.termSheets.find((sheet) => Number(sheet.term) === Number(activeTerm));
  const termAccessMap = useMemo(() => Object.fromEntries([1, 2, 3].map((term) => {
    const sheet = family?.termSheets.find((item) => Number(item.term) === term);
    const access = resolveTermSheetAccess({ term, sheetStatus: sheet?.status || "draft" });
    if (sheet?.readConflict) return [term, { ...access, editable: false, allowed: false, requiresCorrectionConfirmation: false,
      message: "This term has competing saved records. They have been preserved; resolve the source conflict before editing." }];
    if (!family?.classMap?.[term]) return [term, { ...access, editable: false, allowed: false, requiresCorrectionConfirmation: false,
      message: "This term does not have a unique assigned class. Existing records are view-only." }];
    return [term, access];
  })), [family]);
  const termAccess = activeTerm === "summary" ? null : termAccessMap[activeTerm];
  const dirty = Boolean(draft?.dirty);

  const editDraft = useCallback((transform) => {
    if (!termAccess?.editable || loading || activeTerm === "summary") return;
    setDrafts((previous) => {
      const current = previous[activeTerm] || { config: view.config, scores: view.studentScores, revision: 0 };
      return { ...previous, [activeTerm]: { ...transform(current), dirty: true, revision: current.revision + 1 } };
    });
  }, [activeTerm, termAccess, loading, view]);
  const setScore = useCallback((studentId, key, value) => editDraft((current) => ({ ...current,
    changedStudents: [...new Set([...(current.changedStudents || []), studentId])],
    scores: { ...current.scores, [studentId]: { ...(current.scores[studentId] || {}), [key]: value } },
  })), [editDraft]);
  const updateConfig = useCallback((configId, patch) => editDraft((current) => {
    const target = current.config.find((row) => row.id === configId);
    return { ...current, configChanged: true, config: current.config.map((row) => (patch.component_weight !== undefined ? row.component === target?.component : row.id === configId) ? { ...row, ...patch } : row) };
  }), [editDraft]);

  const save = useCallback(async (publish = false) => {
    if (activeTerm === "summary" || !classItem || !family) return { ok: false, error: "Choose an academic term first." };
    if (!termAccess?.allowed || (!publish && !termAccess.editable)) return { ok: false, error: termAccess?.message || "This term is read-only." };
    if (writeInFlight.current) return { ok: false, error: "A save is in progress. Please wait." };
    const term = Number(activeTerm);
    const revision = draft?.revision;
    const operation = (async () => {
      try {
        setError("");
        let sheet = activeTermSheet;
        let config = view.config;
        if (!sheet) {
          // Bootstrap only after an explicit save/encoding action, never merely to display final grades.
          const created = await getOrCreateEcrWorkbook({ classId: family.classMap[term], schoolYear: classItem.schoolYear,
            teacherId: classItem.teacherId, subjectName: classItem.subject });
          if (created.error) throw created.error;
          sheet = created.data.ecr_term_sheets.find((entry) => Number(entry.term) === term);
          const loaded = await loadEcrTermSheet(sheet.id);
          if (loaded.error) throw loaded.error;
          config = view.config.map((entry) => ({ ...entry, id: loaded.data.config.find((row) => row.component === entry.component && row.item_index === entry.item_index)?.id }));
        }
        const result = await saveEcrTermSheet({ termSheetId: sheet.id, config, studentScores: view.studentScores,
          publish, siblingClassMap: family.classMap,
          classMeta: { subjectId: classItem.subjectId, schoolYear: classItem.schoolYear, term } });
        if (result.error) throw result.error;
        await refresh();
        setDrafts((previous) => {
          if (previous[term]?.revision !== revision) return previous;
          const next = { ...previous }; delete next[term]; return next;
        });
        setLastSavedAt(new Date());
        return { ok: true };
      } catch (failure) { setError(failure.message); return { ok: false, error: failure.message }; }
    })();
    writeInFlight.current = operation;
    try { return await operation; } finally { writeInFlight.current = null; }
  }, [activeTerm, classItem, family, termAccess, draft, activeTermSheet, view, refresh]);
  const saveDraft = useCallback(() => save(false), [save]);
  const publishGrades = useCallback(() => save(true), [save]);
  useEffect(() => {
    if (!dirty || loading || activeTerm === "summary" || !termAccess?.editable) return;
    const timer = setTimeout(async () => { setAutoSaving(true); await saveDraft(); setAutoSaving(false); }, 2000);
    return () => clearTimeout(timer);
  }, [dirty, loading, activeTerm, termAccess, saveDraft]);

  const summaryRows = useMemo(() => allStudents.map((student) => {
    const terms = {};
    for (const term of [1, 2, 3]) terms[term] = termView(family, term, [student], classItem?.subject, drafts[term]).computedByStudent[student.id]?.term_grade ?? null;
    const finals = (family?.officialGrades || []).filter((row) => row.student_id === student.id && Number(row.quarter) === 4).map((row) => parseValidGrade(row.final_grade)).filter((grade) => grade !== null);
    const finalGrade = finals.length && new Set(finals).size === 1 ? finals[0] : [1, 2, 3].every((term) => terms[term] !== null) ? computeFinalFromTerms([terms[1], terms[2], terms[3]]) : null;
    return { studentId: student.id, name: formatSf2LearnerName(student), sex: student.sex ?? student.gender, terms, finalGrade };
  }), [family, allStudents, classItem?.subject, drafts]);

  const loadAllTermDataForExport = useCallback(async () => {
    if (!classItem) throw new Error("Class details are not available.");
    const result = await loadEcrClassFamily({ classId, teacherId: classItem.teacherId });
    if (result.error) throw result.error;
    const fresh = result.data;
    return Object.fromEntries([1, 2, 3, 4].map((term) => [term, {
      ...termView(fresh, term, allStudents, classItem.subject),
      officialGrades: fresh.officialGrades.filter((row) => Number(row.quarter) === term),
      sourceBlocks: fresh.blocks.filter((block) => Number(block.termSheet.term) === term),
      status: fresh.termData[term]?.termSheet.status || "No ECR sheet",
    }]));
  }, [classId, classItem, allStudents]);
  const publishAve = useCallback(async () => {
    const book = family?.workbooks[0];
    if (!book || !classItem) return { ok: false, error: "All three term sheets must be published before publishing the final grade." };
    if (family.termSheets.some((sheet) => sheet.readConflict)) return { ok: false, error: "Resolve competing term records before publishing the final grade." };
    const result = await syncEcrAveToGrades({ workbookId: book.id, subjectId: classItem.subjectId, schoolYear: classItem.schoolYear,
      siblingClassMap: family.classMap, termSheetIdsByTerm: Object.fromEntries(family.termSheets.map((sheet) => [sheet.term, sheet.id])) });
    if (result.error) { setError(result.error.message); return { ok: false, error: result.error.message }; }
    await refresh(); return { ok: true };
  }, [family, classItem, refresh]);

  return { loading, refreshing, error, classItem, students, exportStudents: allStudents, workbook: family?.workbooks[0],
    activeTerm, setActiveTerm: changeTerm, config: view.config, studentScores: view.studentScores,
    computedByStudent: view.computedByStudent, gradedProgress: view.availability, sourceWarnings: family?.warnings || [],
    summaryRows, dirty, autoSaving, lastSavedAt, setScore, updateConfig, saveDraft, publishGrades, publishAve,
    loadAllTermDataForExport, refresh, termAccessMap, termAccess };
}
