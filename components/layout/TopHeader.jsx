"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import NotificationHeaderBell from "@/components/layout/NotificationHeaderBell";
import UserProfileDropdown from "@/components/layout/UserProfileDropdown";
import LogoutConfirmModal from "@/components/shared/LogoutConfirmModal";
import { useTheme } from "@/components/theme/ThemeProvider";
import { clearAdminMonitoringUiSnapshot } from "@/lib/admin/adminMonitoringUiCache";
import { clearTeacherMonitoringUiSnapshot } from "@/lib/teacher/teacherMonitoringUiCache";
import { createClient } from "@/lib/supabase/client";
import { getCurrentTeacherSession, getTeacherClasses } from "@/lib/supabase/queries/myClasses";
import { getCurrentStudentSession } from "@/lib/supabase/queries/studentPortal";
import { cn } from "@/lib/utils";

function initialsFromName(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

/**
 * Global Top Header bar rendered across all portals (Admin, Teacher, Student).
 * Features Mobile menu trigger, Theme switcher, Notification bell with live badge,
 * and Rich User Profile Dropdown with department badge, settings link, and logout.
 */
export default function TopHeader({
  role = "admin",
  renderMobileNav = null,
  mobileNavTitle = "Navigation",
  className,
}) {
  const router = useRouter();
  const { resolvedTheme, hydrated, setTheme } = useTheme();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [profile, setProfile] = useState({
    name: "Dulce Galang",
    initials: "DG",
    role: "School Principal",
    subtitle: "School Principal · Admin",
    email: "",
    handledSubjects: [],
    detailLabel: "",
    detailValue: "",
  });

  const isDark = resolvedTheme === "dark";

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  // Load role-specific profile details
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function loadData() {
      if (role === "admin") {
        const { data: authData } = await supabase.auth.getUser();
        if (cancelled || !authData?.user) return;

        const { data } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();

        if (cancelled) return;
        const rawName = data?.full_name?.trim() || "";
        const isSeedPlaceholder =
          !rawName ||
          ["head teacher", "admin", "principal", "school principal", "user", "personnel"].includes(
            rawName.toLowerCase()
          );
        const name = isSeedPlaceholder ? "Dulce Galang" : rawName;
        setProfile({
          name,
          initials: initialsFromName(name),
          role: "School Principal",
          subtitle: "School Principal · Admin",
          email: authData.user.email || "",
          handledSubjects: [],
          detailLabel: "Office / Department",
          detailValue: "Principal's Office · Bulacan Division",
        });
      } else if (role === "teacher") {
        const result = await getCurrentTeacherSession();
        if (cancelled) return;

        if (result.data?.teacher) {
          const t = result.data.teacher;
          const name = [t.first_name, t.last_name].filter(Boolean).join(" ");

          let handledSubjects = [];
          if (t.id) {
            try {
              const classesResult = await getTeacherClasses(t.id);
              if (classesResult.data && Array.isArray(classesResult.data)) {
                handledSubjects = [
                  ...new Set(
                    classesResult.data
                      .map((c) => c.subjects?.subject_name)
                      .filter(Boolean)
                  ),
                ];
              }
            } catch (err) {
              console.warn("[TopHeader] failed to load teacher classes", err);
            }
          }

          if (handledSubjects.length === 0 && t.learning_area) {
            handledSubjects = [t.learning_area];
          }

          const primarySubject =
            handledSubjects.length > 0
              ? handledSubjects.join(", ")
              : (t.learning_area || "Faculty Member");

          setProfile({
            name: name || "Teacher",
            initials: initialsFromName(name),
            role: "Teacher / Faculty",
            subtitle: `Faculty · ${primarySubject}`,
            email: t.email || "",
            handledSubjects,
            detailLabel: handledSubjects.length > 1 ? "Handled Subjects" : "Handled Subject",
            detailValue: primarySubject,
          });
        }
      } else if (role === "student") {
        const result = await getCurrentStudentSession();
        if (cancelled) return;

        if (result.data?.student) {
          const s = result.data.student;
          const name = [s.first_name, s.last_name].filter(Boolean).join(" ");
          const sectionName = s.sections?.section_name || "";
          const gradeLevel = s.sections?.grade_level ? `Grade ${s.sections.grade_level}` : "";
          const gradeSection = [gradeLevel, sectionName].filter(Boolean).join(" - ");
          setProfile({
            name: name || "Student",
            initials: initialsFromName(name),
            role: "Learner",
            subtitle: gradeSection || "CNHS Learner",
            email: s.email || "",
            handledSubjects: [],
            detailLabel: "Grade & Section",
            detailValue: gradeSection || "Enrolled Learner",
          });
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [role]);

  // Determine paths based on portal role
  const settingsHref =
    role === "teacher"
      ? "/teacher/settings"
      : role === "student"
      ? "/student/profile"
      : "/settings";

  const notificationsHref =
    role === "teacher"
      ? "/teacher/notifications"
      : role === "student"
      ? "/student/dashboard"
      : "/notifications";

  async function confirmLogoutAction() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { portal_role: null, portal_active: null },
      });
      await supabase.auth.signOut();
      clearAdminMonitoringUiSnapshot();
      clearTeacherMonitoringUiSnapshot();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-900/80 sm:px-6 lg:px-8",
          className
        )}
      >
        {/* Left Side: Mobile Hamburger & School Branding on small screens */}
        <div className="flex items-center gap-3">
          {renderMobileNav ? (
            <div className="lg:hidden">
              <MobileNavSheet
                ariaLabel={`Open ${mobileNavTitle}`}
                title={mobileNavTitle}
              >
                {renderMobileNav}
              </MobileNavSheet>
            </div>
          ) : null}
        </div>

        {/* Right Side Controls: Theme Toggle + Notification Bell + User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Switcher */}
          {hydrated ? (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {isDark ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
            </button>
          ) : null}

          {/* Notification Bell */}
          <NotificationHeaderBell href={notificationsHref} />

          {/* User Profile Dropdown Pill */}
          <UserProfileDropdown
            name={profile.name}
            initials={profile.initials}
            role={profile.role}
            subtitle={profile.subtitle}
            email={profile.email}
            detailLabel={profile.detailLabel}
            detailValue={profile.detailValue}
            handledSubjects={profile.handledSubjects}
            settingsHref={settingsHref}
            onLogout={() => setLogoutOpen(true)}
            avatarBgColor="bg-cnhs-sidebar"
          />
        </div>
      </header>

      {/* Shared Logout Confirmation Modal */}
      <LogoutConfirmModal
        open={logoutOpen}
        confirming={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={confirmLogoutAction}
      />
    </>
  );
}
