/**
 * Soft-load helpers: full-page loading only on first fetch.
 * Subsequent refreshes keep previous UI and use `refreshing`.
 */

import { useCallback, useRef, useState } from "react";

export function useSoftLoadState(initialLoading = true) {
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(initialLoading);
  const [refreshing, setRefreshing] = useState(false);

  const beginLoad = useCallback(() => {
    if (!hasLoadedRef.current) setLoading(true);
    else setRefreshing(true);
  }, []);

  const endLoad = useCallback((markLoaded = true) => {
    if (markLoaded) hasLoadedRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, []);

  const resetLoaded = useCallback(() => {
    hasLoadedRef.current = false;
  }, []);

  return {
    loading,
    refreshing,
    beginLoad,
    endLoad,
    resetLoaded,
    hasLoaded: () => hasLoadedRef.current,
  };
}
