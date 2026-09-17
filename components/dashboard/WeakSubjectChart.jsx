export default function WeakSubjectChart({ data = [] }) {
  if (!data.length) {
    return (
      <p className="py-6 text-center text-xs text-slate-400">
        No below-passing subject counts yet.
      </p>
    );
  }

  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="max-h-[200px] space-y-2 overflow-y-auto py-1 pr-1">
      {data.map((item) => {
        const width =
          item.count > 0 ? `${(item.count / maxCount) * 100}%` : "0%";

        return (
          <div
            key={item.subject}
            className="grid grid-cols-[96px_1fr_22px] items-center gap-2 sm:grid-cols-[112px_1fr_24px]"
          >
            <p className="truncate text-right text-xs font-medium text-slate-700">
              {item.subject}
            </p>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
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
              className="text-right text-xs font-semibold text-slate-700"
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
