/**
 * Notification row → UI shape used by the shared notification components.
 */

import {
  NOTIFICATION_FILTER_ALL,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUS_FILTER,
  NOTIFICATION_TYPE_ICONS,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TONES,
} from "@/lib/notifications/notificationConstants";

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function formatNotificationTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function mapNotification(row) {
  const type = row.notification_type;
  const metadata = row.metadata ?? {};
  const actor = unwrap(row.actor);

  return {
    id: row.id,
    type,
    module: NOTIFICATION_TYPE_LABELS[type] ?? "System",
    moduleTone: NOTIFICATION_TYPE_TONES[type] ?? "slate",
    icon: NOTIFICATION_TYPE_ICONS[type] ?? "file",
    iconTone: NOTIFICATION_TYPE_TONES[type] ?? "slate",
    title: row.title,
    description: row.message,
    priority: row.priority,
    unread: !row.is_read,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
    timestamp: formatNotificationTimestamp(row.created_at),
    actionUrl: row.action_url,
    // No destination means no action button.
    actionLabel: row.action_url ? (metadata.actionLabel ?? "View Details") : null,
    context: metadata.context ?? null,
    user: actor?.full_name ?? "System",
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata,
  };
}

export function mapNotifications(rows = []) {
  return rows.map(mapNotification);
}

export function buildNotificationSummaryCards(notifications = []) {
  const now = new Date();
  const unread = notifications.filter((item) => item.unread).length;
  const highPriority = notifications.filter(
    (item) => item.priority === "High" && item.unread
  ).length;
  const readToday = notifications.filter((item) => {
    if (!item.readAt) return false;
    const readAt = new Date(item.readAt);
    return !Number.isNaN(readAt.getTime()) && isSameDay(readAt, now);
  }).length;

  return [
    {
      id: "total",
      label: "Total Notifications",
      count: notifications.length,
      icon: "bell",
      tone: "green",
    },
    { id: "unread", label: "Unread", count: unread, icon: "mail", tone: "purple" },
    {
      id: "high",
      label: "High Priority",
      count: highPriority,
      icon: "alert",
      tone: "red",
    },
    {
      id: "read-today",
      label: "Read Today",
      count: readToday,
      icon: "check",
      tone: "teal",
    },
  ];
}

/** Only offer type options the teacher actually has notifications for. */
export function buildNotificationFilterOptions(notifications = []) {
  const types = [...new Set(notifications.map((item) => item.type))].map(
    (type) => ({
      value: type,
      label: NOTIFICATION_TYPE_LABELS[type] ?? type,
    })
  );

  return {
    types: [{ value: NOTIFICATION_FILTER_ALL, label: "All Types" }, ...types],
    priorities: [
      { value: NOTIFICATION_FILTER_ALL, label: "All Priorities" },
      ...NOTIFICATION_PRIORITIES.map((value) => ({ value, label: value })),
    ],
    statuses: [
      { value: NOTIFICATION_STATUS_FILTER.ALL, label: "All" },
      { value: NOTIFICATION_STATUS_FILTER.UNREAD, label: "Unread" },
      { value: NOTIFICATION_STATUS_FILTER.READ, label: "Read" },
    ],
  };
}

export function filterNotifications(
  notifications = [],
  { search = "", type = NOTIFICATION_FILTER_ALL, priority = NOTIFICATION_FILTER_ALL, status = NOTIFICATION_STATUS_FILTER.ALL } = {}
) {
  const query = search.trim().toLowerCase();

  return notifications.filter((item) => {
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      (item.context ?? "").toLowerCase().includes(query) ||
      item.module.toLowerCase().includes(query);

    const matchesType = type === NOTIFICATION_FILTER_ALL || item.type === type;
    const matchesPriority =
      priority === NOTIFICATION_FILTER_ALL || item.priority === priority;
    const matchesStatus =
      status === NOTIFICATION_STATUS_FILTER.ALL ||
      (status === NOTIFICATION_STATUS_FILTER.UNREAD && item.unread) ||
      (status === NOTIFICATION_STATUS_FILTER.READ && !item.unread);

    return matchesSearch && matchesType && matchesPriority && matchesStatus;
  });
}
