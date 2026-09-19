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
import PageHelp from "@/components/shared/PageHelp";
import PaginatedNotificationList from "@/components/notifications/PaginatedNotificationList";
import NotificationStats from "@/components/notifications/NotificationStats";
import RecentActivity from "@/components/notifications/RecentActivity";
import TeacherNotificationFilters from "@/components/teacher/notifications/TeacherNotificationFilters";
import NotificationsSkeleton from "@/components/teacher/notifications/NotificationsSkeleton";
import { useTeacherNotifications } from "@/hooks/teacher/useTeacherNotifications";
import DeleteRequestsPanel from "@/components/admin/DeleteRequestsPanel";
import {
  approveDeleteRequest,
  listPendingDeleteRequests,
  rejectDeleteRequest,
} from "@/lib/supabase/queries/deleteRequests";
import { mapLessonPlanEvents } from "@/lib/notifications/mapLessonPlanActivity";
import { getRecentLessonPlanActivity } from "@/lib/supabase/queries/lessonPlans";

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
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsError, setRequestsError] = useState("");
  const [requestToast, setRequestToast] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      const [activityResult, requestsResult] = await Promise.all([
        getRecentLessonPlanActivity(5),
        listPendingDeleteRequests(),
      ]);
      if (cancelled) return;
      if (!activityResult.error) {
        setActivity(mapLessonPlanEvents(activityResult.data ?? []));
      }
      if (requestsResult.error) {
        setRequestsError(requestsResult.error.message);
        setPendingRequests([]);
      } else {
        setRequestsError("");
        setPendingRequests(requestsResult.data ?? []);
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
        controls={
          <>
            <PageHelp
              summary="Personal alerts and school-wide lesson plan activity for Head Teachers."
              steps={[
                "Inbox lists alerts addressed to your account (reviews, delete requests, recommendations).",
                "Use search and filters, then open an item to go to the related page.",
                "Mark All as Read clears unread badges; Refresh reloads the list.",
                "Recent Lesson Plan Activity shows school-wide submit / approve / revision events.",
                "Approve or reject pending delete requests in the panel above the filters.",
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
            <DeleteRequestsPanel
              requests={pendingRequests}
              error={requestsError}
              onApprove={async (row) => {
                const result = await approveDeleteRequest(row.id);
                setRequestToast(
                  result.error ? result.error.message : "Request approved."
                );
                const next = await listPendingDeleteRequests();
                setPendingRequests(next.data ?? []);
                setRequestsError(next.error?.message ?? "");
              }}
              onReject={async (row) => {
                const result = await rejectDeleteRequest(row.id);
                setRequestToast(
                  result.error ? result.error.message : "Request declined."
                );
                const next = await listPendingDeleteRequests();
                setPendingRequests(next.data ?? []);
                setRequestsError(next.error?.message ?? "");
              }}
            />
          </div>

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
              title="Recent Lesson Plan Activity"
              items={activity}
              loading={activityLoading}
            />
          </div>
        </>
      )}
      {requestToast ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-medium text-white shadow-lg">
          {requestToast}
        </div>
      ) : null}
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
          : "Items appear when teachers submit lesson plans, request deletes, or when recommendations need your review. Check Recent Lesson Plan Activity for school-wide updates."}
      </p>
      {hasNotifications ? (
        <p className="text-[11px] font-medium text-slate-500">
          Next: clear filters above, then Refresh.
        </p>
      ) : (
        <p className="text-[11px] font-medium text-slate-500">
          Next: open Lesson Plans or Academic Monitoring, or tap Refresh later.
        </p>
      )}
    </div>
  );
}
