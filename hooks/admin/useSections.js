"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveSection,
  createSection,
  getAdminSession,
  listSchoolYears,
  listSections,
  listTeachersForAdviser,
  restoreSection,
  updateSection,
} from "@/lib/supabase/queries/sections";
import {
  buildSectionSummary,
  mapSectionRow,
  suggestCurrentSchoolYear,
} from "@/lib/admin/sectionMappers";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useSectionManagement() {
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);
  const [filters, setFilters] = useState({
    search: "",
    schoolYear: "All School Years",
    grade: "All Grades",
    status: "All Status",
  });

  const refresh = useCallback(async () => {
    beginLoad();
    setError("");

    const session = await getAdminSession();
    if (session.error || !session.data) {
      setError(session.error?.message ?? "Admin access required.");
      setProfile(null);
      setSections([]);
      endLoad(false);
      return;
    }

    setProfile(session.data);

    const [sectionsResult, teachersResult, yearsResult] = await Promise.all([
      listSections(),
      listTeachersForAdviser(),
      listSchoolYears(),
    ]);

    if (sectionsResult.error) {
      setError(sectionsResult.error.message);
      endLoad(false);
      return;
    }
    if (teachersResult.error) {
      setError(teachersResult.error.message);
      endLoad(false);
      return;
    }

    const mapped = (sectionsResult.data ?? []).map(mapSectionRow);
    setSections(mapped);
    setTeachers(teachersResult.data ?? []);

    const years = yearsResult.data ?? [];
    const current = suggestCurrentSchoolYear();
    setSchoolYears(
      [...new Set([current, ...years])].sort((a, b) => b.localeCompare(a))
    );
    endLoad(true);
  }, [beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return sections.filter((section) => {
      const matchesSearch =
        !query ||
        section.sectionName.toLowerCase().includes(query) ||
        section.gradeLabel.toLowerCase().includes(query) ||
        section.schoolYear.toLowerCase().includes(query) ||
        section.adviserName.toLowerCase().includes(query);

      const matchesYear =
        filters.schoolYear === "All School Years" ||
        section.schoolYear === filters.schoolYear;
      const matchesGrade =
        filters.grade === "All Grades" ||
        section.gradeLabel === filters.grade;
      const matchesStatus =
        filters.status === "All Status" ||
        section.status === filters.status;

      return matchesSearch && matchesYear && matchesGrade && matchesStatus;
    });
  }, [sections, filters]);

  const summary = useMemo(() => buildSectionSummary(sections), [sections]);

  async function handleCreate(payload) {
    setSaving(true);
    setError("");
    const result = await createSection(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
  }

  async function handleUpdate(sectionId, payload) {
    setSaving(true);
    setError("");
    const result = await updateSection(sectionId, payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
  }

  async function handleArchive(sectionId) {
    setSaving(true);
    setError("");
    const result = await archiveSection(sectionId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
  }

  async function handleRestore(sectionId) {
    setSaving(true);
    setError("");
    const result = await restoreSection(sectionId);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return { ok: false, error: result.error.message };
    }
    await refresh();
    return { ok: true };
  }

  return {
    sections: filtered,
    allSections: sections,
    teachers,
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
    handleArchive,
    handleRestore,
  };
}
