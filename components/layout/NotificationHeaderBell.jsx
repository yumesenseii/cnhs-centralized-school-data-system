"use client";

import NotificationDropdown from "@/components/layout/NotificationDropdown";

/**
 * Top header notification bell button with interactive popover dropdown.
 */
export default function NotificationHeaderBell({ href = "/notifications" }) {
  return <NotificationDropdown href={href} />;
}

