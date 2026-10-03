"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, ChevronDown, Info, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

function RiskRow({ title, colorClass, bgClass, borderClass, weakAreas = [], prev = 0, curr = 0, isExpanded, onToggle }) {
  const diff = curr - prev;
  const increased = diff > 0;
  const decreased = diff < 0;

  return (
    <div className={cn("overflow-hidden rounded-xl border transition-colors", borderClass, isExpanded ? bgClass : "bg-white")}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3 hover:bg-slate-50/50 sm:px-4"
      >
        <div className="flex items-center gap-3">
          <div className={cn("flex h-2 w-2 rounded-full", colorClass.replace("text-", "bg-").replace("600", "500").replace("700", "500"))} />
          <span className={cn("text-sm font-semibold", colorClass)}>{title}</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden items-center gap-4 sm:flex text-xs font-medium text-slate-500">
            <span className="w-12 text-right">Prev <strong className="text-slate-700">{prev}</strong></span>
            <span className="w-12 text-right">Curr <strong className="text-slate-700">{curr}</strong></span>
          </div>

          <div className={cn(
            "flex w-16 items-center justify-end gap-1 text-xs font-bold",
            increased ? "text-amber-600" : decreased ? "text-emerald-600" : "text-slate-400"
          )}>
            {increased ? <TrendingUp size={14} /> : decreased ? <TrendingDown size={14} /> : <Minus size={14} />}
            <span>{Math.abs(diff)}</span>
          </div>

          <ChevronDown
            size={16}
            className={cn("text-slate-400 transition-transform duration-200", isExpanded && "rotate-180")}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-black/5 p-4 sm:px-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                
                <div className="space-y-3">
                  <div className="flex gap-6 text-sm">
                    <div className="flex flex-col">
                      <span className="text-slate-500">Current</span>
                      <span className="font-semibold text-slate-900">{curr} learners</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500">Previous</span>
                      <span className="font-semibold text-slate-900">{prev} learners</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-500">Change</span>
                      <span className={cn("font-semibold", increased ? "text-amber-700" : decreased ? "text-emerald-700" : "text-slate-700")}>
                        {diff === 0 ? "No change" : increased ? `${diff} more learners` : `${Math.abs(diff)} fewer learners`}
                      </span>
                    </div>
                  </div>

                  {weakAreas.length > 0 && (
                    <div className="pt-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Areas Needing Attention</span>
                      <ul className="mt-1.5 flex flex-wrap gap-2">
                        {weakAreas.map(area => (
                          <li key={area} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/50">
                            {area}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <Link
                  href="/teacher/monitoring"
                  className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:mt-0"
                >
                  View Learners
                  <ArrowRight size={14} />
                </Link>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AcademicOverviewCompact({ riskTrend, earlyWarningCount = 0 }) {
  const [activeComparison, setActiveComparison] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!riskTrend || !riskTrend.comparisons) return null;

  const comparisonOptions = Object.keys(riskTrend.comparisons);
  const currentCompData = riskTrend.comparisons[activeComparison] || riskTrend.comparisons[comparisonOptions[0]];
  const activeLabel = riskTrend.comparisons[activeComparison] ? activeComparison : comparisonOptions[0];

  const handleToggle = (row) => {
    setExpandedRow(prev => prev === row ? null : row);
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
          Academic Overview
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Review learner risk levels and compare changes across periods.
        </p>
      </div>

      <div className="flex flex-col gap-5 p-4 sm:p-5">
        
        {/* Early Warning Row */}
        {earlyWarningCount > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 sm:px-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shadow-sm">
                <AlertTriangle size={16} />
              </span>
              <div>
                <h3 className="flex items-center text-sm font-semibold text-slate-900">
                  Early Warning
                  <span
                    className="ml-1.5 inline-flex cursor-help text-slate-400 hover:text-slate-600"
                    title="Early Warning identifies learners whose recent academic performance shows patterns that may need closer teacher monitoring. It does not automatically assign learners to ARAL."
                  >
                    <Info size={14} />
                  </span>
                </h3>
                <p className="text-[11px] text-slate-600">
                  {earlyWarningCount} learner{earlyWarningCount === 1 ? "" : "s"} need closer review based on recent performance.
                </p>
              </div>
            </div>
            <Link
              href="/teacher/monitoring"
              className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            >
              View <span className="hidden sm:inline">Learners</span>
              <ArrowRight size={14} className="ml-0.5" />
            </Link>
          </div>
        )}

        {/* Academic Risk Trend */}
        <div className="flex flex-col">
          <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Academic Risk Trend</h3>
            
            {/* Custom Dropdown */}
            {comparisonOptions.length > 0 && (
              <div className="relative">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Compare with:</span>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    {activeLabel}
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                </div>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg ring-1 ring-black/5"
                      >
                        {comparisonOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setActiveComparison(opt);
                              setDropdownOpen(false);
                            }}
                            className={cn(
                              "block w-full px-4 py-2.5 text-left text-xs transition-colors hover:bg-slate-50",
                              activeLabel === opt ? "bg-slate-50 font-semibold text-slate-900" : "text-slate-600 font-medium"
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="mb-3">
            <p className="text-[11px] font-semibold text-slate-500">
              {currentCompData?.label}
            </p>
          </div>

          {/* Expandable Rows */}
          <div className="flex flex-col gap-2">
            <RiskRow
              title="High Risk"
              colorClass="text-red-600"
              bgClass="bg-red-50/30"
              borderClass="border-red-100"
              weakAreas={riskTrend.weakAreas?.high}
              prev={currentCompData?.high?.prev}
              curr={currentCompData?.high?.curr}
              isExpanded={expandedRow === "high"}
              onToggle={() => handleToggle("high")}
            />
            <RiskRow
              title="Moderate Risk"
              colorClass="text-amber-700"
              bgClass="bg-amber-50/30"
              borderClass="border-amber-100"
              weakAreas={riskTrend.weakAreas?.moderate}
              prev={currentCompData?.moderate?.prev}
              curr={currentCompData?.moderate?.curr}
              isExpanded={expandedRow === "moderate"}
              onToggle={() => handleToggle("moderate")}
            />
            <RiskRow
              title="Low Risk"
              colorClass="text-emerald-700"
              bgClass="bg-emerald-50/30"
              borderClass="border-emerald-100"
              weakAreas={riskTrend.weakAreas?.low}
              prev={currentCompData?.low?.prev}
              curr={currentCompData?.low?.curr}
              isExpanded={expandedRow === "low"}
              onToggle={() => handleToggle("low")}
            />
          </div>

          <div className="mt-4 border-t border-slate-50 pt-3">
            <p className="text-[10px] leading-relaxed text-slate-400">
              <span className="font-semibold text-slate-500">Shows how learner risk levels changed between selected periods.</span> Previous-year comparison uses synthetic reference data and does not represent verified historical CNHS records.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
