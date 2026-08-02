import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingSkeleton({ type = "card" }) {
  if (type === "table") {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-3 h-[220px] w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-5 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-24" />
    </div>
  );
}
