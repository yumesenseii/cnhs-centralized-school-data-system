import { Search } from "lucide-react";

export default function SearchBar({ value = "", onChange }) {
  return (
    <label className="relative w-full min-w-0 flex-1 md:max-w-[360px]">
      <span className="sr-only">Search users</span>
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder="Search name, email, or username..."
        className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[11px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:ring-2 focus:ring-cnhs-green/10"
      />
    </label>
  );
}
