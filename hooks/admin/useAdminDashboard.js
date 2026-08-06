"use client";

import { useCallback, useEffect, useState } from "react";
import { buildAdminDashboardModel } from "@/lib/admin/dashboardMappers";
import { invalidateAdminRosterCache } from "@/lib/admin/adminRosterCache";
import { getAdminDashboardBundle } from "@/lib/supabase/queries/adminDashboard";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

export function useAdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { loading, refreshing, beginLoad, endLoad } = useSoftLoadState(true);

  const refresh = useCallback(
    async ({ bustCache = false } = {}) => {
      beginLoad();
      setError("");

      try {
        if (bustCache) invalidateAdminRosterCache();
        const result = await getAdminDashboardBundle();
        if (result.error || !result.data) {
          setData(null);
          setError(result.error?.message ?? "Unable to load admin dashboard.");
          endLoad(false);
          return;
        }

        const model = await buildAdminDashboardModel(result.data);
        setData(model);
        endLoad(true);
      } catch (err) {
        setData(null);
        setError(err?.message ?? "Unable to load admin dashboard.");
        endLoad(false);
      }
    },
    [beginLoad, endLoad]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    refreshing,
    error,
    refresh: () => refresh({ bustCache: true }),
  };
}
