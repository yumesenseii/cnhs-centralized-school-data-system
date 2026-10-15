"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopHeader from "@/components/layout/TopHeader";
import WelcomeLoginToast from "@/components/shared/WelcomeLoginToast";
import {
  SIDEBAR_CONTENT_OFFSET_CLASS,
  SIDEBAR_CONTENT_OFFSET_COLLAPSED_CLASS,
  SIDEBAR_WIDTH_CLASS,
  SIDEBAR_WIDTH_COLLAPSED_CLASS,
} from "@/lib/constants/layout";
import {
  applyAppearanceToDocument,
  loadAppearanceSettings,
  loadSchoolSettings,
  saveAppearanceSettings,
  syncSchoolSettingsFromDb,
} from "@/lib/settings/adminSettingsStorage";
import { countPendingDeleteRequests } from "@/lib/supabase/queries/deleteRequests";
import { cn } from "@/lib/utils";

/**
 * Admin shell: applies saved appearance + school branding from database and localStorage.
 */
export default function AdminShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [schoolName, setSchoolName] = useState("Cambaog National High School");
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    applyAppearanceToDocument();
    const appearance = loadAppearanceSettings();
    setCollapsed(appearance.sidebar === "collapsed");
    const school = loadSchoolSettings();
    setSchoolName(school.schoolName || "Cambaog National High School");
    setHydrated(true);

    // Sync canonical school branding from Supabase
    syncSchoolSettingsFromDb().then((synced) => {
      if (synced?.schoolName) setSchoolName(synced.schoolName);
    });

    // Fetch pending delete requests count
    function refreshDeleteRequestsCount() {
      countPendingDeleteRequests().then((res) => {
        if (typeof res?.count === "number") {
          setPendingDeleteCount(res.count);
        }
      });
    }

    refreshDeleteRequestsCount();

    function onSettingsChange() {
      applyAppearanceToDocument();
      const nextAppearance = loadAppearanceSettings();
      setCollapsed(nextAppearance.sidebar === "collapsed");
      const nextSchool = loadSchoolSettings();
      setSchoolName(nextSchool.schoolName || "Cambaog National High School");
    }

    window.addEventListener("storage", onSettingsChange);
    window.addEventListener("cnhs-admin-settings", onSettingsChange);
    window.addEventListener("cnhs-delete-requests-updated", refreshDeleteRequestsCount);
    return () => {
      window.removeEventListener("storage", onSettingsChange);
      window.removeEventListener("cnhs-admin-settings", onSettingsChange);
      window.removeEventListener("cnhs-delete-requests-updated", refreshDeleteRequestsCount);
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      const current = loadAppearanceSettings();
      saveAppearanceSettings({
        ...current,
        sidebar: next ? "collapsed" : "expanded",
      });
      return next;
    });
  }

  const sidebarCollapsed = hydrated && collapsed;

  return (
    <div className="min-h-screen bg-cnhs-page">
      <WelcomeLoginToast />
      <Sidebar
        className="hidden lg:flex"
        collapsed={sidebarCollapsed}
        widthClass={
          sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED_CLASS : SIDEBAR_WIDTH_CLASS
        }
        schoolName={schoolName}
        onToggleCollapse={toggleCollapsed}
        pendingDeleteRequestsCount={pendingDeleteCount}
      />
      <div
        className={cn(
          "min-h-screen flex flex-col transition-[padding] duration-200",
          sidebarCollapsed
            ? SIDEBAR_CONTENT_OFFSET_COLLAPSED_CLASS
            : SIDEBAR_CONTENT_OFFSET_CLASS
        )}
      >
        <TopHeader
          role="admin"
          mobileNavTitle="Admin navigation"
          renderMobileNav={(close) => (
            <Sidebar
              mobile
              onNavigate={close}
              pendingDeleteRequestsCount={pendingDeleteCount}
            />
          )}
        />
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-3 py-3 sm:px-4 lg:px-4 lg:py-3">
          {children}
        </main>
      </div>
    </div>
  );
}
