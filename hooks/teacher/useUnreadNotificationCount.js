"use client";

import { useCallback, useEffect, useState } from "react";
import { debounce } from "@/lib/notifications/debounce";
import {
  getCurrentProfile,
  getUnreadNotificationCount,
  subscribeToNotifications,
} from "@/lib/supabase/queries/notifications";

/**
 * Live unread badge count for the authenticated recipient only.
 * Realtime updates cover both new notifications and mark-as-read actions.
 */
export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0);
  const [profileId, setProfileId] = useState(null);

  const refresh = useCallback(async () => {
    const result = await getUnreadNotificationCount();
    if (result.error) return;
    setCount(result.data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const profile = await getCurrentProfile();
      if (cancelled || profile.error) return;
      setProfileId(profile.data.id);
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!profileId) return undefined;

    const onChange = debounce(() => refresh(), 400);
    const unsubscribe = subscribeToNotifications(profileId, onChange);

    return () => {
      onChange.cancel();
      unsubscribe();
    };
  }, [profileId, refresh]);

  return { count, refresh };
}
