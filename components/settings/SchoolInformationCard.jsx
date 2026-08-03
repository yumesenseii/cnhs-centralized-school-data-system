"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import ProfileUploader from "@/components/settings/ProfileUploader";
import {
  loadSchoolSettings,
  saveSchoolSettings,
} from "@/lib/settings/adminSettingsStorage";

export default function SchoolInformationCard({ school: schoolProp }) {
  const [school, setSchool] = useState(schoolProp);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSchool(loadSchoolSettings());
    setHydrated(true);
  }, []);

  function handleChange(field, value) {
    setSchool((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    const next = saveSchoolSettings(school);
    setSchool(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  if (!hydrated) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
        <p className="text-xs text-slate-500">Loading school information…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">
          School Information
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Manage the school&apos;s basic information displayed throughout the
          system. Saved on this device.
        </p>
      </div>

      <div className="space-y-5">
        <ProfileUploader logoSrc={school.logoSrc} schoolName={school.schoolName} />

        <Field
          label="School Name"
          name="schoolName"
          value={school.schoolName}
          onChange={(v) => handleChange("schoolName", v)}
        />
        <Field
          label="School Address"
          name="schoolAddress"
          value={school.schoolAddress}
          onChange={(v) => handleChange("schoolAddress", v)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Division"
            name="division"
            value={school.division}
            onChange={(v) => handleChange("division", v)}
          />
          <Field
            label="School Year"
            name="schoolYear"
            value={school.schoolYear}
            onChange={(v) => handleChange("schoolYear", v)}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {saved ? (
          <p className="text-[11px] font-medium text-cnhs-green-dark">
            School information saved.
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <Save size={14} />
          Save Changes
        </button>
      </div>
    </section>
  );
}

function Field({ label, name, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
        {label}
      </span>
      <input
        name={name}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
      />
    </label>
  );
}
