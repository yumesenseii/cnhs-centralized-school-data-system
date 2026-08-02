"use client";

export default function AttendanceSummary({ attendance }) {
  const chart = Array.isArray(attendance?.chart) ? attendance.chart : [];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Attendance Summary{" "}
        <span className="font-normal">· monitoring only · not a prediction input</span>
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Overall Avg", value: attendance?.average ?? "—", className: "text-amber-600" },
          {
            label: "Perfect Attendance",
            value: attendance?.perfect ?? "—",
            className: "text-cnhs-green-dark",
          },
          { label: "Below 90%", value: attendance?.below90 ?? "—", className: "text-red-600" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-100 bg-white px-3 py-2"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {item.label}
            </p>
            <p className={`mt-1 text-lg font-semibold ${item.className}`}>{item.value}</p>
          </div>
        ))}
      </div>
      {chart.length ? (
        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <p className="mb-3 text-[11px] font-semibold text-slate-600">Attendance Chart</p>
          <div className="flex h-24 items-end gap-2">
            {chart.map((point) => (
              <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-cnhs-green-dark/80"
                  style={{ height: `${Math.max(point.value - 70, 8) * 2.2}px` }}
                  title={`${point.value}%`}
                />
                <span className="text-[9px] font-medium text-slate-400">{point.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-400">
          Detailed SF2 attendance analytics are available under Attendance Monitoring.
        </p>
      )}
    </section>
  );
}
