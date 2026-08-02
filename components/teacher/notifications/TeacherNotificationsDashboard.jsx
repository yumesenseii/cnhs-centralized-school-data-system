"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BellOff, CheckCheck, Menu, RefreshCw, TriangleAlert } from "lucide-react";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationStats from "@/components/notifications/NotificationStats";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import NotificationsSkeleton from "@/components/teacher/notifications/NotificationsSkeleton";
import TeacherNotificationFilters from "@/components/teacher/notifications/TeacherNotificationFilters";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useTeacherNotifications } from "@/hooks/teacher/useTeacherNotifications";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function TeacherNotificationsDashboard() {
  const router = useRouter();
  const {
    notifications,
    filtered,
    summaryCards,
    filterOptions,
    unreadCount,
    loading,
    error,
    filters,
    setSearch,
    setType,
    setPriority,
    setStatus,
    clearFilters,
    refresh,
    markRead,
    markAllRead,
  } = useTeacherNotifications();

  const [menuOpen, setMenuOpen] = useState(false);

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
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium text-slate-400">
              <Link href="/teacher/dashboard" className="hover:text-slate-600">
                Home
              </Link>
              <span className="text-slate-300"> &gt; </span>
              <span className="font-semibold text-slate-600">Notifications</span>
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              Notifications
            </h1>
            <p className="mt-1 max-w-xl text-[12px] text-slate-500">
              Personal action items from your lesson plan reviews, class
              assignments, learner recommendations, monitoring records, and
              E-Class Record imports.
            </p>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open teacher menu"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                />
              }
            >
              <Menu size={18} />
            </SheetTrigger>
            <SheetContent
              side="left"
              showCloseButton={false}
              className={SIDEBAR_SHEET_CLASS}
            >
              <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
              <TeacherSidebar mobile onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => markAllRead()}
            disabled={unreadCount === 0}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck size={13} />
            Mark All as Read
          </button>
          <button
            type="button"
            onClick={() => refresh()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

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
              onSearchChange={setSearch}
              onTypeChange={setType}
              onPriorityChange={setPriority}
              onStatusChange={setStatus}
              onClear={clearFilters}
            />
          </div>

          <div className="mt-4">
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
        {hasNotifications ? "No matching notifications" : "You're all caught up"}
      </p>
      <p className="max-w-sm text-[12px] text-slate-500">
        {hasNotifications
          ? "Try clearing the search or filters to see the rest of your notifications."
          : "New lesson plan reviews, class assignments, learner recommendations, and import results will appear here."}
      </p>
    </div>
  );
}
