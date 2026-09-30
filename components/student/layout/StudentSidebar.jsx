"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  HeartHandshake,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { SIDEBAR_WIDTH_CLASS } from "@/lib/constants/layout";
import { SCHOOL_NAME } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

const menuNavigation = [
  { label: "Dashboard", href: "/student/dashboard", icon: LayoutGrid },
  { label: "My Grades", href: "/student/grades", icon: BookOpen },
  { label: "My Attendance", href: "/student/attendance", icon: CalendarDays },
  {
    label: "My Interventions",
    href: "/student/interventions",
    icon: HeartHandshake,
  },
];

function NavLink({ href, label, icon: Icon, isActive, onNavigate, collapsed = false }) {
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
        "group relative flex min-h-[42px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all duration-200",
        "hover:bg-white/8 hover:text-white",
        collapsed && "justify-center px-2 min-h-10",
        isActive
          ? "bg-white/10 text-[#7dd8a9]"
          : "text-white/70"
      )}
    >
      {isActive && !collapsed ? (
        <span
          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#7dd8a9]"
          aria-hidden="true"
        />
      ) : null}
      <Icon
        size={18}
        strokeWidth={1.9}
        className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-[#7dd8a9]" : "text-white/50 group-hover:text-white/80"
        )}
      />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 leading-5 truncate">{label}</span>
          {isActive ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dd8a9] shrink-0" aria-hidden="true" />
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function NavSection({ title, children, collapsed = false }) {
  return (
    <div className="py-1">
      {!collapsed ? (
        <p className="mb-2 px-3.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/40">
          {title}
        </p>
      ) : null}
      <div className="space-y-1">{children}</div>
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
  const showCollapseToggle = !mobile && typeof onToggleCollapse === "function";

  function isActive(href) {
    return pathname === href || (href !== "/student/dashboard" && pathname.startsWith(href));
  }

  return (
    <aside
      className={cn(
        "z-30 h-screen flex-col border-r border-white/10 bg-cnhs-sidebar text-white transition-[width] duration-200",
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
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors duration-200 hover:bg-white/8 hover:text-white"
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
      </nav>

      <div className="pb-4" />
    </aside>
  );
}
