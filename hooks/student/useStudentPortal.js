"use client";

import { useEffect, useState } from "react";
import { getStudentPortalData } from "@/lib/supabase/queries/studentPortal";
import { buildStudentPortalView } from "@/lib/student/portalMappers";

export function useStudentPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const result = await getStudentPortalData();
      if (cancelled) return;

      if (result.error || !result.data) {
        setData(null);
        setError(result.error?.message ?? "Unable to load student portal data.");
        setLoading(false);
        return;
      }

      try {
        const view = await buildStudentPortalView(result.data, {
          skipRecommendations: true,
        });
        if (cancelled) return;
        setData(view);
        setLoading(false);

        try {
          let full = await buildStudentPortalView(result.data);
          if (
            full?.summary?.riskLevel === "—" &&
            (result.data.grades?.length || result.data.enrollments?.length)
          ) {
            full = await buildStudentPortalView(result.data);
          }
          if (cancelled) return;
          setData(full);
        } catch (enrichErr) {
          if (!cancelled) {
            console.warn(
              "[student portal] recommendation enrich failed",
              enrichErr
            );
          }
        }
      } catch (err) {
        if (cancelled) return;
        setData(null);
        setError(err?.message ?? "Unable to build student portal view.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
