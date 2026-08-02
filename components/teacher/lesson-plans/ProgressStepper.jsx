"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Lesson Information" },
  { id: 2, label: "Upload File" },
  { id: 3, label: "Preview & Submit" },
];

export default function ProgressStepper({ currentStep }) {
  return (
    <ol className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {steps.map((step, index) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;

        return (
          <li key={step.id} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                  done || active
                    ? "bg-cnhs-green-dark text-white"
                    : "bg-slate-100 text-slate-400"
                )}
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : step.id}
              </span>
              <span
                className={cn(
                  "text-[12px] font-semibold",
                  done || active ? "text-cnhs-green-dark" : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  currentStep > step.id ? "bg-cnhs-green-dark/40" : "bg-slate-200"
                )}
                aria-hidden="true"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
