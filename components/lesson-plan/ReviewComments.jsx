"use client";

export default function ReviewComments({
  categories,
  category,
  remarks,
  onCategoryChange,
  onRemarksChange,
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        Review Comments
      </h3>
      <label className="mb-3 block">
        <span className="sr-only">Review Category</span>
        <select
          value={category}
          onChange={(e) => onCategoryChange?.(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 outline-none focus:border-cnhs-green"
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Review comments</span>
        <textarea
          rows={5}
          value={remarks}
          onChange={(e) => onRemarksChange?.(e.target.value)}
          placeholder="Provide comments, suggestions, or revision instructions for the teacher."
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
        />
      </label>
    </section>
  );
}
