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
  FileText,
  Layers3,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { SIDEBAR_WIDTH_CLASS } from "@/lib/constants/layout";
import { SCHOOL_NAME } from "@/lib/constants/brand";
import { clearAdminMonitoringUiSnapshot } from "@/lib/admin/adminMonitoringUiCache";
import { createClient } from "@/lib/supabase/client";
import LogoutConfirmModal from "@/components/shared/LogoutConfirmModal";
import { cn } from "@/lib/utils";

const menuNavigation = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Academic Records", href: "/academic-records", icon: BookOpen },
  { label: "Classes & Sections", href: "/class-organization", icon: Layers3 },
  { label: "Lesson Plan Review", href: "/lesson-plan-review", icon: FileText },
  { label: "User Management", href: "/user-management", icon: Users },
];

const analyticsNavigation = [
  { label: "Academic Monitoring", href: "/monitoring", icon: Activity },
  { label: "Attendance Monitoring", href: "/attendance", icon: CalendarDays },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

const accountNavigation = [
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

function initialsFromName(name = "") {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "HT"
  );
}

function NavLink({ href, label, icon: Icon, isActive, onNavigate, collapsed }) {
  return (
    <Link
      href={href}
      scroll={!isActive}
      onClick={(event) => {
        // Already on this route — skip navigation so the page does not remount/refetch.
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
        "group flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-200",
        "hover:bg-white/8 hover:text-white",
        collapsed && "justify-center px-2",
        isActive ? "bg-cnhs-green/20 text-[#7dd8a9]" : "text-white/70"
      )}
    >
      <Icon
        size={16}
        strokeWidth={1.9}
        className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-cnhs-green" : "text-white/45 group-hover:text-white/75"
        )}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 leading-5">{label}</span>
          {isActive ? (
            <ChevronRight size={14} className="shrink-0 text-cnhs-green" />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function NavSection({ title, children, collapsed }) {
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

export default function Sidebar({
  className,
  mobile = false,
  onNavigate,
  collapsed = false,
  widthClass = SIDEBAR_WIDTH_CLASS,
  schoolName = SCHOOL_NAME,
  onToggleCollapse,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState({
    initials: "HT",
    name: "Head Teacher",
    role: "Head Teacher",
  });
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const showCollapseToggle = !mobile && typeof onToggleCollapse === "function";

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: authData }) => {
      if (cancelled || !authData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();
      if (cancelled || !data) return;
      const name = data.full_name?.trim() || "Head Teacher";
      setProfile({
        initials: initialsFromName(name),
        name,
        role: data.role === "admin" ? "Head Teacher" : "Admin",
      });
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
      clearAdminMonitoringUiSnapshot();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  function isActive(href) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside
      className={cn(
        "z-30 h-screen flex-col bg-cnhs-sidebar text-white transition-[width] duration-200",
        widthClass,
        mobile ? "flex h-full w-full" : "fixed inset-y-0 left-0",
        className
      )}
      aria-label="Admin sidebar"
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
                {String(schoolName ?? "").trim() || SCHOOL_NAME}
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
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/8 hover:text-white"
          >
            {collapsed ? (
              <PanelLeftOpen size={16} strokeWidth={1.9} />
            ) : (
              <PanelLeftClose size={16} strokeWidth={1.9} />
            )}
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3" aria-label="Admin navigation">
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
            />
          ))}
        </NavSection>
      </nav>

      <div className={cn("mt-auto space-y-2 px-3 pb-3", collapsed && "px-2")}>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-white/10 px-2.5 py-2",
            collapsed && "justify-center px-2"
          )}
          title={profile.name}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cnhs-green text-[11px] font-semibold text-white">
            {profile.initials}
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold leading-4 text-white">
                {profile.name}
              </p>
              <p className="truncate text-[10px] leading-4 text-white/55">
                {profile.role}
              </p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          title="Logout"
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium text-white/72 transition-colors duration-200 hover:bg-white/8 hover:text-white",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut size={16} strokeWidth={1.9} />
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

