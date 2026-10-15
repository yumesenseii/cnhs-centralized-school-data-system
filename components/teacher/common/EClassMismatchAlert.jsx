"use client";

import React from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileX2,
  GraduationCap,
  Info,
  Lightbulb,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Visual, non-techy alert component for teachers.
 * Displays a clean side-by-side comparison of file contents vs expected class.
 */
export default function EClassMismatchAlert({
  error,
  validation,
  assignedClass,
  uploadedMeta,
  onClear,
  className,
}) {
  const differences = validation?.differences;
  const isMismatch = Boolean(differences && differences.length > 0);

  // Field icons for visual cues
  const fieldIcons = {
    subject: BookOpen,
    grade_section: GraduationCap,
    teacher: User,
    school_year: Calendar,
  };

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-rose-200 bg-rose-50/70 p-3 sm:p-4 text-xs text-slate-800 shadow-2xs transition-all",
        className
      )}
    >
      {/* 1. Header */}
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
          <FileX2 size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-rose-950">
            {isMismatch
              ? "Maling Klase ang Napiling E-Class Record"
              : "Paalala sa Pag-upload ng File"}
          </h4>
          <p className="mt-0.5 text-[11px] text-rose-800 leading-snug">
            {isMismatch
              ? "Hindi po tugma ang detalye ng in-upload na file sa klase na kasalukuyang binuksan."
              : error || "Pakisuri ang in-upload na file bago magpatuloy."}
          </p>
        </div>
      </div>

      {/* 2. Visual Side-by-Side Comparison Grid (If metadata mismatch) */}
      {isMismatch ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-rose-200/90 bg-white shadow-2xs">
          <div className="grid grid-cols-12 bg-rose-100/60 px-3 py-1.5 text-[10.5px] font-bold text-slate-700 border-b border-rose-200/70">
            <div className="col-span-4 sm:col-span-3">Detalye</div>
            <div className="col-span-4 sm:col-span-5 text-rose-900 flex items-center gap-1">
              <FileSpreadsheet size={12} className="text-rose-600 shrink-0" />
              <span>Laman ng File (.xlsx)</span>
            </div>
            <div className="col-span-4 sm:col-span-4 text-emerald-900 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-cnhs-green shrink-0" />
              <span>Inaasahan sa Klase</span>
            </div>
          </div>

          <div className="divide-y divide-rose-100/70 text-[11px]">
            {differences.map((item) => {
              const IconComponent = fieldIcons[item.field] || Info;
              return (
                <div
                  key={item.field}
                  className={cn(
                    "grid grid-cols-12 items-center px-3 py-2 transition-colors",
                    item.isMismatch
                      ? "bg-rose-50/40"
                      : "bg-slate-50/30 text-slate-600"
                  )}
                >
                  {/* Field Label */}
                  <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 font-semibold text-slate-700">
                    <IconComponent size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {/* Uploaded Value */}
                  <div className="col-span-4 sm:col-span-5 pr-2">
                    {item.isMismatch ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 font-semibold text-rose-800 text-[10.5px] max-w-full">
                        <XCircle size={11} className="text-rose-600 shrink-0" />
                        <span className="truncate">{item.fileValue}</span>
                      </span>
                    ) : (
                      <span className="text-slate-700 font-medium truncate block">
                        {item.fileValue}
                      </span>
                    )}
                  </div>

                  {/* Expected Class Value */}
                  <div className="col-span-4 sm:col-span-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] max-w-full",
                        item.isMismatch
                          ? "bg-slate-100 font-semibold text-slate-800"
                          : "bg-emerald-50 text-emerald-800 font-medium"
                      )}
                    >
                      <span className="truncate">{item.classValue}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 3. Action Guidance Tip */}
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50/90 border border-amber-200/80 p-2.5 text-[11px] text-amber-900">
        <Lightbulb size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-amber-950">Ano ang gagawin?</span>{" "}
          {isMismatch && assignedClass ? (
            <span>
              Paki-upload po ang tamang E-Class Record para sa{" "}
              <strong>{assignedClass.subject}</strong> (
              <strong>{assignedClass.gradeSection || `Grade ${assignedClass.grade} - ${assignedClass.section}`}</strong>
              ), o piliin ang kaukulang klase sa inyong dashboard.
            </span>
          ) : (
            <span>
              Pakitiyak na ang file ay opisyal na DepEd Excel file (.xlsx) at hindi binago ang format o mga sheet nito.
            </span>
          )}
        </div>
      </div>

      {/* 4. Action Button (Pumili ng Ibang File) */}
      {onClear ? (
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} />
            <span>Pumili ng Ibang File</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
