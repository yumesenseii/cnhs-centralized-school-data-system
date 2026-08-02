"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Sidebar from "@/components/layout/Sidebar";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

export default function Header({ breadcrumb, title, description, controls }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400">{breadcrumb}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
            {title}
          </h1>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="Open admin menu"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 lg:hidden"
              />
            }
          >
            <Menu size={18} aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className={SIDEBAR_SHEET_CLASS}
          >
            <SheetTitle className="sr-only">Admin navigation</SheetTitle>
            <Sidebar mobile onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {controls ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto sm:justify-end">
          {controls}
        </div>
      ) : null}
    </header>
  );
}
