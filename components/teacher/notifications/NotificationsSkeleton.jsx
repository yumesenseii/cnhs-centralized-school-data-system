export default function NotificationsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-[72px] items-center gap-4 rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <span className="h-10 w-10 rounded-full bg-slate-100" />
            <span className="flex-1 space-y-2">
              <span className="block h-5 w-12 rounded bg-slate-100" />
              <span className="block h-2.5 w-24 rounded bg-slate-100" />
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 h-[60px] rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]" />

      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5"
          >
            <div className="flex gap-3.5">
              <span className="h-11 w-11 shrink-0 rounded-full bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <span className="block h-3 w-1/3 rounded bg-slate-100" />
                <span className="block h-2.5 w-3/4 rounded bg-slate-100" />
                <span className="block h-2.5 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
