"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "@/lib/notifications/debounce";
import {
  NOTIFICATION_FILTER_ALL,
  NOTIFICATION_STATUS_FILTER,
} from "@/lib/notifications/notificationConstants";
import {
  buildNotificationFilterOptions,
  buildNotificationSummaryCards,
  filterNotifications,
  mapNotifications,
} from "@/lib/notifications/notificationMappers";
import {
  getTeacherNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/lib/supabase/queries/notifications";

export function useTeacherNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [type, setType] = useState(NOTIFICATION_FILTER_ALL);
  const [priority, setPriority] = useState(NOTIFICATION_FILTER_ALL);
  const [status, setStatus] = useState(NOTIFICATION_STATUS_FILTER.ALL);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    const result = await getTeacherNotifications();
    if (!mounted.current) return;

    if (result.error) {
      setError(result.error.message ?? "Unable to load notifications.");
      setLoading(false);
      return;
    }

    setProfileId(result.profile?.id ?? null);
    setNotifications(mapNotifications(result.data));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime keeps the inbox current without a manual reload.
  useEffect(() => {
    if (!profileId) return undefined;

    const onChange = debounce(() => refresh({ silent: true }), 400);
    const unsubscribe = subscribeToNotifications(profileId, onChange);

    return () => {
      onChange.cancel();
      unsubscribe();
    };
  }, [profileId, refresh]);

  const markRead = useCallback(async (notificationId) => {
    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, unread: false, isRead: true, readAt: new Date().toISOString() }
          : item
      )
    );

    const result = await markNotificationRead(notificationId, true);
    if (result.error && mounted.current) {
      setError(result.error.message ?? "Unable to update this notification.");
      await refresh({ silent: true });
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) =>
        item.unread ? { ...item, unread: false, isRead: true, readAt } : item
      )
    );

    const result = await markAllNotificationsRead();
    if (result.error && mounted.current) {
      setError(result.error.message ?? "Unable to mark all as read.");
      await refresh({ silent: true });
    }
  }, [refresh]);

  const filtered = useMemo(
    () => filterNotifications(notifications, { search, type, priority, status }),
    [notifications, search, type, priority, status]
  );

  const summaryCards = useMemo(
    () => buildNotificationSummaryCards(notifications),
    [notifications]
  );

  const filterOptions = useMemo(
    () => buildNotificationFilterOptions(notifications),
    [notifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications]
  );

  function clearFilters() {
    setSearch("");
    setType(NOTIFICATION_FILTER_ALL);
    setPriority(NOTIFICATION_FILTER_ALL);
    setStatus(NOTIFICATION_STATUS_FILTER.ALL);
  }

  return {
    notifications,
    filtered,
    summaryCards,
    filterOptions,
    unreadCount,
    loading,
    error,
    filters: { search, type, priority, status },
    setSearch,
    setType,
    setPriority,
    setStatus,
    clearFilters,
    refresh,
    markRead,
    markAllRead,
  };
}
