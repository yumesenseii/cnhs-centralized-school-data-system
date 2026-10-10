"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Reference style: AdminMonitoringExecutiveSummary — white card, colored
// value text only. Variants tint the value text, never the card.
const VARIANTS = {
  default: {
    value: "text-slate-900",
  },
  danger: {
    value: "text-red-700",
  },
  warning: {
    value: "text-amber-800",
  },
  success: {
    value: "text-emerald-700",
  },
};

export default function StatCard({ stat }) {
  const variant = VARIANTS[stat.variant] ?? VARIANTS.default;
  const interactive = Boolean(stat.href);

  const content = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {stat.label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold leading-none tracking-tight", variant.value)}>
        {stat.value === null || stat.value === undefined ? (
          <span
            className="inline-block h-6 w-10 animate-pulse rounded bg-slate-200/80 align-middle"
            aria-hidden="true"
          />
        ) : (
          <>
            {stat.value}
            {stat.unit ? (
              <span className="ml-1.5 text-[13px] font-medium text-slate-500">
                {stat.unit}
              </span>
            ) : null}
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">{stat.subtext}</p>
      {stat.delta ? (
        <p className="mt-1 text-[10px] font-semibold text-slate-500">
          {stat.delta.direction === "down" ? "↓ " : stat.delta.direction === "up" ? "↑ " : "→ "}
          {stat.delta.text}
        </p>
      ) : null}
      {interactive && stat.actionLabel ? (
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark">
          {stat.actionLabel}
          <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "block rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow duration-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]",
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
