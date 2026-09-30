"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  BellOff,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Layers3,
  Loader2,
  RefreshCw,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useTeacherNotifications } from "@/hooks/teacher/useTeacherNotifications";
import { cn } from "@/lib/utils";

const iconMap = {
  upload: Upload,
  book: BookOpen,
  file: FileText,
  revision: RefreshCw,
  check: CheckCircle2,
  chart: BarChart3,
  user: UserRound,
  monitor: ClipboardList,
};

const iconTones = {
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-400",
  orange: "bg-orange-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function NotificationDropdown({ href = "/notifications" }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState("all"); // "all" | "unread"
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    markingAll,
    markRead,
    markAllRead,
  } = useTeacherNotifications();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Filter items based on active tab
  const displayedNotifications = useMemo(() => {
    if (tab === "unread") {
      return notifications.filter((item) => item.unread);
    }
    return notifications.slice(0, 10);
  }, [notifications, tab]);

  async function handleNotificationClick(item) {
    if (item.unread) {
      await markRead(item.id);
    }
    setIsOpen(false);
    if (item.actionUrl) {
      router.push(item.actionUrl);
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
        className={cn(
          "relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors duration-200",
          "hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
          isOpen && "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white ring-2 ring-cnhs-green/30",
          unreadCount > 0 && "text-slate-700 dark:text-slate-200"
        )}
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50 duration-150"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {/* Floating Notification Popover Card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[340px] origin-top-right rounded-2xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900 dark:shadow-2xl dark:ring-white/5 sm:w-[390px]"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                Notifications
              </h2>
              {unreadCount > 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-700/30">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 ? (
                <button
                  type="button"
                  disabled={markingAll}
                  onClick={markAllRead}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-50 active:scale-95 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                >
                  <Check size={12} strokeWidth={2.5} />
                  <span>Mark all read</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter Tabs: All vs Unread */}
          <div className="flex items-center gap-1 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1 text-[12px] font-medium transition-colors",
                tab === "all"
                  ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("unread")}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1 text-[12px] font-medium transition-colors",
                tab === "unread"
                  ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 size={20} className="animate-spin text-emerald-600" />
                <span className="mt-2 text-xs">Loading notifications…</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400">
                  <BellOff size={18} />
                </div>
                <p className="mt-2.5 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                  {tab === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-400">
                  {tab === "unread"
                    ? "You are completely caught up!"
                    : "When activities or updates happen, they will appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((item) => {
                const Icon = iconMap[item.icon] ?? FileText;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      "group relative flex cursor-pointer items-start gap-3 p-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                      item.unread && "bg-emerald-50/30 dark:bg-emerald-950/20"
                    )}
                  >
                    {/* Icon Tone */}
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs",
                        iconTones[item.iconTone] ?? iconTones.green
                      )}
                    >
                      <Icon size={14} strokeWidth={2} />
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="truncate text-[12.5px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
                          {item.title}
                        </p>
                        {item.unread && (
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                            aria-label="Unread"
                          />
                        )}
                      </div>

                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                        {item.description}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400 dark:text-slate-400">
                        {item.user && item.user !== "System" && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                            <UserRound size={10} />
                            {item.user}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={10} />
                          {item.timestamp}
                        </span>
                        {item.context && (
                          <span className="inline-flex items-center gap-1 truncate text-slate-400">
                            <Layers3 size={10} />
                            {item.context}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: View All Notifications Page Link */}
          <div className="border-t border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/90">
            <Link
              href={href}
              onClick={() => setIsOpen(false)}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-center text-[12px] font-semibold text-slate-700 shadow-xs ring-1 ring-slate-200/80 transition-all hover:bg-slate-50 hover:text-emerald-700 dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:ring-0 dark:hover:bg-slate-750 dark:hover:text-emerald-400"
            >
              <span>View all notifications</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
