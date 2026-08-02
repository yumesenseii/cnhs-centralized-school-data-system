import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <Skeleton className="h-5 w-44" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
