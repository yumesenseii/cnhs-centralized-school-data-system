"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  users: UsersRound,
  alert: AlertTriangle,
  check: CheckCircle2,
};

const VARIANTS = {
  default: {
    card: "border-slate-100 bg-white",
    value: "text-slate-950",
    subtext: "text-slate-400",
    icon: "text-slate-500",
    iconWrap: "bg-white",
  },
  danger: {
    card: "border-red-100 bg-cnhs-red-soft",
    value: "text-red-800",
    subtext: "text-red-700",
    icon: "text-red-600",
    iconWrap: "bg-red-50",
  },
  success: {
    card: "border-green-100 bg-cnhs-green-soft",
    value: "text-emerald-800",
    subtext: "text-emerald-700",
    icon: "text-cnhs-green-dark",
    iconWrap: "bg-green-50",
  },
};

export default function StatCard({ stat }) {
  const Icon = ICONS[stat.icon] ?? UsersRound;
  const variant = VARIANTS[stat.variant] ?? VARIANTS.default;
  const interactive = Boolean(stat.href);

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-slate-700">{stat.label}</p>
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", variant.iconWrap)}>
          <Icon size={15} strokeWidth={1.8} className={variant.icon} aria-hidden="true" />
        </span>
      </div>
      <p className={cn("mt-3 text-[24px] font-semibold leading-none tracking-[-0.04em]", variant.value)}>
        {stat.value}
      </p>
      <p className={cn("mt-1.5 text-[11px] font-medium", variant.subtext)}>{stat.subtext}</p>
    </>
  );

  const className = cn(
    "block rounded-xl border p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]",
    variant.card,
    interactive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/40"
  );

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {interactive ? (
        <Link href={stat.href} className={className} aria-label={`View ${stat.label} learners`}>
          {content}
        </Link>
      ) : (
        <section className={className}>{content}</section>
      )}
    </motion.div>
  );
}
