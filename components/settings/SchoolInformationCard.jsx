import { Save } from "lucide-react";
import ProfileUploader from "@/components/settings/ProfileUploader";

export default function SchoolInformationCard({ school }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">
          School Information
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Manage the school&apos;s basic information displayed throughout the system.
        </p>
      </div>

      <div className="space-y-5">
        <ProfileUploader logoSrc={school.logoSrc} schoolName={school.schoolName} />

        <Field label="School Name" name="schoolName" defaultValue={school.schoolName} />
        <Field label="School Address" name="schoolAddress" defaultValue={school.schoolAddress} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Division" name="division" defaultValue={school.division} />
          <Field label="School Year" name="schoolYear" defaultValue={school.schoolYear} />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <Save size={14} />
          Save Changes
        </button>
      </div>
    </section>
  );
}

function Field({ label, name, defaultValue }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
      />
    </label>
  );
}
