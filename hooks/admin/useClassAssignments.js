"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createClassAssignment,
  deleteClassAssignment,
  getAdminSession,
  listAssignmentSections,
  listAssignmentSubjects,
  listAssignmentTeachers,
  listClassAssignments,
  syncAllTermAssignmentRosters,
  updateClassAssignment,
} from "@/lib/supabase/queries/classAssignments";
import { invalidateAdminRosterCache } from "@/lib/admin/adminRosterCache";
import { clearAllImportedGrades, clearGradesForClass } from "@/lib/supabase/queries/classGrades";
import {
  buildAssignmentSummary,
  mapClassAssignment,
} from "@/lib/admin/classAssignmentMappers";
import { suggestCurrentSchoolYear } from "@/lib/admin/sectionMappers";
import { ASSIGNMENT_BLOCKED_CODE } from "@/lib/admin/assignmentEditGuard";
import { TERM_ALL_LABEL } from "@/lib/academic/termLabels";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useClassAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);
  const [filters, setFilters] = useState({
    search: "",
    schoolYear: "All School Years",
    grade: "All Grades",
    quarter: TERM_ALL_LABEL,
    teacherId: "All Teachers",
  });

  const refresh = useCallback(async () => {
    beginLoad();
    setError("");

    const session = await getAdminSession();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Admin access required.");
      setProfile(null);
      setAssignments([]);
      endLoad(false);
      return;
    }

    setProfile(session.data);

    const [assignmentsResult, teachersResult, subjectsResult, sectionsResult] =
      await Promise.all([
        listClassAssignments(),
        listAssignmentTeachers(),
        listAssignmentSubjects(),
        listAssignmentSections({ activeOnly: false }),
      ]);

    if (assignmentsResult.error) {
      setError(assignmentsResult.error.message);
      endLoad(false);
      return;
    }
    if (teachersResult.error) {
      setError(teachersResult.error.message);
      endLoad(false);
      return;
    }
    if (subjectsResult.error) {
      setError(subjectsResult.error.message);
      endLoad(false);
      return;
    }
    if (sectionsResult.error) {
      setError(sectionsResult.error.message);
      endLoad(false);
      return;
    }

    setAssignments((assignmentsResult.data ?? []).map(mapClassAssignment));
    setTeachers(teachersResult.data ?? []);
    setSubjects(subjectsResult.data ?? []);
    setSections(sectionsResult.data ?? []);
    endLoad(true);
  }, [beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const schoolYears = useMemo(() => {
    const fromAssignments = assignments.map((item) => item.schoolYear);
    const fromSections = sections.map((item) => item.school_year);
    const current = suggestCurrentSchoolYear();
    return [...new Set([current, ...fromAssignments, ...fromSections].filter(Boolean))].sort(
      (a, b) => b.localeCompare(a)
    );
  }, [assignments, sections]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return assignments.filter((item) => {
      const matchesSearch =
        !query ||
        item.teacherName.toLowerCase().includes(query) ||
        item.subjectName.toLowerCase().includes(query) ||
        item.sectionName.toLowerCase().includes(query) ||
        item.gradeLabel.toLowerCase().includes(query) ||
        item.schoolYear.toLowerCase().includes(query);

      const matchesYear =
        filters.schoolYear === "All School Years" ||
        item.schoolYear === filters.schoolYear;
      const matchesGrade =
        filters.grade === "All Grades" || item.gradeLabel === filters.grade;
      const matchesQuarter =
        filters.quarter === TERM_ALL_LABEL ||
        item.quarterLabel === filters.quarter;
      const matchesTeacher =
        filters.teacherId === "All Teachers" ||
        item.teacherId === filters.teacherId;

      return (
        matchesSearch &&
        matchesYear &&
        matchesGrade &&
        matchesQuarter &&
        matchesTeacher
      );
    });
  }, [assignments, filters]);

  const summary = useMemo(
    () => buildAssignmentSummary(assignments),
    [assignments]
  );

  async function createMissingTermAssignments(payload) {
    const base = { ...payload };
    delete base.allQuarters;
    delete base.quarter;

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const q of [1, 2, 3, 4]) {
      const result = await createClassAssignment({ ...base, quarter: q });
      if (result.error) {
        const message = result.error.message || "Unable to save assignment.";
        if (/already (assigned|exists)/i.test(message)) {
          skipped += 1;
        } else {
          errors.push(`Term ${q}: ${message}`);
        }
      } else {
        created += 1;
      }
    }

    if (created === 0) {
      if (errors.length) {
        return { ok: false, error: errors.join(" ") };
      }
      if (skipped > 0) {
        return { ok: false, error: "Class assignment already exists." };
      }
    }

    const synced = await syncAllTermAssignmentRosters({
      teacher_id: base.teacher_id,
      subject_id: base.subject_id,
      section_id: base.section_id,
      school_year: base.school_year,
    });
    invalidateAdminRosterCache();

    const syncNote =
      synced.error
        ? ""
        : synced.copied
          ? ` Copied ${synced.copied} enrollment(s) onto empty term classes.`
          : "";

    return {
      ok: true,
      message: `Created ${created} term assignment(s)${
        skipped ? `, skipped ${skipped} existing` : ""
      }.${syncNote}`,
    };
  }

  async function handleCreate(payload) {
    setSaving(true);
    setError("");

    if (payload?.allQuarters) {
      const result = await createMissingTermAssignments(payload);
      setSaving(false);
      if (!result.ok) {
        setError(result.error);
        return result;
      }
      await refresh();
      return result;
    }

    const result = await createClassAssignment(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
  }

  async function handleUpdate(classId, payload) {
    setSaving(true);
    setError("");

    const result = await updateClassAssignment(classId, payload, {
      reassignAllTerms: Boolean(payload?.allQuarters || payload?.reassignAllTerms),
    });
    setSaving(false);
    if (result.error) {
      // Blocked-by-rule edits surface through the dedicated error modal,
      // not the page banner.
      if (result.error?.code !== ASSIGNMENT_BLOCKED_CODE) {
        setError(result.error.message);
      }
      return {
        ok: false,
        error: result.error.message,
        code: result.error?.code,
        details: result.error?.details ?? [],
      };
    }
    await refresh();
    return { ok: true, message: result.message };
  }

  async function handleDelete(classId) {
    setSaving(true);
    setError("");
    const result = await deleteClassAssignment(classId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
  }

  async function handleClearGrades(classId) {
    setSaving(true);
    setError("");
    const result = await clearGradesForClass(classId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    invalidateAdminRosterCache();
    await refresh();
    return {
      ok: true,
      gradesDeleted: result.data?.gradesDeleted ?? 0,
      enrollmentsDeleted: result.data?.enrollmentsDeleted ?? 0,
    };
  }

  async function handleClearAllGrades(schoolYear) {
    setSaving(true);
    setError("");
    const year =
      !schoolYear || schoolYear === "All School Years" ? null : schoolYear;
    const result = await clearAllImportedGrades({ schoolYear: year });
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    invalidateAdminRosterCache();
    await refresh();
    return {
      ok: true,
      gradesDeleted: result.data?.gradesDeleted ?? 0,
      enrollmentsDeleted: result.data?.enrollmentsDeleted ?? 0,
      classCount: result.data?.classCount ?? 0,
    };
  }

  return {
    assignments: filtered,
    allAssignments: assignments,
    teachers,
    subjects,
    sections,
    schoolYears,
    summary,
    profile,
    loading,
    refreshing,
    saving,
    error,
    filters,
    setFilters,
    refresh,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleClearGrades,
    handleClearAllGrades,
  };
}
