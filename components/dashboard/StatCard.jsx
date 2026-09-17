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
  warning: {
    card: "border-amber-100 bg-amber-50/80",
    value: "text-amber-800",
    subtext: "text-amber-700",
    icon: "text-amber-600",
    iconWrap: "bg-white/80",
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {stat.label}
        </p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", variant.iconWrap)}>
          <Icon size={15} strokeWidth={1.8} className={variant.icon} aria-hidden="true" />
        </span>
      </div>
      <p className={cn("mt-2 text-[22px] font-semibold leading-none tracking-[-0.04em]", variant.value)}>
        {stat.value === null || stat.value === undefined ? (
          <span
            className="inline-block h-6 w-10 animate-pulse rounded bg-slate-200/80 align-middle"
            aria-hidden="true"
          />
        ) : (
          stat.value
        )}
      </p>
      <p className={cn("mt-1 text-[10px] font-medium", variant.subtext)}>{stat.subtext}</p>
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
