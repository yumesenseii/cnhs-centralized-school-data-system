"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import LogoutConfirmModal from "@/components/shared/LogoutConfirmModal";
import { useUnreadNotificationCount } from "@/hooks/teacher/useUnreadNotificationCount";
import { SIDEBAR_WIDTH_CLASS } from "@/lib/constants/layout";
import { SCHOOL_NAME } from "@/lib/constants/brand";
import { createClient } from "@/lib/supabase/client";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { clearTeacherMonitoringUiSnapshot } from "@/lib/teacher/teacherMonitoringUiCache";
import { cn } from "@/lib/utils";

const menuNavigation = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutGrid },
  { label: "My Classes", href: "/teacher/my-classes", icon: BookOpen },
  { label: "Input Grades", href: "/teacher/input-grades", icon: CloudUpload },
  { label: "Lesson Plans", href: "/teacher/lesson-plans", icon: ClipboardList },
];

const analyticsNavigation = [
  { label: "Academic Monitoring", href: "/teacher/monitoring", icon: Activity },
  { label: "ARAL Program", href: "/teacher/aral-program", icon: GraduationCap },
  { label: "Attendance Monitoring", href: "/teacher/attendance", icon: CalendarDays },
  { label: "Reports", href: "/teacher/reports", icon: BarChart3 },
];

const accountNavigation = [
  { label: "Notifications", href: "/teacher/notifications", icon: Bell },
  { label: "Settings", href: "/teacher/settings", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
  badge = 0,
  collapsed = false,
}) {
  return (
    <Link
      href={href}
      scroll={!isActive}
      onClick={(event) => {
        if (isActive) {
          event.preventDefault();
          onNavigate?.(event);
          return;
        }
        onNavigate?.(event);
      }}
      title={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-200",
        "hover:bg-white/8 hover:text-white",
        collapsed && "justify-center px-2",
        isActive ? "bg-cnhs-green/25 text-[#7dd8a9]" : "text-white/70"
      )}
    >
      {isActive && !collapsed ? (
        <span
          className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-cnhs-green"
          aria-hidden="true"
        />
      ) : null}
      <span className="relative shrink-0">
        <Icon
          size={16}
          strokeWidth={1.9}
          className={cn(
            "transition-colors",
            isActive ? "text-cnhs-green" : "text-white/45 group-hover:text-white/75"
          )}
        />
        {collapsed && badge > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cnhs-green ring-2 ring-cnhs-sidebar"
            aria-label={`${badge} unread`}
          />
        ) : null}
      </span>
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 leading-5">{label}</span>
          {badge > 0 ? (
            <span
              className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-cnhs-green px-1.5 text-[10px] font-semibold leading-none text-white"
              aria-label={`${badge} unread`}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
          {isActive ? (
            <ChevronRight size={14} className="shrink-0 text-cnhs-green" />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function NavSection({ title, children, collapsed = false }) {
  return (
    <div>
      {!collapsed ? (
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          {title}
        </p>
      ) : null}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export default function TeacherSidebar({
  className,
  mobile = false,
  onNavigate,
  collapsed = false,
  widthClass = SIDEBAR_WIDTH_CLASS,
  onToggleCollapse,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, hydrated, setTheme } = useTheme();
  const [profile, setProfile] = useState({
    initials: "T",
    name: "Teacher",
    role: "Teacher",
  });
  const { count: unreadCount } = useUnreadNotificationCount();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isDark = resolvedTheme === "dark";
  const showCollapseToggle = !mobile && typeof onToggleCollapse === "function";

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  useEffect(() => {
    let cancelled = false;
    getCurrentTeacherSession().then((result) => {
      if (cancelled || result.error || !result.data) return;
      const name =
        result.data.profile?.full_name ||
        [
          result.data.teacher?.first_name,
          result.data.teacher?.middle_name,
          result.data.teacher?.last_name,
        ]
          .filter(Boolean)
          .join(" ") ||
        "Teacher";
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      setProfile({ initials, name, role: "Teacher" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmLogoutAction() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { portal_role: null, portal_active: null },
      });
      await supabase.auth.signOut();
      clearTeacherMonitoringUiSnapshot();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  function isActive(href) {
    return pathname === href || (href !== "/teacher/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside
      className={cn(
        "z-30 h-screen flex-col bg-cnhs-sidebar text-white transition-[width] duration-200 dark:bg-black",
        widthClass,
        mobile ? "flex h-full w-full" : "fixed inset-y-0 left-0",
        className
      )}
      aria-label="Teacher sidebar"
    >
      <div
        className={cn(
          "flex px-3 pb-3 pt-3",
          collapsed && !mobile
            ? "flex-col items-center gap-1.5 px-2"
            : "items-center gap-2"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-2.5",
            !collapsed && "min-w-0 flex-1"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-sm">
            <Image
              src="/cnhs-logo.png"
              alt="Cambaog National High School logo"
              width={34}
              height={34}
              priority
              className="h-full w-full rounded-md object-cover"
            />
          </div>
          {!collapsed ? (
            <div className="min-w-0 pt-0.5">
              <p className="truncate text-[13px] font-semibold leading-5 text-white">
                CNHS Learn
              </p>
              <p className="line-clamp-2 text-[11px] leading-4 text-white/58">
                {SCHOOL_NAME}
              </p>
            </div>
          ) : null}
        </div>
        {showCollapseToggle ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.9} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.9} />
            )}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3" aria-label="Teacher navigation">
        <NavSection title="Menu" collapsed={collapsed}>
          {menuNavigation.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>

        <div className="mx-3 my-0.5 border-t border-white/10" />

        <NavSection title="Analytics" collapsed={collapsed}>
          {analyticsNavigation.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>

        <div className="mx-3 my-0.5 border-t border-white/10" />

        <NavSection title="Account" collapsed={collapsed}>
          {accountNavigation.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
              onNavigate={onNavigate}
              badge={item.href === "/teacher/notifications" ? unreadCount : 0}
            />
          ))}
        </NavSection>
      </nav>

      <div className={cn("mt-auto space-y-2 px-3 pb-3 pt-2", collapsed && "px-2")}>
        {hydrated ? (
          <div className={cn("flex px-0.5", collapsed ? "justify-center" : "justify-end")}>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Light mode" : "Dark mode"}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            >
              {isDark ? <Sun size={15} strokeWidth={1.9} /> : <Moon size={15} strokeWidth={1.9} />}
            </button>
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-white/8 px-2.5 py-2",
            collapsed && "justify-center px-2"
          )}
          title={profile.name}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cnhs-green text-[11px] font-semibold text-white">
            {profile.initials}
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-white">{profile.name}</p>
              <p className="truncate text-[10px] text-white/55">{profile.role}</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          title="Logout"
          className={cn(
            "inline-flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={16} />
          {!collapsed ? "Logout" : null}
        </button>
      </div>

      <LogoutConfirmModal
        open={logoutOpen}
        confirming={loggingOut}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
        onConfirm={confirmLogoutAction}
      />
    </aside>
  );
}
