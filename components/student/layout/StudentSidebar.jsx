"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { SIDEBAR_WIDTH_CLASS } from "@/lib/constants/layout";
import { SCHOOL_NAME } from "@/lib/constants/brand";
import { createClient } from "@/lib/supabase/client";
import { getCurrentStudentSession } from "@/lib/supabase/queries/studentPortal";
import LogoutConfirmModal from "@/components/shared/LogoutConfirmModal";
import { cn } from "@/lib/utils";

const menuNavigation = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutGrid },
  { label: "My Grades", href: "/student/grades", icon: BookOpen },
];

const analyticsNavigation = [
  {
    label: "Interventions / PLP",
    href: "/student/interventions",
    icon: ClipboardList,
  },
];

const accountNavigation = [
  { label: "Profile", href: "/student/profile", icon: UserRound },
];

function NavLink({ href, label, icon: Icon, isActive, onNavigate, collapsed = false }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
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
          {isActive ? <ChevronRight size={14} className="shrink-0 text-cnhs-green" /> : null}
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

export default function StudentSidebar({
  className,
  mobile = false,
  onNavigate,
  collapsed = false,
  widthClass = SIDEBAR_WIDTH_CLASS,
  onToggleCollapse,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState({
    initials: "S",
    name: "Student",
    role: "Student",
  });
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const showCollapseToggle = !mobile && typeof onToggleCollapse === "function";

  useEffect(() => {
    let cancelled = false;
    getCurrentStudentSession().then((result) => {
      if (cancelled || result.error || !result.data) return;
      const name =
        result.data.profile?.full_name ||
        [
          result.data.student?.first_name,
          result.data.student?.middle_name,
          result.data.student?.last_name,
        ]
          .filter(Boolean)
          .join(" ") ||
        "Student";
      const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      setProfile({ initials, name, role: "Student" });
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
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  function isActive(href) {
    return pathname === href || (href !== "/student/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside
      className={cn(
        "z-30 h-screen flex-col bg-cnhs-sidebar text-white transition-[width] duration-200",
        widthClass,
        mobile ? "flex h-full w-full" : "fixed inset-y-0 left-0",
        className
      )}
      aria-label="Student sidebar"
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

      <nav className="flex-1 space-y-2 overflow-y-auto px-3" aria-label="Student navigation">
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

      <div
        className={cn(
          "mt-auto space-y-2 border-t border-white/10 px-3 py-3",
          collapsed && "px-2"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg bg-white/5 px-2.5 py-2",
            collapsed && "justify-center px-2"
          )}
          title={profile.name}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cnhs-green/25 text-[11px] font-semibold text-[#7dd8a9]">
            {profile.initials}
          </div>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-white">{profile.name}</p>
                <p className="truncate text-[10px] text-white/50">{profile.role}</p>
              </div>
              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                aria-label="Log out"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : null}
        </div>
        {collapsed ? (
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            title="Log out"
            aria-label="Log out"
            className="flex h-9 w-full cursor-pointer items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        ) : null}
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
