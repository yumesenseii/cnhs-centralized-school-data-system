import { cn } from "@/lib/utils";

export default function ChartCard({ title, children, className }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
      {children}
    </section>
  );
}
