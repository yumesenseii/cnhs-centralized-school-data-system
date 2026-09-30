"use client";

import { useEffect, useState } from "react";
import WelcomeLoginToast from "@/components/shared/WelcomeLoginToast";
import StudentSidebar from "@/components/student/layout/StudentSidebar";
import TopHeader from "@/components/layout/TopHeader";
import {
  SIDEBAR_CONTENT_OFFSET_CLASS,
  SIDEBAR_CONTENT_OFFSET_COLLAPSED_CLASS,
  SIDEBAR_WIDTH_CLASS,
  SIDEBAR_WIDTH_COLLAPSED_CLASS,
} from "@/lib/constants/layout";
import { cn } from "@/lib/utils";

const STUDENT_SIDEBAR_COLLAPSED_KEY = "cnhs-student-sidebar-collapsed";

function loadStudentSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STUDENT_SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveStudentSidebarCollapsed(collapsed) {
  try {
    window.localStorage.setItem(STUDENT_SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

export default function StudentShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(loadStudentSidebarCollapsed());
    setHydrated(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      saveStudentSidebarCollapsed(next);
      return next;
    });
  }

  const sidebarCollapsed = hydrated && collapsed;

  return (
    <div className="min-h-screen bg-cnhs-page">
      <WelcomeLoginToast />
      <StudentSidebar
        className="hidden lg:flex"
        collapsed={sidebarCollapsed}
        widthClass={
          sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED_CLASS : SIDEBAR_WIDTH_CLASS
        }
        onToggleCollapse={toggleCollapsed}
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
          role="student"
          mobileNavTitle="Student navigation"
          renderMobileNav={(close) => <StudentSidebar mobile onNavigate={close} />}
        />
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-3 py-3 sm:px-4 lg:px-4 lg:py-3">
          {children}
        </main>
      </div>
    </div>
  );
}
