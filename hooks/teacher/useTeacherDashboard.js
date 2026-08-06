"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { syncRecommendationNotifications } from "@/lib/notifications/syncRecommendationNotifications";
import {
  getTeacherReportsBundle,
  resolveTeacherReportsSession,
} from "@/lib/supabase/queries/reports";
import { invalidateTeacherRosterCache } from "@/lib/teacher/teacherRosterCache";
import { buildTeacherDashboardModel } from "@/lib/teacher/dashboardMappers";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useTeacherDashboard() {
  const [bundle, setBundle] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [teacherId, setTeacherId] = useState(null);
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("1");
  const [data, setData] = useState(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const refresh = useCallback(
    async ({ bustCache = false } = {}) => {
      beginLoad();
      setError("");

      if (bustCache) invalidateTeacherRosterCache();

      try {
        const session = await resolveTeacherReportsSession();
        if (session.error || !session.data?.teacherId) {
          setError(session.error?.message ?? "Unable to load teacher session.");
          setBundle(null);
          endLoad(false);
          return;
        }

        const result = await getTeacherReportsBundle({
          teacherId: session.data.teacherId,
        });
        if (result.error) {
          setError(result.error.message || "Unable to load dashboard data.");
          setBundle(null);
          endLoad(false);
          return;
        }

        setProfileId(session.data.profile?.id ?? null);
        setTeacherId(session.data.teacherId);

        const nextBundle = result.data;
        const classes = nextBundle.allClasses ?? nextBundle.classes ?? [];
        const years = [
          ...new Set(classes.map((row) => row.school_year).filter(Boolean)),
        ].sort((a, b) => b.localeCompare(a));
        const initialYear = years[0] ?? "";
        const firstQuarter = classes
          .filter((row) => !initialYear || row.school_year === initialYear)
          .map((row) => Number(row.quarter))
          .filter(Number.isFinite)
          .sort((a, b) => a - b)[0];

        setBundle(nextBundle);
        setSchoolYear((current) =>
          current && years.includes(current) ? current : initialYear
        );
        setQuarter((current) =>
          classes.some(
            (row) =>
              (!initialYear || row.school_year === initialYear) &&
              Number(row.quarter) === Number(current)
          )
            ? current
            : String(firstQuarter ?? 1)
        );
        endLoad(true);
      } catch (err) {
        setError(err?.message ?? "Unable to load dashboard data.");
        endLoad(false);
      }
    },
    [beginLoad, endLoad]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const schoolYears = useMemo(() => {
    const classes = bundle?.allClasses ?? bundle?.classes ?? [];
    return [
      ...new Set(classes.map((row) => row.school_year).filter(Boolean)),
    ].sort((a, b) => b.localeCompare(a));
  }, [bundle]);

  const quarters = useMemo(() => {
    const classes = bundle?.allClasses ?? bundle?.classes ?? [];
    const values = [
      ...new Set(
        classes
          .filter((row) => !schoolYear || row.school_year === schoolYear)
          .map((row) => Number(row.quarter))
          .filter(Number.isFinite)
      ),
    ].sort((a, b) => a - b);
    return values.length ? values.map(String) : ["1", "2", "3", "4"];
  }, [bundle, schoolYear]);

  useEffect(() => {
    if (quarters.includes(quarter)) return;
    setQuarter(quarters[0]);
  }, [quarter, quarters]);

  useEffect(() => {
    let cancelled = false;

    async function build() {
      if (!bundle || !quarter) {
        setData(null);
        return;
      }
      setBuilding(true);
      setError("");
      try {
        const next = await buildTeacherDashboardModel({
          classes: bundle.classes ?? [],
          enrollments: bundle.enrollments ?? [],
          grades: bundle.grades ?? [],
          monitoringRecords: bundle.monitoringRecords ?? [],
          lessonPlans: bundle.lessonPlans ?? [],
          schoolYear,
          quarter,
          teacherId,
        });
        if (cancelled) return;
        setData(next);

        void syncRecommendationNotifications({
          profileId,
          students: next.roster?.students ?? [],
          classSummaries: next.roster?.classSummaries ?? [],
        });
      } catch (buildError) {
        if (!cancelled) {
          setData(null);
          setError(buildError?.message ?? "Unable to build dashboard.");
        }
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }

    build();
    return () => {
      cancelled = true;
    };
  }, [bundle, schoolYear, quarter, profileId, teacherId]);

  const showFullPageLoading = loading || (building && !data);
  const isRefreshing = refreshing || (building && Boolean(data));

  return {
    data,
    schoolYear,
    quarter,
    schoolYears,
    quarters,
    setSchoolYear,
    setQuarter,
    refresh: () => refresh({ bustCache: true }),
    loading: showFullPageLoading,
    refreshing: isRefreshing,
    error,
  };
}
