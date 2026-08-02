import { Search } from "lucide-react";

export default function SearchBar({ value, onChange }) {
  const isControlled = value !== undefined;
  return (
    <label className="relative min-w-[250px] flex-1">
      <span className="sr-only">Search lesson plans</span>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
      />
      <input
        type="search"
        placeholder="Search teacher, subject, or lesson title..."
        {...(isControlled
          ? {
              value,
              onChange: (e) => onChange?.(e.target.value),
            }
          : {})}
        className="h-9 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-[11px] text-slate-600 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white"
      />
    </label>
  );
}
