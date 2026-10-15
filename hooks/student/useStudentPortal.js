"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStudentPortalData } from "@/lib/supabase/queries/studentPortal";
import { buildStudentPortalView } from "@/lib/student/portalMappers";

export function useStudentPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const result = await getStudentPortalData();
      if (!mountedRef.current) return;

      if (result.error || !result.data) {
        if (!silent) setData(null);
        setError(result.error?.message ?? "Unable to load student portal data.");
        return;
      }

      const view = await buildStudentPortalView(result.data, {
        skipRecommendations: true,
      });
      if (!mountedRef.current) return;
      setData(view);

      try {
        let full = await buildStudentPortalView(result.data);
        if (
          full?.summary?.riskLevel === "—" &&
          (result.data.grades?.length || result.data.enrollments?.length)
        ) {
          full = await buildStudentPortalView(result.data);
        }
        if (!mountedRef.current) return;
        setData(full);
      } catch (enrichErr) {
        if (mountedRef.current) {
          console.warn(
            "[student portal] recommendation enrich failed",
            enrichErr
          );
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (!silent) setData(null);
      setError(err?.message ?? "Unable to build student portal view.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onFocus() {
      // Revalidate in background when student switches back to this tab
      load({ silent: true });
    }
    function onRefreshEvent() {
      load({ silent: false });
    }

    window.addEventListener("focus", onFocus);
    window.addEventListener("cnhs-student-portal-refresh", onRefreshEvent);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("cnhs-student-portal-refresh", onRefreshEvent);
    };
  }, [load]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    refresh: () => load({ silent: false }),
  };
}
