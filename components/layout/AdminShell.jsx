"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
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
} from "@/lib/settings/adminSettingsStorage";
import { cn } from "@/lib/utils";

/**
 * Admin shell: applies saved appearance + school branding from localStorage.
 */
export default function AdminShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [schoolName, setSchoolName] = useState("Cambaog National High School");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    applyAppearanceToDocument();
    const appearance = loadAppearanceSettings();
    setCollapsed(appearance.sidebar === "collapsed");
    const school = loadSchoolSettings();
    setSchoolName(school.schoolName || "Cambaog National High School");
    setHydrated(true);

    function onSettingsChange() {
      applyAppearanceToDocument();
      const nextAppearance = loadAppearanceSettings();
      setCollapsed(nextAppearance.sidebar === "collapsed");
      const nextSchool = loadSchoolSettings();
      setSchoolName(nextSchool.schoolName || "Cambaog National High School");
    }

    window.addEventListener("storage", onSettingsChange);
    window.addEventListener("cnhs-admin-settings", onSettingsChange);
    return () => {
      window.removeEventListener("storage", onSettingsChange);
      window.removeEventListener("cnhs-admin-settings", onSettingsChange);
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
      />
      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200",
          sidebarCollapsed
            ? SIDEBAR_CONTENT_OFFSET_COLLAPSED_CLASS
            : SIDEBAR_CONTENT_OFFSET_CLASS
        )}
      >
        <main className="mx-auto w-full max-w-[1180px] px-3 py-3 sm:px-4 lg:px-4 lg:py-3">
          {children}
        </main>
      </div>
    </div>
  );
}
