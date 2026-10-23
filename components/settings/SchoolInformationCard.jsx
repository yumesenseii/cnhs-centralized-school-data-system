"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import ProfileUploader from "@/components/settings/ProfileUploader";
import {
  loadSchoolSettings,
  saveSchoolSettingsCanonical,
  syncSchoolSettingsFromDb,
} from "@/lib/settings/adminSettingsStorage";
import { getCanonicalSchoolSettings } from "@/lib/supabase/queries/systemSettings";

export default function SchoolInformationCard({ school: schoolProp }) {
  const [school, setSchool] = useState(schoolProp);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dbSchoolYear, setDbSchoolYear] = useState(null);
  const [localSchoolYear, setLocalSchoolYear] = useState(null);

  useEffect(() => {
    const local = loadSchoolSettings();
    setSchool(local);
    setLocalSchoolYear(local?.schoolYear ?? null);
    setHydrated(true);
    syncSchoolSettingsFromDb().then((synced) => {
      if (synced) {
        setSchool(synced);
        setLocalSchoolYear(synced?.schoolYear ?? null);
      }
    });
    getCanonicalSchoolSettings().then((res) => {
      setDbSchoolYear(res?.data?.schoolYear ?? null);
    });
  }, []);

  function handleChange(field, value) {
    setSchool((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    if (field === "schoolYear") {
      setLocalSchoolYear(value);
    }
  }

  async function handleSave() {
    setSaving(true);
    const next = await saveSchoolSettingsCanonical(school);
    setSchool(next);
    setSaved(true);
    setSaving(false);
    window.setTimeout(() => setSaved(false), 2500);
  }

  if (!hydrated) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.02)] sm:p-5">
        <p className="text-xs text-slate-500">Loading school information…</p>
      </section>
    );
  }

  const schoolYearMismatch =
    dbSchoolYear && localSchoolYear && dbSchoolYear !== localSchoolYear;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">
            School Information
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            School identity used across reports and official documents.
          </p>
        </div>
        <div className="space-y-5 px-4 py-4 sm:px-5">
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
          <Field
            label="Division"
            name="division"
            value={school.division}
            onChange={(v) => handleChange("division", v)}
          />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
          {saved ? (
            <p className="text-[11px] font-medium text-[#246f54]">
              School information saved.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#1f6b4f] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-60"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save School Information"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)]">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">
            Academic Year
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Authoritative school year for this installation.
          </p>
        </div>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <Field
              label="School Year"
              name="schoolYear"
              value={school.schoolYear}
              onChange={(v) => handleChange("schoolYear", v)}
            />
            <p className="mt-1.5 text-[10px] text-slate-400">
              Each E-Record class keeps its own school year from the official
              class record. Updating this value does not change existing
              grades.
            </p>
            {schoolYearMismatch ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <p className="font-medium">Different sources detected</p>
                <p className="mt-0.5">
                  Saved here: <strong>{dbSchoolYear}</strong> · Currently in
                  this editor: <strong>{localSchoolYear}</strong>. E-Record
                  classes use each class&apos;s own school year, so existing
                  records are unaffected.
                </p>
              </div>
            ) : null}
            {dbSchoolYear ? (
              <p className="mt-1 text-[10px] text-slate-400">
                Persisted in database: {dbSchoolYear}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
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
