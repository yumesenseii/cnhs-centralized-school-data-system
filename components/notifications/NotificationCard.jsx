"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  BarChart3,
  ClipboardList,
  Layers3,
  RefreshCw,
  Upload,
  UserRound,
} from "lucide-react";
import ActionButton from "@/components/notifications/ActionButton";
import ModuleBadge from "@/components/notifications/ModuleBadge";
import PriorityBadge from "@/components/notifications/PriorityBadge";
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
  green: "bg-green-50 text-cnhs-green-dark",
  teal: "bg-teal-50 text-teal-700",
  violet: "bg-violet-50 text-violet-700",
  orange: "bg-orange-50 text-cnhs-orange",
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
};

export default function NotificationCard({ notification, onAction, onMarkRead }) {
  const Icon = iconMap[notification.icon] ?? FileText;

  return (
    <motion.article
      whileHover={{ y: -1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "rounded-xl border bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-3.5",
        notification.unread ? "border-cnhs-green/25" : "border-slate-100"
      )}
    >
      <div className="flex gap-3.5">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            iconTones[notification.iconTone] ?? iconTones.green
          )}
        >
          <Icon size={18} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-900">
                  {notification.title}
                </h3>
                {notification.unread ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-cnhs-green"
                    aria-label="Unread"
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                {notification.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <PriorityBadge value={notification.priority} />
              <ModuleBadge label={notification.module} tone={notification.moduleTone} />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={12} />
                {notification.user}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={12} />
                {notification.timestamp}
              </span>
              {notification.context ? (
                <span className="inline-flex items-center gap-1.5">
                  <Layers3 size={12} />
                  {notification.context}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onMarkRead && notification.unread ? (
                <button
                  type="button"
                  onClick={() => onMarkRead(notification)}
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
                >
                  <Check size={13} strokeWidth={2.2} />
                  Mark as Read
                </button>
              ) : null}
              {notification.actionLabel ? (
                <ActionButton
                  label={notification.actionLabel}
                  onClick={onAction ? () => onAction(notification) : undefined}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
