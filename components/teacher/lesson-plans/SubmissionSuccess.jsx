"use client";

import Link from "next/link";
import { Check, ChevronLeft, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { lessonPlansData } from "@/data/teacher/lessonPlans";
import { cn } from "@/lib/utils";

export default function SubmissionSuccess({
  trackingNumber,
  submittedAt,
  status = "Pending Review",
  timeline,
  onUploadAnother,
}) {
  const success = lessonPlansData.successDefaults;
  const steps = timeline?.length ? timeline : success.timeline;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto max-w-2xl py-4 text-center"
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-cnhs-green-dark">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cnhs-green-dark text-white shadow-sm">
          <Check size={28} strokeWidth={2.5} />
        </span>
      </div>

      <h2 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-900">
        Lesson Plan Successfully Submitted
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-[13px] leading-6 text-slate-500">
        Your lesson plan has been submitted to the School Principal for review. You
        will receive a notification once the review is completed.
      </p>
      <p className="mx-auto mt-2 max-w-lg text-[12px] font-medium text-cnhs-green-dark">
        Next:{" "}
        <Link href="/teacher/notifications" className="underline-offset-2 hover:underline">
          check Notifications
        </Link>{" "}
        for the review result, or continue teaching tasks from the dashboard.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Status", status || success.status],
          ["Submitted To", success.submittedTo],
          ["Notification", success.notification],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-100 bg-white px-3 py-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {label}
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
            Tracking Number
          </p>
          <p className="mt-1.5 text-[13px] font-semibold text-cnhs-green-dark">
            {trackingNumber ?? success.trackingNumber}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
            Submitted On
          </p>
          <p className="mt-1.5 text-[12px] font-semibold text-slate-800">
            {submittedAt ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <h3 className="text-[12px] font-semibold text-slate-800">Review Timeline</h3>
        <ol className="mt-4 space-y-3">
          {steps.map((item, index) => (
            <li key={item.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                  item.done || index === 0
                    ? "bg-cnhs-green-dark text-white"
                    : "border border-slate-200 bg-white text-slate-400"
                )}
              >
                {item.done || index === 0 ? <Check size={12} strokeWidth={2.5} /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[12px] font-medium",
                  item.done || index === 0 ? "text-slate-800" : "text-slate-400"
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/teacher/lesson-plans"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <ChevronLeft size={14} />
          Return to Lesson Plans
        </Link>
        <button
          type="button"
          onClick={onUploadAnother}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <Upload size={14} />
          Upload Another
        </button>
      </div>
    </motion.div>
  );
}
