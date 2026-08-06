export default function WeakSubjectChart({ data = [] }) {
  if (!data.length) {
    return (
      <p className="py-10 text-center text-xs text-slate-400">
        No below-passing subject counts yet.
      </p>
    );
  }

  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="max-h-[320px] space-y-4 overflow-y-auto py-2 pr-2">
      {data.map((item) => {
        const width = item.count > 0 ? `${(item.count / maxCount) * 100}%` : "0%";

        return (
          <div key={item.subject} className="grid grid-cols-[112px_1fr_24px] items-center gap-3 sm:grid-cols-[132px_1fr_28px]">
            <p className="truncate text-right text-xs font-medium text-slate-500">{item.subject}</p>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cnhs-green-dark"
                style={{ width }}
                role="progressbar"
                aria-label={`${item.subject} weak subject count`}
                aria-valuenow={item.count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
              />
            </div>
            <p
              className="text-right text-xs font-semibold text-slate-600"
              aria-label={`${item.count} weak learners`}
            >
              {item.count}
            </p>
          </div>
        );
      })}
    </div>
  );
}
