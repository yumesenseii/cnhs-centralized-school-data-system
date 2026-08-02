"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import SectionManagement from "@/components/section-management/SectionManagement";
import ClassAssignmentManagement from "@/components/class-assignments/ClassAssignmentManagement";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "sections", label: "Sections" },
  { id: "assignments", label: "Class Assignments" },
];

export default function ClassOrganizationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = useMemo(() => {
    const raw = searchParams.get("tab");
    return raw === "assignments" ? "assignments" : "sections";
  }, [searchParams]);

  const setTab = useCallback(
    (tabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tabId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / Classes & Sections"
        title="Classes & Sections"
        description="Manage grade sections and assign teachers to subjects by school year and quarter."
      />

      <div
        className="mb-4 flex items-end gap-5 border-b border-slate-200"
        role="tablist"
        aria-label="Classes and sections tabs"
      >
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(tab.id)}
              className={cn(
                "-mb-px cursor-pointer border-b-2 px-0.5 pb-2.5 text-[13px] transition-colors",
                selected
                  ? "border-cnhs-green-dark font-semibold text-cnhs-green-dark"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {activeTab === "sections" ? (
          <SectionManagement embedded />
        ) : (
          <ClassAssignmentManagement embedded />
        )}
      </div>
    </motion.div>
  );
}
