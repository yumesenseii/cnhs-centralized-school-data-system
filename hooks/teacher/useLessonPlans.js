"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllLessonPlansForReview,
  getLessonPlanById,
  getLessonPlanSignedUrl,
  getRecentLessonPlanActivity,
  getTeacherLessonPlans,
  markLessonPlanUnderReview,
  resubmitLessonPlan,
  reviewLessonPlan,
  saveLessonPlanSectionRemarks,
  deleteTeacherLessonPlan,
  subscribeToLessonPlanReviewChanges,
  subscribeToTeacherLessonPlans,
} from "@/lib/supabase/queries/lessonPlans";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import {
  buildAdminActionRequired,
  buildAdminLessonPlanSummary,
  buildTeacherLessonPlanKpis,
  mapLessonPlanForAdmin,
  mapLessonPlanForTeacher,
  mapRecentLessonPlanActivity,
  quarterToLabel,
} from "@/lib/teacher/lessonPlanMappers";
import { debounce } from "@/lib/notifications/debounce";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useTeacherLessonPlans() {
  const [plans, setPlans] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const refresh = useCallback(async () => {
    beginLoad();
    setError("");

    // Same resolution path as My Classes: profiles.auth_user_id → teachers.id
    const session = await getCurrentTeacherSession();
    if (session.error || !session.data) {
      const message =
        session.error?.message ?? "Unable to load teacher session.";
      console.warn("[lesson_plans] teacher lookup failed", {
        message,
        session,
      });
      setError(message);
      setPlans([]);
      setKpis(buildTeacherLessonPlanKpis([]));
      endLoad(false);
      return;
    }

    const teacherId = session.data.teacherId;
    console.log("[lesson_plans] teacher resolved", {
      teacherId,
      teacher: session.data.teacher,
      profileId: session.data.profile?.id,
      authUserId: session.data.profile?.auth_user_id,
      role: session.data.profile?.role,
    });

    setTeacher(session.data.teacher);
    const result = await getTeacherLessonPlans(teacherId);
    if (result.error) {
      console.warn("[lesson_plans] query error", result.error);
      setError(result.error.message);
      setPlans([]);
      setKpis(buildTeacherLessonPlanKpis([]));
      endLoad(false);
      return;
    }

    console.log("[lesson_plans] raw rows before UI mapping/filters", result.data);

    const mapped = (result.data ?? []).map(mapLessonPlanForTeacher);
    console.log("[lesson_plans] mapped plans (all statuses)", mapped.map((p) => ({
      id: p.id,
      status: p.status,
      schoolYear: p.schoolYear,
      quarter: p.quarter,
      subject: p.subject,
    })));

    setPlans(mapped);
    setKpis(buildTeacherLessonPlanKpis(mapped));
    endLoad(true);
  }, [beginLoad, endLoad]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    if (!teacher?.id) return undefined;
    const onChange = debounce(() => refresh(), 400);
    const unsubscribe = subscribeToTeacherLessonPlans(teacher.id, onChange);
    return () => {
      onChange.cancel();
      unsubscribe();
    };
  }, [teacher?.id, refresh]);

  const resubmit = useCallback(
    async ({ id, file, previousFilePath, schoolYear, revisionNote = null }) => {
      if (!teacher?.id) {
        return { ok: false, error: new Error("Teacher session is required.") };
      }

      const result = await resubmitLessonPlan({
        id,
        teacherId: teacher.id,
        schoolYear,
        file,
        revisionNote,
        previousFilePath,
      });

      if (result.error) return { ok: false, error: result.error };
      await refresh();
      return {
        ok: true,
        plan: result.data ? mapLessonPlanForTeacher(result.data) : null,
      };
    },
    [refresh, teacher?.id]
  );

  const remove = useCallback(
    async (plan) => {
      if (!teacher?.id) {
        return { ok: false, error: new Error("Teacher session is required.") };
      }
      if (!plan?.id) {
        return { ok: false, error: new Error("Lesson plan id is required.") };
      }

      const result = await deleteTeacherLessonPlan({
        id: plan.id,
        teacherId: teacher.id,
      });

      if (result.error) return { ok: false, error: result.error };
      await refresh();
      return { ok: true, data: result.data };
    },
    [refresh, teacher?.id]
  );

  return {
    plans,
    kpis,
    teacher,
    teacherId: teacher?.id ?? null,
    loading,
    refreshing,
    error,
    refresh,
    resubmit,
    remove,
  };
}

export function useTeacherLessonPlanDetail(planId) {
  const [plan, setPlan] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(Boolean(planId));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!planId) return;
      setLoading(true);
      setError("");

      const session = await getCurrentTeacherSession();
      if (!active) return;
      if (session.error || !session.data) {
        setError(session.error?.message ?? "Unable to load teacher session.");
        setLoading(false);
        return;
      }

      const result = await getLessonPlanById(planId, {
        teacherId: session.data.teacherId,
      });
      if (!active) return;
      if (result.error || !result.data) {
        setError(result.error?.message ?? "Lesson plan not found.");
        setLoading(false);
        return;
      }

      const mapped = mapLessonPlanForTeacher(result.data);
      setPlan(mapped);

      const signed = await getLessonPlanSignedUrl(mapped.filePath);
      if (!active) return;
      setFileUrl(signed.data);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [planId]);

  return { plan, fileUrl, loading, error };
}

export function useAdminLessonPlanReview() {
  const [plans, setPlans] = useState([]);
  const [allPlansMeta, setAllPlansMeta] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [summaryCards, setSummaryCards] = useState([]);
  const [actionRequired, setActionRequired] = useState({
    pending: 0,
    needsRevision: 0,
    message: "",
  });
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);
  const [reviewerProfileId, setReviewerProfileId] = useState(null);
  const [reviewerName, setReviewerName] = useState(null);
  const [schoolYear, setSchoolYear] = useState("All School Years");
  const [quarter, setQuarter] = useState("All Terms");

  const refresh = useCallback(
    async (options = {}) => {
      const nextSchoolYear =
        options.schoolYear !== undefined ? options.schoolYear : schoolYear;
      const nextQuarter =
        options.quarter !== undefined ? options.quarter : quarter;

      beginLoad();
      setError("");

      const session = await getAdminSession();
      if (session?.data?.id) {
        setReviewerProfileId(session.data.id);
        setReviewerName(session.data.full_name ?? null);
      }

      const [result, activityResult] = await Promise.all([
        getAllLessonPlansForReview({
          schoolYear:
            nextSchoolYear === "All School Years" ? null : nextSchoolYear,
          quarter: nextQuarter === "All Terms" ? null : nextQuarter,
        }),
        getRecentLessonPlanActivity(5),
      ]);

      // When filters are "all", the filtered query already has meta options.
      // Otherwise fetch an unfiltered list once for dropdown years/quarters.
      let metaResult = { data: result.data, error: result.error };
      if (
        nextSchoolYear !== "All School Years" ||
        nextQuarter !== "All Terms"
      ) {
        metaResult = await getAllLessonPlansForReview();
      }

      if (result.error) {
        setError(result.error.message);
        endLoad(false);
        return;
      }

      const mapped = (result.data ?? []).map(mapLessonPlanForAdmin);
      setPlans(mapped);
      setSummaryCards(buildAdminLessonPlanSummary(mapped));
      setActionRequired(buildAdminActionRequired(mapped));

      if (!metaResult.error) {
        setAllPlansMeta((metaResult.data ?? []).map(mapLessonPlanForAdmin));
      }

      if (!activityResult.error) {
        setRecentActivity(mapRecentLessonPlanActivity(activityResult.data ?? []));
      } else {
        setRecentActivity([]);
      }

      endLoad(true);
    },
    [schoolYear, quarter, beginLoad, endLoad]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    const onChange = debounce(() => refresh(), 400);
    const unsubscribe = subscribeToLessonPlanReviewChanges(onChange);
    return () => {
      onChange.cancel();
      unsubscribe();
    };
  }, [refresh]);

  const periodOptions = useMemo(() => {
    const source = allPlansMeta.length ? allPlansMeta : plans;
    const schoolYears = [
      "All School Years",
      ...new Set(source.map((p) => p.schoolYear).filter(Boolean)),
    ];
    const quarterLabels = [
      "All Terms",
      ...new Set(
        source
          .map((p) => p.quarter || quarterToLabel(p.raw?.quarter))
          .filter(Boolean)
      ),
    ];
    return { schoolYears, quarters: quarterLabels };
  }, [allPlansMeta, plans]);

  const filterOptions = useMemo(() => {
    const teachers = [
      "All Teachers",
      ...new Set(plans.map((p) => p.teacher).filter(Boolean)),
    ];
    const learningAreas = [
      "All Learning Areas",
      ...new Set(plans.map((p) => p.learningArea).filter(Boolean)),
    ];
    const grades = [
      "All Grades",
      ...new Set(
        plans
          .map((p) => p.gradeSection?.split("—")[0]?.trim())
          .filter(Boolean)
      ),
    ];
    return {
      teachers,
      learningAreas,
      grades,
      statuses: [
        "All Status",
        "Pending",
        "Under Review",
        "Approved",
        "Needs Revision",
      ],
      schoolYears: periodOptions.schoolYears,
      quarters: periodOptions.quarters,
    };
  }, [plans, periodOptions]);

  function changeSchoolYear(value) {
    setSchoolYear(value);
  }

  function changeQuarter(value) {
    setQuarter(value);
  }

  const submitDecision = useCallback(
    async ({ id, status, remarks, sectionRemarks = [] }) => {
      const result = await reviewLessonPlan({
        id,
        status,
        remarks,
        sectionRemarks,
        reviewedBy: reviewerProfileId,
        reviewerName: reviewerName || "Principal",
      });

      if (result.error) return { ok: false, error: result.error };
      await refresh();
      return {
        ok: true,
        plan: result.data ? mapLessonPlanForAdmin(result.data) : null,
      };
    },
    [refresh, reviewerProfileId, reviewerName]
  );

  const saveDraftRemarks = useCallback(
    async ({ id, sectionRemarks = [] }) => {
      const result = await saveLessonPlanSectionRemarks({
        id,
        sectionRemarks,
      });
      if (result.error) return { ok: false, error: result.error };
      await refresh();
      return {
        ok: true,
        plan: result.data ? mapLessonPlanForAdmin(result.data) : null,
      };
    },
    [refresh]
  );

  const markUnderReview = useCallback(
    async (lesson) => {
      if (!lesson?.id) return { ok: false, error: new Error("Missing lesson id.") };
      if (lesson.dbStatus && lesson.dbStatus !== "Pending Review") {
        return { ok: true, plan: lesson };
      }

      const result = await markLessonPlanUnderReview(lesson.id, {
        actorProfileId: reviewerProfileId,
        actorName: reviewerName || "Principal",
      });
      if (result.error) return { ok: false, error: result.error };

      if (result.data) {
        await refresh();
        return {
          ok: true,
          plan: mapLessonPlanForAdmin(result.data),
        };
      }

      await refresh();
      return { ok: true, plan: null };
    },
    [refresh, reviewerProfileId, reviewerName]
  );

  return {
    plans,
    recentActivity,
    summaryCards,
    actionRequired,
    filterOptions,
    schoolYear,
    quarter,
    setSchoolYear: changeSchoolYear,
    setQuarter: changeQuarter,
    loading,
    refreshing,
    error,
    refresh,
    submitDecision,
    saveDraftRemarks,
    markUnderReview,
    reviewerProfileId,
    reviewerName: reviewerName || "Principal",
  };
}
