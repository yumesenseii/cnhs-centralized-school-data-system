"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildAdminDashboardModel } from "@/lib/admin/dashboardMappers";
import {
  invalidateAdminRosterCache,
  loadBuiltMonitoringRoster,
} from "@/lib/admin/adminRosterCache";
import { getAdminDashboardBundle } from "@/lib/supabase/queries/adminDashboard";
import { useSoftLoadState } from "@/hooks/useSoftLoadState";

function keepRfModel(current, next) {
  if (
    current?.meta?.predictionsPending === false &&
    next?.meta?.predictionsPending
  ) {
    return current;
  }
  return next;
}

function isTransientFetchError(err) {
  const message = String(err?.message ?? err ?? "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("aborted") ||
    err?.name === "AbortError"
  );
}

export function useAdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const loadSeq = useRef(0);
  const { loading, refreshing, beginLoad, endLoad, endFirstPaint } =
    useSoftLoadState(true);

  const refresh = useCallback(
    async ({ bustCache = false, retryCount = 0 } = {}) => {
      const seq = ++loadSeq.current;
      beginLoad();
      if (retryCount === 0) setError("");

      try {
        if (bustCache) invalidateAdminRosterCache();
        const result = await getAdminDashboardBundle();
        if (seq !== loadSeq.current) return;

        if (result.error || !result.data) {
          const err = result.error;
          if ((isTransientFetchError(err) || !result.data) && retryCount < 3) {
            window.setTimeout(() => {
              if (seq !== loadSeq.current) return;
              refresh({ retryCount: retryCount + 1, bustCache });
            }, 500 * (retryCount + 1));
            return;
          }

          setData((current) => current);
          setError(
            isTransientFetchError(err)
              ? "Connection temporarily interrupted. Please click Retry."
              : err?.message ?? "Unable to load school overview."
          );
          endLoad(false);
          return;
        }

        const rosterPayload = result.data.roster ?? {
          classes: [],
          enrollments: [],
          grades: [],
          monitoringRecords: [],
        };

        const apply = (model) => {
          if (seq !== loadSeq.current) return;
          setData((current) => keepRfModel(current, model));
        };

        const roster = await loadBuiltMonitoringRoster(
          rosterPayload,
          {
            schoolYear: result.data.schoolYear ?? null,
            quarter: null,
          },
          {
            onShell: async (shell) => {
              if (seq !== loadSeq.current) return;
              const model = await buildAdminDashboardModel(result.data, shell);
              apply(model);
              endFirstPaint();
            },
          }
        );
        if (seq !== loadSeq.current) return;

        if (roster?.predictionsPending && retryCount < 2) {
          const model = await buildAdminDashboardModel(result.data, roster);
          apply(model);
          endFirstPaint();
          window.setTimeout(() => {
            if (seq !== loadSeq.current) return;
            refresh({ retryCount: retryCount + 1 });
          }, 800);
          return;
        }

        const model = await buildAdminDashboardModel(result.data, roster);
        apply(model);
        if (roster?.predictionsPending) endFirstPaint();
        else endLoad(true);
      } catch (err) {
        if (seq !== loadSeq.current) return;

        if (isTransientFetchError(err) && retryCount < 3) {
          endFirstPaint();
          window.setTimeout(() => {
            if (seq !== loadSeq.current) return;
            refresh({ retryCount: retryCount + 1, bustCache });
          }, 500 * (retryCount + 1));
          return;
        }

        let hadData = false;
        setData((current) => {
          hadData = Boolean(current);
          return current ?? null;
        });
        if (!hadData) {
          setError(
            isTransientFetchError(err)
              ? "Connection temporarily interrupted. Please click Retry."
              : err?.message ?? "Unable to load school overview."
          );
        }
        endLoad(false);
      }
    },
    [beginLoad, endLoad, endFirstPaint]
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

