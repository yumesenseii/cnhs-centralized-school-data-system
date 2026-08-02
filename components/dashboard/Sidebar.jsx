"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { dashboardData } from "@/data/dashboard";
import { cn } from "@/lib/utils";

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  records: BookOpen,
  lesson: FileText,
  reports: BarChart3,
  users: Users,
  notifications: Bell,
  settings: Settings,
};

export default function Sidebar({ className, mobile = false, onNavigate }) {
  const pathname = usePathname();
  const { navigation, profile } = dashboardData;

  return (
    <aside
      className={cn(
        "z-30 h-screen w-[272px] flex-col bg-cnhs-sidebar text-white",
        mobile ? "flex h-full w-full" : "fixed inset-y-0 left-0",
        className
      )}
      aria-label="Admin sidebar"
    >
      <div className="flex items-center gap-3 px-5 pb-4 pt-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 shadow-sm">
          <Image
            src="/cnhs-logo.png"
            alt="Cambaog National High School logo"
            width={40}
            height={40}
            priority
            className="h-full w-full rounded-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-5 text-white">CNHS Admin</p>
          <p className="truncate text-[11px] leading-4 text-white/60">
            Cambaog National High School
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3" aria-label="Admin navigation">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Menu
        </p>
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = NAV_ICONS[item.icon] ?? LayoutDashboard;
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200",
                  "hover:bg-white/8 hover:text-white",
                  isActive ? "bg-cnhs-green/20 text-[#7dd8a9]" : "text-white/68"
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={1.9}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-cnhs-green" : "text-white/45 group-hover:text-white/75"
                  )}
                />
                <span className="truncate">{item.label}</span>
                {isActive ? <ChevronRight size={15} className="ml-auto text-cnhs-green" /> : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto space-y-3 px-3 pb-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cnhs-green text-xs font-semibold text-white">
            {profile.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{profile.name}</p>
            <p className="truncate text-xs text-white/55">{profile.role}</p>
          </div>
        </div>
        <button
          type="button"
          className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium text-white/72 transition-colors duration-200 hover:bg-white/8 hover:text-white"
        >
          <LogOut size={16} strokeWidth={1.9} />
          Logout
        </button>
      </div>
    </aside>
  );
}
