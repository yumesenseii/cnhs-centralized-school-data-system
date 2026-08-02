import { cn } from "@/lib/utils";

export default function ReviewHistory({ history = [] }) {
  return (
    <section>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Review History</h3>
      <div className="space-y-5">
        {!history.length ? (
          <p className="text-sm text-slate-400">No review activity recorded yet.</p>
        ) : null}
        {history.map((item, index) => {
          const isRight = item.side === "right";

          return (
            <div key={item.id ?? `${item.role}-${item.date}-${index}`} className={cn("flex items-start gap-3", isRight && "justify-end")}>
              {!isRight ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-sm font-semibold text-white">
                  {item.initials}
                </span>
              ) : null}
              <div className={cn("max-w-[290px]", isRight && "text-right")}>
                <div
                  className={cn(
                    "rounded-2xl border px-5 py-2 text-left",
                    isRight ? "border-green-100 bg-green-50" : "border-slate-200 bg-white"
                  )}
                >
                  <p className={cn("font-semibold", isRight ? "text-cnhs-green-dark" : "text-cnhs-green-dark")}>
                    {item.role}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{item.message}</p>
                </div>
                <p className="mt-2 text-xs text-slate-400">{item.date}</p>
              </div>
              {isRight ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-400 text-sm font-semibold text-white">
                  {item.initials}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
