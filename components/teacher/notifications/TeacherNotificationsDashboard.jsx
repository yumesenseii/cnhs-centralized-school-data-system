"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BellOff, CheckCheck, RefreshCw, TriangleAlert } from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import PaginatedNotificationList from "@/components/notifications/PaginatedNotificationList";
import NotificationStats from "@/components/notifications/NotificationStats";
import RecentActivity from "@/components/notifications/RecentActivity";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import NotificationsSkeleton from "@/components/teacher/notifications/NotificationsSkeleton";
import TeacherNotificationFilters from "@/components/teacher/notifications/TeacherNotificationFilters";
import { useTeacherNotifications } from "@/hooks/teacher/useTeacherNotifications";
import { mapLessonPlanEvents } from "@/lib/notifications/mapLessonPlanActivity";
import { getRecentLessonPlanActivityForTeacher } from "@/lib/supabase/queries/lessonPlans";

export default function TeacherNotificationsDashboard() {
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
      const activityResult = await getRecentLessonPlanActivityForTeacher(5);
      if (cancelled) return;
      if (!activityResult.error) {
        setActivity(mapLessonPlanEvents(activityResult.data ?? []));
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
        mobileNavAriaLabel="Open teacher menu"
        mobileNavTitle="Teacher navigation"
        renderMobileNav={(close) => (
          <TeacherSidebar mobile onNavigate={close} />
        )}
        controls={
          <>
            <PageHelp
              summary="Personal action items from lesson plans, classes, recommendations, and imports."
              steps={[
                "Scan unread items first, then open one to go to the related page.",
                "Filter by type, priority, or status when the list grows.",
                "Mark All as Read clears badges; Refresh reloads from the server.",
                "My Lesson Plan Activity shows submit and School Principal review events for your plans.",
                "Recommendations and monitoring alerts appear after ECR grades create risk flags.",
              ]}
            />
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
                <PaginatedNotificationList
                  notifications={filtered}
                  onAction={handleAction}
                  onMarkRead={(notification) => markRead(notification.id)}
                />
              ) : (
                <EmptyState hasNotifications={notifications.length > 0} />
              )}
            </div>

            <RecentActivity
              title="My Lesson Plan Activity"
              items={activity}
              loading={activityLoading}
              emptyTitle="No lesson plan activity yet"
              emptyBody="Your submits and School Principal review decisions appear here after you upload a lesson plan."
              emptyNext="Next: open Lesson Plans to submit, then Refresh this page."
            />
          </div>
        </>
      )}
    </motion.div>
  );
}

function EmptyState({ hasNotifications }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-100 bg-white px-6 py-10 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/10">
        <BellOff size={18} strokeWidth={1.8} />
      </span>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {hasNotifications
          ? "No matching notifications"
          : "No notifications in your inbox"}
      </p>
      <p className="max-w-sm text-[12px] leading-5 text-slate-500">
        {hasNotifications
          ? "Clear search or filters to see the rest of your inbox."
          : "Items appear after lesson plan reviews, class assignments, recommendations from ECR grades, monitoring updates, or E-Class Record imports. Check My Lesson Plan Activity for your recent plan updates."}
      </p>
      {hasNotifications ? (
        <p className="text-[11px] font-medium text-slate-500">
          Next: clear filters above, then Refresh.
        </p>
      ) : (
        <p className="text-[11px] font-medium text-slate-500">
          Next: continue in My Classes or Lesson Plans, then Refresh later.
        </p>
      )}
    </div>
  );
}
