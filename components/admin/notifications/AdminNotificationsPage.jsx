"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BellOff,
  CheckCheck,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import Header from "@/components/layout/Header";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationStats from "@/components/notifications/NotificationStats";
import RecentActivity from "@/components/notifications/RecentActivity";
import TeacherNotificationFilters from "@/components/teacher/notifications/TeacherNotificationFilters";
import NotificationsSkeleton from "@/components/teacher/notifications/NotificationsSkeleton";
import { useTeacherNotifications } from "@/hooks/teacher/useTeacherNotifications";
import { getRecentLessonPlanActivity } from "@/lib/supabase/queries/lessonPlans";

function mapLessonPlanEvents(rows = []) {
  return rows.map((row) => {
    const plan = Array.isArray(row.lesson_plans)
      ? row.lesson_plans[0]
      : row.lesson_plans;
    const teacher = plan?.teachers;
    const teacherName = teacher
      ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ")
      : null;
    const event = String(row.event_type || "").toLowerCase();
    let icon = "file";
    let tone = "violet";
    let title = plan?.lesson_title
      ? `Lesson plan — ${plan.lesson_title}`
      : "Lesson plan update";

    if (event.includes("approv")) {
      icon = "check";
      tone = "green";
      title = `Approved — ${plan?.lesson_title || "Lesson plan"}`;
    } else if (event.includes("revision") || event.includes("needs")) {
      icon = "revision";
      tone = "orange";
      title = `Needs revision — ${plan?.lesson_title || "Lesson plan"}`;
    } else if (event.includes("submit")) {
      icon = "file";
      tone = "violet";
      title = `Submitted — ${plan?.lesson_title || "Lesson plan"}`;
    }

    const when = row.created_at ? new Date(row.created_at) : null;
    const timestamp = when
      ? when.toLocaleString("en-PH", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

    return {
      id: row.id,
      title,
      description: [row.actor_name || teacherName, row.remarks]
        .filter(Boolean)
        .join(" · "),
      timestamp,
      icon,
      tone,
    };
  });
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const {
    notifications,
    filtered,
    summaryCards,
    filterOptions,
    unreadCount,
    loading,
    markingAll,
    error,
    filters,
    filtersActive,
    setSearch,
    setType,
    setPriority,
    setStatus,
    clearFilters,
    refresh,
    markRead,
    markAllRead,
  } = useTeacherNotifications();

  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      const result = await getRecentLessonPlanActivity(8);
      if (cancelled) return;
      if (!result.error) {
        setActivity(mapLessonPlanEvents(result.data ?? []));
      }
      setActivityLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAction(notification) {
    if (notification.unread) await markRead(notification.id);
    if (notification.actionUrl) router.push(notification.actionUrl);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / Notifications"
        title="Notifications"
        description="Your personal inbox for system alerts, plus recent lesson plan activity across the school."
        controls={
          <>
            <button
              type="button"
              onClick={() => markAllRead()}
              disabled={unreadCount === 0 || markingAll}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck size={13} />
              {markingAll ? "Marking…" : "Mark All as Read"}
            </button>
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </>
        }
      />

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          <TriangleAlert size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <RefreshCw size={12} />
            Try Again
          </button>
        </div>
      ) : null}

      {loading ? (
        <NotificationsSkeleton />
      ) : (
        <>
          <NotificationStats cards={summaryCards} />

          <div className="mt-4">
            <TeacherNotificationFilters
              filters={filterOptions}
              search={filters.search}
              type={filters.type}
              priority={filters.priority}
              status={filters.status}
              filtersActive={filtersActive}
              onSearchChange={setSearch}
              onTypeChange={setType}
              onPriorityChange={setPriority}
              onStatusChange={setStatus}
              onClear={clearFilters}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              {filtered.length ? (
                <NotificationList
                  notifications={filtered}
                  onAction={handleAction}
                  onMarkRead={(notification) => markRead(notification.id)}
                />
              ) : (
                <EmptyState hasNotifications={notifications.length > 0} />
              )}
            </div>

            <RecentActivity
              title="Recent Lesson Plan Activity"
              items={activity}
              loading={activityLoading}
            />
          </div>
        </>
      )}
    </motion.div>
  );
}

function EmptyState({ hasNotifications }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <BellOff size={18} strokeWidth={1.8} />
      </span>
      <p className="text-sm font-semibold text-slate-700">
        {hasNotifications
          ? "No matching notifications"
          : "No notifications in your inbox"}
      </p>
      <p className="max-w-sm text-[12px] text-slate-500">
        {hasNotifications
          ? "Try clearing the search or filters to see the rest of your notifications."
          : "Alerts addressed to your Head Teacher account appear here. School-wide lesson plan updates are listed in Recent Lesson Plan Activity."}
      </p>
    </div>
  );
}
