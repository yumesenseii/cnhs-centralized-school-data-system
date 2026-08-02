"use client";

import { motion } from "framer-motion";
import { AlertTriangle, FileClock, FileText, GraduationCap, Hourglass, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  graduation: GraduationCap,
  upload: UploadCloud,
  hourglass: Hourglass,
  alert: AlertTriangle,
  file: FileText,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  orange: "bg-orange-50 text-cnhs-orange",
  red: "bg-red-50 text-red-600",
  blue: "bg-indigo-50 text-indigo-600",
};

export default function SummaryCard({ card }) {
  const Icon = icons[card.icon] ?? FileClock;

  return (
    <motion.section
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex min-h-[64px] items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tones[card.tone])}>
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-5 tracking-[-0.03em] text-slate-900">
          {card.value}
        </span>
        <span className="mt-1 block text-[10px] font-medium leading-3 text-slate-500">{card.label}</span>
        <span className="mt-0.5 block text-[9px] leading-3 text-slate-400">{card.subtext}</span>
      </span>
    </motion.section>
  );
}
