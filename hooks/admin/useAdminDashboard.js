"use client";

import { useCallback, useEffect, useState } from "react";
import { buildAdminDashboardModel } from "@/lib/admin/dashboardMappers";
import { invalidateAdminRosterCache } from "@/lib/admin/adminRosterCache";
import { getAdminDashboardBundle } from "@/lib/supabase/queries/adminDashboard";

export function useAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async ({ bustCache = false } = {}) => {
    setLoading(true);
    setError("");

    try {
      if (bustCache) invalidateAdminRosterCache();
      const result = await getAdminDashboardBundle();
      if (result.error || !result.data) {
        setData(null);
        setError(result.error?.message ?? "Unable to load admin dashboard.");
        return;
      }

      const model = await buildAdminDashboardModel(result.data);
      setData(model);
    } catch (err) {
      setData(null);
      setError(err?.message ?? "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh: () => refresh({ bustCache: true }),
  };
}
