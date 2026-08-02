import { Search } from "lucide-react";

export default function SearchBar({
  placeholder = "Search student name or number...",
  value = "",
  onChange,
}) {
  return (
    <label className="relative min-w-[220px] flex-1">
      <span className="sr-only">Search Student</span>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-[11px] text-slate-600 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white"
      />
    </label>
  );
}
