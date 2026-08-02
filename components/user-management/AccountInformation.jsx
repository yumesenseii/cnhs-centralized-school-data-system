const fields = [
  { key: "createdDate", label: "Created Date" },
  { key: "lastLogin", label: "Last Login" },
  { key: "lastPasswordReset", label: "Last Password Reset" },
];

export default function AccountInformation({ user }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800">Account Information</h3>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {fields.map((field) => (
          <div key={field.key} className="rounded-xl border border-slate-100 bg-white px-3.5 py-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {field.label}
            </dt>
            <dd className="mt-1 text-xs font-semibold text-slate-700">{user[field.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
