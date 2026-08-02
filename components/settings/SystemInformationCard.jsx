export default function SystemInformationCard({ system }) {
  const fields = [
    { label: "System Name", value: system.systemName },
    { label: "Research Title", value: system.researchTitle },
    { label: "Version", value: system.version },
    { label: "Database Status", value: system.databaseStatus },
    { label: "Deployment", value: system.deployment },
    { label: "Last Updated", value: system.lastUpdated },
    { label: "Support Email", value: system.supportEmail },
  ];

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">
          System Information
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Read-only details about the CNHS Centralized School Data System.
        </p>
      </div>

      <dl className="space-y-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3"
          >
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {field.label}
            </dt>
            <dd className="mt-1 text-xs font-medium leading-5 text-slate-700">{field.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
