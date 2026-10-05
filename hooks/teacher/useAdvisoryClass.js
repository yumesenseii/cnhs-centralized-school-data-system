"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getTeacherAdvisorySection,
  getAdvisorySectionOverview,
} from "@/lib/supabase/queries/advisoryClass";
import { getActiveSchoolYear } from "@/lib/academic/activeSchoolYear";

export function useAdvisoryClass(schoolYear = null) {
  const effectiveSchoolYear = schoolYear || getActiveSchoolYear();
  const [data, setData] = useState({
    hasAdvisory: false,
    section: null,
    subjectPublishStatus: [],
    publishedSubjectsCount: 0,
    totalSubjectsCount: 8,
    learners: [],
    attendanceMonths: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const advCheck = await getTeacherAdvisorySection(effectiveSchoolYear);
      if (advCheck.error) {
        setError(advCheck.error.message);
        setLoading(false);
        return;
      }

      if (!advCheck.data?.hasAdvisory) {
        setData({
          hasAdvisory: false,
          section: null,
          subjectPublishStatus: [],
          publishedSubjectsCount: 0,
          totalSubjectsCount: 8,
          learners: [],
          attendanceMonths: [],
        });
        setLoading(false);
        return;
      }

      const overviewResult = await getAdvisorySectionOverview(
        advCheck.data.section.id,
        effectiveSchoolYear
      );

      if (overviewResult.error) {
        setError(overviewResult.error.message);
      } else if (overviewResult.data) {
        setData({
          hasAdvisory: true,
          ...overviewResult.data,
        });
      }
    } catch (err) {
      setError(err?.message || "Failed to load advisory class.");
    } finally {
      setLoading(false);
    }
  }, [effectiveSchoolYear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...data,
    loading,
    error,
    refresh,
  };
}
