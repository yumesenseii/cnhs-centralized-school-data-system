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
  updateClassAssignment,
} from "@/lib/supabase/queries/classAssignments";
import {
  buildAssignmentSummary,
  mapClassAssignment,
} from "@/lib/admin/classAssignmentMappers";
import { suggestCurrentSchoolYear } from "@/lib/admin/sectionMappers";
import { TERM_ALL_LABEL } from "@/lib/academic/termLabels";

export function useClassAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    schoolYear: "All School Years",
    grade: "All Grades",
    quarter: TERM_ALL_LABEL,
    teacherId: "All Teachers",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    const session = await getAdminSession();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Admin access required.");
      setProfile(null);
      setAssignments([]);
      setLoading(false);
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
      setLoading(false);
      return;
    }
    if (teachersResult.error) {
      setError(teachersResult.error.message);
      setLoading(false);
      return;
    }
    if (subjectsResult.error) {
      setError(subjectsResult.error.message);
      setLoading(false);
      return;
    }
    if (sectionsResult.error) {
      setError(sectionsResult.error.message);
      setLoading(false);
      return;
    }

    setAssignments((assignmentsResult.data ?? []).map(mapClassAssignment));
    setTeachers(teachersResult.data ?? []);
    setSubjects(subjectsResult.data ?? []);
    setSections(sectionsResult.data ?? []);
    setLoading(false);
  }, []);

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

  async function handleCreate(payload) {
    setSaving(true);
    setError("");

    if (payload?.allQuarters) {
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
          if (/already assigned/i.test(message)) {
            skipped += 1;
          } else {
            errors.push(`Term ${q}: ${message}`);
          }
        } else {
          created += 1;
        }
      }

      setSaving(false);
      if (created === 0 && errors.length) {
        setError(errors.join(" "));
        return { ok: false, error: errors.join(" ") };
      }
      await refresh();
      return {
        ok: true,
        message: `Created ${created} term assignment(s)${
          skipped ? `, skipped ${skipped} existing` : ""
        }.`,
      };
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
    const result = await updateClassAssignment(classId, payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
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
    saving,
    error,
    filters,
    setFilters,
    refresh,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}
