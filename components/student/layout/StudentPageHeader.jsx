"use client";

import MobileNavSheet from "@/components/layout/MobileNavSheet";
import StudentSidebar from "@/components/student/layout/StudentSidebar";

export default function StudentPageHeader({
  breadcrumb = "Home",
  title,
  subtitle,
  actions = null,
}) {
  return (
    <header className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-400">{breadcrumb}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <MobileNavSheet ariaLabel="Open student menu" title="Student navigation">
          {(close) => <StudentSidebar mobile onNavigate={close} />}
        </MobileNavSheet>
      </div>
    </header>
  );
}
