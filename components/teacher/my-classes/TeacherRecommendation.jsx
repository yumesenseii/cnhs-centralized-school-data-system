"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

export default function TeacherRecommendation({ options, defaultRecommendation, defaultRemarks }) {
  const [recommendation, setRecommendation] = useState(defaultRecommendation);
  const [remarks, setRemarks] = useState(defaultRemarks);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    window.setTimeout(() => setSubmitted(false), 2500);
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Final Recommendation</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Submit this recommendation to the Head Teacher for review.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <fieldset>
          <legend className="text-[11px] font-medium text-slate-600">Recommendation</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label
                key={option}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-[12px] text-slate-700 transition-colors hover:bg-slate-50"
              >
                <input
                  type="radio"
                  name="recommendation"
                  value={option}
                  checked={recommendation === option}
                  onChange={() => setRecommendation(option)}
                  className="accent-[#174D37]"
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-[11px] font-medium text-slate-600">Remarks</span>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {submitted ? (
            <span className="text-[11px] font-medium text-cnhs-green-dark">
              Recommendation submitted (demo)
            </span>
          ) : null}
          <button
            type="submit"
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#d8efe4] px-4 text-[12px] font-semibold text-cnhs-green-dark transition-colors hover:bg-[#c6e6d7]"
          >
            Submit to Head Teacher
            <ChevronRight size={14} />
          </button>
        </div>
      </form>
    </section>
  );
}
