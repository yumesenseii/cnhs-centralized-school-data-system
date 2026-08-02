"use client";

import { motion } from "framer-motion";
import { CheckCheck, Trash2 } from "lucide-react";
import Header from "@/components/layout/Header";
import NotificationFilters from "@/components/notifications/NotificationFilters";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationSearch from "@/components/notifications/NotificationSearch";
import NotificationStats from "@/components/notifications/NotificationStats";
import RecentActivity from "@/components/notifications/RecentActivity";
import { notificationsData } from "@/data/notifications";
import { recentActivityData } from "@/data/recentActivity";

function HeaderControls() {
  return (
    <>
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <CheckCheck size={13} />
        Mark All as Read
      </button>
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <Trash2 size={13} />
        Clear Read
      </button>
    </>
  );
}

export default function NotificationsPage() {
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
        description="Monitor teacher submissions, academic record validation, lesson plan reviews, monitoring updates, report generation, and other system activities."
        controls={<HeaderControls />}
      />

      <NotificationStats cards={notificationsData.summaryCards} />

      <section className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <NotificationSearch />
          <div className="md:ml-auto">
            <NotificationFilters filters={notificationsData.filters} />
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <NotificationList notifications={notificationsData.notifications} />
        <RecentActivity title={recentActivityData.title} items={recentActivityData.items} />
      </div>
    </motion.div>
  );
}
