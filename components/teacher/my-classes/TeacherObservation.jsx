"use client";

import { useState } from "react";

export default function TeacherObservation() {
  const [notes, setNotes] = useState("");
  const [participation, setParticipation] = useState("Moderate");
  const [score, setScore] = useState("");
  const [behavior, setBehavior] = useState("Cooperative");
  const [progress, setProgress] = useState("Gradual improvement");
  const [saved, setSaved] = useState(false);

  function handleSave(e) {
    e.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Teacher Observation</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Submit weekly monitoring notes for this learner.
      </p>

      <form onSubmit={handleSave} className="mt-4 space-y-3">
        <label className="block">
          <span className="text-[11px] font-medium text-slate-600">Observation Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Enter classroom observation notes..."
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Student Participation</span>
            <select
              value={participation}
              onChange={(e) => setParticipation(e.target.value)}
              className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
            >
              {["Low", "Moderate", "High"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Assessment Score</span>
            <input
              type="number"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 72"
              className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Behavior</span>
            <select
              value={behavior}
              onChange={(e) => setBehavior(e.target.value)}
              className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
            >
              {["Needs Guidance", "Cooperative", "Excellent"].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">Progress</span>
            <select
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
            >
              {["No improvement", "Limited", "Gradual improvement", "Significant improvement"].map(
                (option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved ? (
            <span className="text-[11px] font-medium text-cnhs-green-dark">
              Observation saved (demo)
            </span>
          ) : null}
          <button
            type="submit"
            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-4 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            Save Observation
          </button>
        </div>
      </form>
    </section>
  );
}
