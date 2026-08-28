"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import LearnersInterventionTable from "@/components/teacher/monitoring/LearnersInterventionTable";
import {
  filterAralMonitoredStudents,
  filterNonAralAtRiskMonitoredStudents,
} from "@/lib/teacher/monitoringMappers";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const SUBVIEWS = [
  { id: "aral", label: "ARAL Learners" },
  { id: "nonAral", label: "At-Risk · Non-ARAL" },
];

export default function AdminMonitoredStudentsPanel({
  learners = [],
  schoolYear = "",
  quarter = "All Terms",
  onViewMonitoring,
  loading = false,
}) {
  const [subview, setSubview] = useState("aral");
  const [aralPage, setAralPage] = useState(1);
  const [nonAralPage, setNonAralPage] = useState(1);

  const aralLearners = useMemo(
    () => filterAralMonitoredStudents(learners),
    [learners]
  );
  const nonAralLearners = useMemo(
    () => filterNonAralAtRiskMonitoredStudents(learners),
    [learners]
  );

  const activeLearners = subview === "aral" ? aralLearners : nonAralLearners;
  const activePage = subview === "aral" ? aralPage : nonAralPage;
  const setActivePage = subview === "aral" ? setAralPage : setNonAralPage;

  const pagedLearners = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return activeLearners.slice(start, start + PAGE_SIZE);
  }, [activeLearners, activePage]);

  const atRiskCount = useMemo(
    () => activeLearners.filter((learner) => learner.atRisk).length,
    [activeLearners]
  );

  useEffect(() => {
    setAralPage(1);
    setNonAralPage(1);
  }, [learners.length, schoolYear, quarter]);

  if (loading && learners.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-10 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" />
        Loading monitoring data…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Monitored students views"
      >
        {SUBVIEWS.map((item) => {
          const selected = subview === item.id;
          const count =
            item.id === "aral" ? aralLearners.length : nonAralLearners.length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setSubview(item.id);
                if (item.id === "aral") setAralPage(1);
                else setNonAralPage(1);
              }}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors",
                selected
                  ? "bg-cnhs-green-dark text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <LearnersInterventionTable
        learners={pagedLearners}
        totalCount={activeLearners.length}
        atRiskCount={atRiskCount}
        page={activePage}
        pageSize={PAGE_SIZE}
        onPageChange={setActivePage}
        schoolYear={schoolYear}
        quarter={quarter}
        onViewMonitoring={onViewMonitoring}
        title={
          subview === "aral"
            ? "ARAL Learners"
            : "At-Risk Students (Non-ARAL)"
        }
        layout={subview === "aral" ? "htAral" : "htNonAral"}
        showAralApproval={subview === "aral"}
        emptyMessage={
          subview === "aral"
            ? "No ARAL-recommended learners under the current filters."
            : "No at-risk non-ARAL learners under the current filters."
        }
      />
    </div>
  );
}
