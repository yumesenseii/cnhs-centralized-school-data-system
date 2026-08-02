import { cn } from "@/lib/utils";

export default function ChartCard({ title, children, className }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <h2 className="mb-2.5 text-sm font-semibold tracking-[-0.01em] text-slate-700">{title}</h2>
      {children}
    </section>
  );
}
