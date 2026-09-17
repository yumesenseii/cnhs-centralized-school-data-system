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
    <header className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground">{breadcrumb}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-[22px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <MobileNavSheet ariaLabel="Open student menu" title="Student navigation">
          {(close) => <StudentSidebar mobile onNavigate={close} />}
        </MobileNavSheet>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
