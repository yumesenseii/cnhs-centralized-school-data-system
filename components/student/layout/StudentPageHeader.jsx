"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import StudentSidebar from "@/components/student/layout/StudentSidebar";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function StudentPageHeader({
  breadcrumb = "Home",
  title,
  subtitle,
  actions = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-400">{breadcrumb}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-slate-800">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="Open student menu"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
              />
            }
          >
            <Menu size={18} />
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className={SIDEBAR_SHEET_CLASS}
          >
            <SheetTitle className="sr-only">Student navigation</SheetTitle>
            <StudentSidebar mobile onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
