"use client";

import React, { useState, useMemo } from "react";
import { Search, FileText } from "lucide-react";
import { formatDepEdLearnerName } from "@/lib/reports/sf9DataService";
import AppSelect from "@/components/shared/AppSelect";

function formatGradeValue(val) {
  if (val === null || val === undefined || val === "") return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";
  return num;
}

function getGradeTextStyle(val) {
  if (val === null || val === undefined || val === "") return "text-slate-400";
  const num = Number(val);
  if (isNaN(num)) return "text-slate-400";
  if (num < 75) return "text-rose-600 font-semibold";
  if (num >= 90) return "text-emerald-700 font-semibold dark:text-emerald-400";
  return "text-slate-800 dark:text-slate-200";
}

export default function AdvisoryGradesMatrix({
  learners = [],
  releasesMap = {},
  onOpenSf9Modal = () => {},
}) {
  const [selectedTerm, setSelectedTerm] = useState("final"); // 't1', 't2', 't3', 'final'
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");

  const genderOptions = [
    { value: "all", label: `All Learners (${learners.length})` },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
  ];

  const filteredLearners = useMemo(() => {
    return learners.filter((learner) => {
      const name = `${learner.lastName || ""} ${learner.firstName || ""}`.toLowerCase();
      const lrn = String(learner.lrn || learner.studentNumber || "");
      const matchesSearch =
        name.includes(searchQuery.toLowerCase()) || lrn.includes(searchQuery);

      let matchesGender = true;
      if (genderFilter === "male") {
        matchesGender = (learner.gender || "").toLowerCase().startsWith("m");
      } else if (genderFilter === "female") {
        matchesGender = (learner.gender || "").toLowerCase().startsWith("f");
      }

      return matchesSearch && matchesGender;
    });
  }, [learners, searchQuery, genderFilter]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
      {/* Table Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-2.5 dark:border-slate-800 dark:bg-slate-800/30">
        <div className="flex flex-wrap items-center gap-2">
          {/* Term Selector Tabs */}
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-700 dark:bg-slate-800">
            {[
              { id: "t1", label: "Term 1 (T1)" },
              { id: "t2", label: "Term 2 (T2)" },
              { id: "t3", label: "Term 3 (T3)" },
              { id: "final", label: "Final & General Average" },
            ].map((term) => (
              <button
                key={term.id}
                type="button"
                onClick={() => setSelectedTerm(term.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  selectedTerm === term.id
                    ? "bg-cnhs-green text-white font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                {term.label}
              </button>
            ))}
          </div>

          {/* Gender Filter via AppSelect */}
          <div className="w-36">
            <AppSelect
              size="pill"
              value={genderFilter}
              onChange={setGenderFilter}
              options={genderOptions}
              triggerClassName="h-7 text-[11px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
          <input
            type="text"
            placeholder="Search learner or LRN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-7.5 pr-2.5 py-1 h-7.5 rounded-md border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-cnhs-green focus:ring-1 focus:ring-cnhs-green/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Formal School Record Table Container */}
      <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr className="border-b border-slate-200 text-[11px] font-semibold tracking-wide dark:border-slate-700">
              <th className="py-2 px-3 w-8 text-center">#</th>
              <th className="py-2 px-3 min-w-[170px]">Learner</th>
              <th className="py-2 px-2 text-center" title="English">English</th>
              <th className="py-2 px-2 text-center" title="Filipino">Filipino</th>
              <th className="py-2 px-2 text-center" title="Mathematics">Mathematics</th>
              <th className="py-2 px-2 text-center" title="Science">Science</th>
              <th className="py-2 px-2 text-center" title="Araling Panlipunan">AP</th>
              <th className="py-2 px-2 text-center" title="MAPEH">MAPEH</th>
              <th className="py-2 px-2 text-center" title="EPP/TLE">TLE</th>
              <th className="py-2 px-2 text-center" title="ESP / Values Education">ESP</th>
              <th className="py-2 px-3 text-center bg-slate-200/60 dark:bg-slate-700/60 font-bold">
                General Average
              </th>
              <th className="py-2 px-3 text-center">SF9 Status</th>
              <th className="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11.5px] dark:divide-slate-800/80">
            {filteredLearners.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-xs text-slate-400">
                  No learners found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLearners.map((learner, idx) => {
                const g = learner.grades || {};
                const getVal = (subjKey) => {
                  const s = g[subjKey] || {};
                  return selectedTerm === "final" ? s.final : s[selectedTerm];
                };

                const eng = getVal("english");
                const fil = getVal("filipino");
                const math = getVal("mathematics");
                const sci = getVal("science");
                const ap = getVal("araling_panlipunan");
                const mapeh = getVal("mapeh");
                const tle = getVal("tle");
                const esp = getVal("values_education");

                const currentTerms = [eng, fil, math, sci, ap, mapeh, tle, esp]
                  .filter((v) => v !== null && v !== undefined && v !== "")
                  .map(Number);

                const currentAvg =
                  currentTerms.length > 0
                    ? Math.round(
                        currentTerms.reduce((a, b) => a + b, 0) / currentTerms.length
                      )
                    : null;

                const isReady = learner.isComplete;

                return (
                  <tr
                    key={learner.id}
                    className="even:bg-slate-50/50 hover:bg-slate-100/60 transition-colors dark:even:bg-slate-800/20 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatDepEdLearnerName(learner)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        LRN: {learner.lrn}
                      </div>
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(eng)}`}>
                      {formatGradeValue(eng)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(fil)}`}>
                      {formatGradeValue(fil)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(math)}`}>
                      {formatGradeValue(math)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(sci)}`}>
                      {formatGradeValue(sci)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(ap)}`}>
                      {formatGradeValue(ap)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(mapeh)}`}>
                      {formatGradeValue(mapeh)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(tle)}`}>
                      {formatGradeValue(tle)}
                    </td>
                    <td className={`py-2 px-2 text-center ${getGradeTextStyle(esp)}`}>
                      {formatGradeValue(esp)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-slate-900 bg-slate-50/80 dark:text-slate-100 dark:bg-slate-800/40">
                      {currentAvg ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {(() => {
                        const rel = releasesMap[learner.id || learner.studentId];
                        let statusLabel = isReady ? "Ready" : "Pending";
                        let statusBadgeClass = isReady
                          ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                          : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
                        let statusDotClass = isReady ? "bg-purple-600" : "bg-amber-500";

                        if (rel?.status === "released") {
                          statusLabel = "Released";
                          statusBadgeClass = "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
                          statusDotClass = "bg-cnhs-green";
                        } else if (rel?.status === "completed") {
                          statusLabel = "Completed";
                          statusBadgeClass = "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";
                          statusDotClass = "bg-blue-600";
                        }

                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                            <span>{statusLabel}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenSf9Modal(learner)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 active:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        title="Preview Official SF9 PDF"
                      >
                        <FileText size={11} className="text-slate-400" />
                        <span>Preview</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50/70 text-[11px] text-slate-500 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-400">
        <span>
          Showing <strong>{filteredLearners.length}</strong> of{" "}
          <strong>{learners.length}</strong> enrolled learners
        </span>
        <span className="hidden sm:inline">
          Official DepEd grading scale (passing mark is 75)
        </span>
      </div>
    </div>
  );
}
